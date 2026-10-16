import { CATEGORY, type SegmentationResult } from "./skinSegmenter";
import type { RegionPolygon, RegionId } from "./faceRegions";
import { measureSkinPixels } from "./imageMeasurements";
import type { Point } from "./geometry";

export interface RegionStats {
  id: RegionId;
  /** Skin-classified pixels inside the region polygon, out of its total pixel area. */
  skinPixelRatio: number;
  /** 0–1 mean brightness, skin pixels only. */
  luma: number;
  /** 0–1 mean red-vs-green/blue bias, a rough tone-evenness proxy — not a pigmentation diagnosis. */
  redness: number;
  /** Local contrast (Laplacian variance) over skin pixels — a texture-roughness proxy, unitless. */
  texture: number;
  sampleCount: number;
}

const REGION_COLOR: Record<RegionId, number> = { forehead: 1, cheekRight: 2, cheekLeft: 3, nose: 4, chin: 5 };
const ID_BY_COLOR = Object.fromEntries(Object.entries(REGION_COLOR).map(([k, v]) => [v, k as RegionId]));

function rasterizeRegions(polygons: RegionPolygon[], width: number, height: number, exclusions: Point[][] = []): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  for (const region of polygons) {
    const c = REGION_COLOR[region.id];
    ctx.fillStyle = `rgb(${c},${c},${c})`;
    ctx.beginPath();
    region.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "destination-out";
  for (const points of exclusions) {
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fill(); ctx.lineWidth = Math.max(2, width / 170); ctx.stroke();
  }
  const data = ctx.getImageData(0, 0, width, height).data;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] === 255 ? data[i * 4] : 0;
  return out;
}

export function measureFaceImage(image: HTMLCanvasElement, polygons: RegionPolygon[], segmentation: SegmentationResult, exclusions: Point[][] = []) {
  const { width, height } = image;
  const regions = rasterizeRegions(polygons, width, height, exclusions);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const sx = Math.min(segmentation.width - 1, Math.floor(x * segmentation.width / width));
    const sy = Math.min(segmentation.height - 1, Math.floor(y * segmentation.height / height));
    mask[i] = ID_BY_COLOR[regions[i]] && segmentation.categories[sy * segmentation.width + sx] === CATEGORY.faceSkin ? 1 : 0;
  }
  return measureSkinPixels(image.getContext("2d")!.getImageData(0, 0, width, height).data, width, height, mask);
}

/**
 * Isolates each face region to its actual skin pixels (landmark polygon ∩
 * neural skin segmentation) and reports simple visual-only stats per region.
 * These are descriptive image statistics, not a medical or dermatological
 * assessment — see SAFETY_DISCLAIMER.
 */
export function analyzeRegions(
  image: HTMLCanvasElement,
  polygons: RegionPolygon[],
  segmentation: SegmentationResult,
  exclusions: Point[][] = [],
): RegionStats[] {
  const width = image.width;
  const height = image.height;
  const regionMap = rasterizeRegions(polygons, width, height, exclusions);
  const pixels = image.getContext("2d")!.getImageData(0, 0, width, height).data;

  const sx = segmentation.width / width;
  const sy = segmentation.height / height;

  const sums = new Map<RegionId, { luma: number; red: number; n: number; skinN: number; total: number }>();
  for (const p of polygons) sums.set(p.id, { luma: 0, red: 0, n: 0, skinN: 0, total: 0 });

  // Full-res luma buffer, reused for a per-region Laplacian texture pass below.
  const luma = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    luma[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const color = regionMap[idx];
      const id = ID_BY_COLOR[color];
      // Anti-aliased edges between adjacent region fills can read back an
      // intermediate color that matches no region exactly — skip those pixels.
      if (!id) continue;
      const s = sums.get(id)!;
      s.total++;
      const segIdx = Math.min(segmentation.height - 1, (y * sy) | 0) * segmentation.width + Math.min(segmentation.width - 1, (x * sx) | 0);
      if (segmentation.categories[segIdx] !== CATEGORY.faceSkin) continue;
      s.skinN++;
      s.luma += luma[idx];
      const px = idx * 4;
      s.red += pixels[px] / 255 - (pixels[px + 1] / 255 + pixels[px + 2] / 255) / 2;
    }
  }

  const textureSum = new Map<RegionId, { sum: number; sq: number; n: number }>();
  for (const p of polygons) textureSum.set(p.id, { sum: 0, sq: 0, n: 0 });
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const color = regionMap[idx];
      const id = ID_BY_COLOR[color];
      if (!id) continue;
      const segIdx = Math.min(segmentation.height - 1, (y * sy) | 0) * segmentation.width + Math.min(segmentation.width - 1, (x * sx) | 0);
      if (segmentation.categories[segIdx] !== CATEGORY.faceSkin) continue;
      if (![idx - 1, idx + 1, idx - width, idx + width].every(neighbor => {
        const nx = neighbor % width, ny = Math.floor(neighbor / width);
        const si = Math.min(segmentation.height - 1, Math.floor(ny * sy)) * segmentation.width + Math.min(segmentation.width - 1, Math.floor(nx * sx));
        return regionMap[neighbor] === color && segmentation.categories[si] === CATEGORY.faceSkin;
      })) continue;
      const lap = 4 * luma[idx] - luma[idx - 1] - luma[idx + 1] - luma[idx - width] - luma[idx + width];
      const t = textureSum.get(id)!;
      t.sum += lap;
      t.sq += lap * lap;
      t.n++;
    }
  }

  return polygons.map(({ id }) => {
    const s = sums.get(id)!;
    const t = textureSum.get(id)!;
    const n = Math.max(1, s.skinN);
    const tn = Math.max(1, t.n);
    const mean = t.sum / tn;
    return {
      id,
      skinPixelRatio: s.total ? s.skinN / s.total : 0,
      luma: s.luma / n / 255,
      redness: s.red / n,
      texture: t.sq / tn - mean * mean,
      sampleCount: s.skinN,
    };
  });
}
