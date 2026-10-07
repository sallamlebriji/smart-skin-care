import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

let instance: Promise<ImageSegmenter> | null = null;

/**
 * selfie_multiclass_256x256 category order (fixed by the model, not configurable):
 * 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 other (ears, accessories…).
 */
export const CATEGORY = { background: 0, hair: 1, bodySkin: 2, faceSkin: 3, clothes: 4, other: 5 } as const;

async function create(delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/selfie_multiclass_256x256.tflite", delegate },
    runningMode: "IMAGE",
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
}

/**
 * Lazy singleton: the ~16 MB segmentation model only loads once a scan needs
 * it. CPU-first (not GPU-first like the landmarker): this runs once on a
 * still image after capture, when the tab may be backgrounded — a WebGL
 * context can stall indefinitely on a backgrounded/hidden tab, so CPU is the
 * safer default for a one-shot job where raw speed doesn't matter.
 */
export function getSkinSegmenter(): Promise<ImageSegmenter> {
  instance ??= create("CPU").catch(() => create("GPU"));
  instance.catch(() => {
    instance = null;
  });
  return instance;
}

export interface SegmentationResult {
  width: number;
  height: number;
  /** One category id (see CATEGORY) per pixel, row-major. */
  categories: Uint8Array;
}

export async function segmentImage(image: HTMLImageElement | HTMLCanvasElement): Promise<SegmentationResult> {
  const segmenter = await getSkinSegmenter();
  const result = segmenter.segment(image);
  const mask = result.categoryMask;
  if (!mask) throw new Error("Segmenter returned no category mask");
  const categories = new Uint8Array(mask.getAsUint8Array());
  const { width, height } = mask;
  result.close();
  return { width, height, categories };
}
