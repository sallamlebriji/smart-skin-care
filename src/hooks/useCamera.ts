import { useCallback, useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "requesting" | "active" | "denied" | "unsupported" | "error";

/**
 * Minimal getUserMedia wrapper: real camera access with proper stream
 * cleanup (spec §27). No face detection / quality scoring here yet — that
 * lands in Phase 2 alongside the FastAPI capture pipeline.
 */
export function useCamera(demoSrc?: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const operationRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("idle");

  const stop = useCallback(() => {
    operationRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    const operation = ++operationRef.current;
    // Dev-only: feed a prerecorded clip through the same pipeline when no camera is available.
    if (demoSrc && videoRef.current) {
      videoRef.current.src = demoSrc;
      videoRef.current.loop = true;
      await videoRef.current.play().catch(() => undefined);
      setStatus("active");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      if (operation !== operationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus("active");
    } catch (err) {
      if (operation !== operationRef.current) return;
      const name = (err as DOMException)?.name;
      setStatus(name === "NotAllowedError" ? "denied" : "error");
    }
  }, [demoSrc]);

  useEffect(() => stop, [stop]);

  return { videoRef, status, start, stop };
}
