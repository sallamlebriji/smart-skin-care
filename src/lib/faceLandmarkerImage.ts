import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let instance: Promise<FaceLandmarker> | null = null;

async function create(delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
    runningMode: "IMAGE",
    numFaces: 1,
  });
}

/**
 * Separate singleton from faceLandmarker.ts's VIDEO-mode one: MediaPipe
 * requires a landmarker's `runningMode` to match detect() vs detectForVideo()
 * calls, and the /analysis dashboard runs detection once on a static stored
 * photo rather than a live camera stream.
 */
export function getFaceLandmarkerImage(): Promise<FaceLandmarker> {
  instance ??= create("CPU"); // one-shot still-image job; avoid GPU/hidden-tab stalls (see skinSegmenter.ts)
  instance.catch(() => {
    instance = null;
  });
  return instance;
}
