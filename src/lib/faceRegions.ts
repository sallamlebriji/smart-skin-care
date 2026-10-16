import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { convexHull, polygonArea, type Point } from "./geometry";

export type RegionId = "forehead" | "cheekLeft" | "cheekRight" | "nose" | "chin";

/**
 * MediaPipe FaceLandmarker (468-point mesh) indices per region, picked and
 * verified visually against real photos (see backend prototyping notes).
 * Cheek/forehead sides are mirrored: "left"/"right" are the subject's own
 * left/right, which appear on the opposite side of a front-facing photo.
 */
export const REGION_LANDMARKS: Record<RegionId, number[]> = {
  forehead: [21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 301, 300, 293, 334, 296, 336, 9, 107, 66, 105, 63, 70, 71],
  cheekRight: [116, 117, 118, 101, 36, 205, 187, 123, 50, 207, 147, 177, 215, 138, 137],
  cheekLeft: [345, 346, 347, 330, 266, 425, 411, 352, 280, 427, 376, 401, 435, 367, 366],
  nose: [168, 193, 245, 188, 174, 236, 198, 209, 49, 64, 98, 97, 2, 326, 327, 294, 278, 429, 420, 456, 399, 465, 197, 195, 5, 4, 1, 19, 94],
  chin: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 61, 146, 91, 181, 84, 17, 314, 405, 321, 291],
};

export const REGION_COLOR: Record<RegionId, string> = {
  forehead: "#7c6fe0",
  cheekRight: "#2fb888",
  cheekLeft: "#e0708f",
  nose: "#3fb6c9",
  chin: "#d98fd0",
};

export const REGION_LABEL: Record<RegionId, string> = {
  forehead: "Forehead",
  cheekRight: "Cheek (right)",
  cheekLeft: "Cheek (left)",
  nose: "Nose",
  chin: "Chin",
};

export interface RegionPolygon {
  id: RegionId;
  points: Point[];
  areaPx: number;
}

/** Ordered feature contours removed from skin samples, regardless of the segmentation class. */
export function excludedFeaturePolygons(landmarks: NormalizedLandmark[], width: number, height: number): Point[][] {
  const contours = [
    [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
    [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
    [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
    [336, 296, 334, 293, 300, 276, 283, 282, 295, 285],
  ];
  return contours.map(contour => contour.map(i => ({ x: landmarks[i].x * width, y: landmarks[i].y * height })));
}

/** Forehead's landmark list is already an ordered boundary; every other
 * region is convex-hulled since its indices aren't stored in walk order. */
export function computeRegionPolygons(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): RegionPolygon[] {
  return (Object.keys(REGION_LANDMARKS) as RegionId[]).map((id) => {
    const raw = REGION_LANDMARKS[id].map((i) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height }));
    const points = id === "forehead" ? raw : convexHull(raw);
    return { id, points, areaPx: polygonArea(points) };
  });
}
