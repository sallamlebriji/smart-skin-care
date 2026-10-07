import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let instance: Promise<FaceLandmarker> | null = null;

async function create(delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
    runningMode: "VIDEO",
    numFaces: 1,
  });
}

/** Lazy singleton: the ~4 MB model and WASM runtime only load when /scan needs them. */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  instance ??= create("GPU").catch(() => create("CPU"));
  instance.catch(() => {
    instance = null;
  });
  return instance;
}
