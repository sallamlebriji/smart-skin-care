import { useEffect, useRef, useState, type RefObject } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { getFaceLandmarker } from "@/lib/faceLandmarker";
import { assessFrame, EMPTY_REPORT, type QualityReport, type ScanAngle } from "@/lib/faceQuality";

type ModelStatus = "loading" | "ready" | "error";

/** How long every check must pass continuously before a capture is allowed. */
const STABLE_MS = 1000;
const FRAME_INTERVAL_MS = 90;

/**
 * Runs real face landmark detection on the live video and turns each frame
 * into a quality report. Nothing is simulated: with no face, every check fails.
 */
export function useFaceScan(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  angle: ScanAngle = "front",
) {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const [report, setReport] = useState<QualityReport>(EMPTY_REPORT);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [stable, setStable] = useState(false);
  const [progress, setProgress] = useState(0);
  const okSince = useRef<number | null>(null);
  const angleRef = useRef(angle);

  useEffect(() => {
    angleRef.current = angle;
    okSince.current = null;
    setStable(false);
    setProgress(0);
  }, [angle]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer = 0;

    getFaceLandmarker()
      .then((landmarker) => {
        if (cancelled) return;
        setModelStatus("ready");
        let lastVideoTime = -1;

        const loop = () => {
          const now = performance.now();
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          if (video.currentTime === lastVideoTime) return;
          lastVideoTime = video.currentTime;

          const result = landmarker.detectForVideo(video, now);
          const face = result.faceLandmarks[0] ?? null;
          const next = assessFrame(face, video, angleRef.current);

          setLandmarks(face);
          setReport(next);

          if (next.allOk) {
            okSince.current ??= now;
            const held = now - okSince.current;
            setProgress(Math.min(1, held / STABLE_MS));
            setStable(held >= STABLE_MS);
          } else {
            okSince.current = null;
            setProgress(0);
            setStable(false);
          }

          if (import.meta.env.DEV) (window as unknown as { __scan?: QualityReport }).__scan = next;
        };
        timer = window.setInterval(loop, FRAME_INTERVAL_MS);
      })
      .catch(() => !cancelled && setModelStatus("error"));

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      okSince.current = null;
      setStable(false);
      setLandmarks(null);
      setReport(EMPTY_REPORT);
    };
  }, [active, videoRef]);

  return { modelStatus, report, landmarks, stable, progress };
}
