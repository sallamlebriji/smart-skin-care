import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface QualityCheck {
  ok: boolean;
  hint: string;
}

export interface QualityReport {
  faceFound: boolean;
  lighting: QualityCheck;
  position: QualityCheck;
  visibility: QualityCheck;
  quality: QualityCheck;
  allOk: boolean;
  /** Raw measurements, kept for debugging and for the Phase 3 upload payload. */
  metrics: { luma: number; imbalance: number; sharpness: number; yaw: number; faceHeight: number };
}

export type ScanAngle = "front" | "left" | "right";

/**
 * Acceptable nose position between the two face edges (0 = far image-left,
 * 1 = far image-right). Turning to your own left moves the nose toward image-right.
 */
const YAW_RANGE: Record<ScanAngle, [number, number]> = {
  front: [0.38, 0.62],
  left: [0.62, 0.82],
  right: [0.18, 0.38],
};

const NOSE = 1;
const LEFT_EDGE = 234;
const RIGHT_EDGE = 454;

const fail = (hint: string): QualityCheck => ({ ok: false, hint });
const pass = (hint = "Good"): QualityCheck => ({ ok: true, hint });

export const EMPTY_REPORT: QualityReport = {
  faceFound: false,
  lighting: fail("Waiting for a face"),
  position: fail("Center your face in the oval"),
  visibility: fail("No face detected"),
  quality: fail("Waiting for a face"),
  allOk: false,
  metrics: { luma: 0, imbalance: 0, sharpness: 0, yaw: 0.5, faceHeight: 0 },
};

const crop = document.createElement("canvas");
const cropCtx = crop.getContext("2d", { willReadFrequently: true });

function sampleCrop(
  video: HTMLVideoElement,
  box: { x: number; y: number; w: number; h: number },
  size: number,
) {
  if (!cropCtx) return null;
  crop.width = size;
  crop.height = size;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  cropCtx.drawImage(video, box.x * vw, box.y * vh, box.w * vw, box.h * vh, 0, 0, size, size);
  return cropCtx.getImageData(0, 0, size, size).data;
}

function lumaOf(data: Uint8ClampedArray, i: number) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/**
 * Judges whether the current frame is good enough to analyze. Thresholds are
 * first-pass heuristics, not clinically validated — tune with real captures.
 */
export function assessFrame(
  landmarks: NormalizedLandmark[] | null,
  video: HTMLVideoElement,
  angle: ScanAngle = "front",
): QualityReport {
  if (!landmarks || landmarks.length === 0 || !video.videoWidth) return EMPTY_REPORT;

  let minX = 1, minY = 1, maxX = 0, maxY = 0, inside = 0;
  for (const p of landmarks) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    if (p.x > 0.005 && p.x < 0.995 && p.y > 0.005 && p.y < 0.995) inside++;
  }
  const box = { x: Math.max(0, minX), y: Math.max(0, minY), w: Math.min(1, maxX) - Math.max(0, minX), h: Math.min(1, maxY) - Math.max(0, minY) };
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const insideRatio = inside / landmarks.length;

  const yaw = (landmarks[NOSE].x - landmarks[LEFT_EDGE].x) / Math.max(1e-6, landmarks[RIGHT_EDGE].x - landmarks[LEFT_EDGE].x);

  const visibility = insideRatio >= 0.98 && box.h > 0.2 ? pass() : fail(insideRatio < 0.98 ? "Keep your whole face in frame" : "Move closer");

  let position: QualityCheck;
  if (box.h < 0.4) position = fail("Move a little closer");
  else if (box.h > 0.85) position = fail("Move a little back");
  else if (Math.abs(cx - 0.5) > 0.16 || Math.abs(cy - 0.5) > 0.14) position = fail("Center your face in the oval");
  else {
    const [lo, hi] = YAW_RANGE[angle];
    if (yaw >= lo && yaw <= hi) position = pass();
    else if (angle === "front") position = fail("Look straight at the camera");
    else {
      const side = angle;
      const tooLittle = angle === "left" ? yaw < lo : yaw > hi;
      position = fail(tooLittle ? `Turn your face slightly ${side}` : "Not so far — turn back a little");
    }
  }

  let luma = 0, imbalance = 0, sharpness = 0;
  let lighting = fail("Checking light");
  let quality = fail("Checking sharpness");

  const px = sampleCrop(video, box, 64);
  if (px) {
    let sum = 0, left = 0, right = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const l = lumaOf(px, (y * 64 + x) * 4);
        sum += l;
        if (x < 32) left += l; else right += l;
      }
    }
    luma = sum / (64 * 64) / 255;
    const half = 64 * 32 * 255;
    imbalance = Math.abs(left - right) / half;
    if (luma < 0.28) lighting = fail("Too dark — face a light source");
    else if (luma > 0.85) lighting = fail("Too bright — avoid direct glare");
    else if (imbalance > 0.18) lighting = fail("Uneven light — face the light evenly");
    else lighting = pass();
  }

  const sharpPx = sampleCrop(video, box, 96);
  if (sharpPx) {
    const g = new Float32Array(96 * 96);
    for (let i = 0; i < g.length; i++) g[i] = lumaOf(sharpPx, i * 4);
    let mean = 0, sq = 0, n = 0;
    for (let y = 1; y < 95; y++) {
      for (let x = 1; x < 95; x++) {
        const i = y * 96 + x;
        const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - 96] - g[i + 96];
        mean += lap;
        sq += lap * lap;
        n++;
      }
    }
    sharpness = sq / n - (mean / n) ** 2;
    // Measured on a 96px crop: sharp 720p footage ≈ 700, a 1px blur ≈ 20. Re-tune against real webcams.
    quality = sharpness >= 40 ? pass() : fail("Image is blurry — hold still");
  }

  const allOk = visibility.ok && position.ok && lighting.ok && quality.ok;
  return {
    faceFound: true,
    lighting,
    position,
    visibility,
    quality,
    allOk,
    metrics: { luma, imbalance, sharpness, yaw, faceHeight: box.h },
  };
}
