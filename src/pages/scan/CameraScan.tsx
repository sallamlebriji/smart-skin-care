import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Circle, ShieldAlert, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useCamera } from "@/hooks/useCamera";
import { useFaceScan } from "@/hooks/useFaceScan";
import { uploadScan, deleteScan, analyzeScan, scanImageUrl, type UploadedScan } from "@/services/scanService";
import type { ScanAngle } from "@/lib/faceQuality";
import type { SkinScanResult } from "@/types/skin";
import FaceRegionMap from "./FaceRegionMap";
import ScanResultPanel from "@/components/scan/ScanResultPanel";
import FaceRegionExplorer from "@/components/scan/FaceRegionExplorer";
import demoVideo from "@/assets/videos/hero.mp4";

const ANGLES: ScanAngle[] = ["front", "left", "right"];

const INSTRUCTION: Record<ScanAngle, string> = {
  front: "Look straight at the camera",
  left: "Turn your face slightly left",
  right: "Turn your face slightly right",
};

const CAMERA_TIPS = [
  "Remove glasses",
  "Avoid heavy makeup",
  "Use consistent, even lighting",
  "Keep your face centered",
  "Keep the device at a moderate distance",
];

const CHECKS = [
  { key: "lighting", label: "Lighting" },
  { key: "position", label: "Face position" },
  { key: "visibility", label: "Face visibility" },
  { key: "quality", label: "Image quality" },
] as const;

export interface Shot {
  blob: Blob;
  url: string;
  quality: unknown;
  landmarks: NormalizedLandmark[] | null;
  width: number;
  height: number;
}

type Phase = "capturing" | "uploading" | "done" | "error" | "deleted";

const isDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");

export default function CameraScan({ onBack }: { onBack: () => void }) {
  const { videoRef, status, start, stop } = useCamera(isDemo ? demoVideo : undefined);
  const active = status === "active";
  const [consent, setConsent] = useState(false);
  const [angleIdx, setAngleIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("capturing");
  const [shots, setShots] = useState<Partial<Record<ScanAngle, Shot>>>({});
  const [result, setResult] = useState<UploadedScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SkinScanResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const angle = ANGLES[Math.min(angleIdx, 2)];
  const capturing = active && phase === "capturing";
  const { modelStatus, report, landmarks, stable, progress } = useFaceScan(videoRef, capturing, angle);

  useEffect(() => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;
    ctx.fillStyle = report.allOk ? "rgba(47,184,136,0.9)" : "rgba(255,255,255,0.75)";
    const r = Math.max(1.4, canvas.width / 380);
    for (let i = 0; i < landmarks.length; i += 5) {
      ctx.beginPath();
      ctx.arc(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks, report.allOk, videoRef]);

  const send = async (all: Record<ScanAngle, Shot>) => {
    setPhase("uploading");
    setError(null);
    stop();
    try {
      const images = { front: all.front.blob, left: all.left.blob, right: all.right.blob };
      const quality = { front: all.front.quality, left: all.left.quality, right: all.right.quality };
      setResult(await uploadScan(images, quality));
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("error");
    }
  };

  const captureCurrent = async () => {
    const video = videoRef.current;
    if (!video || busy.current) return;
    busy.current = true;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.92));
    if (!blob) {
      busy.current = false;
      return;
    }
    const next = {
      ...shots,
      [angle]: { blob, url: URL.createObjectURL(blob), quality: report.metrics, landmarks, width: c.width, height: c.height },
    };
    setShots(next);
    if (angleIdx < 2) {
      setAngleIdx(angleIdx + 1);
      window.setTimeout(() => (busy.current = false), 1200);
    } else {
      busy.current = false;
      await send(next as Record<ScanAngle, Shot>);
    }
  };

  useEffect(() => {
    if (stable && capturing) void captureCurrent();
    // captureCurrent closes over the latest state on every render; only `stable` should trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stable]);

  useEffect(
    () => () => Object.values(shotsRef.current).forEach((s) => s && URL.revokeObjectURL(s.url)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const restart = () => {
    Object.values(shots).forEach((s) => s && URL.revokeObjectURL(s.url));
    setShots({});
    setAngleIdx(0);
    setResult(null);
    setError(null);
    setAnalysis(null);
    setAnalyzeError(null);
    setPhase("capturing");
    void start();
  };

  const remove = async () => {
    if (!result) return;
    try {
      await deleteScan(result.scan_id);
      setPhase("deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the scan");
    }
  };

  const runAnalysis = async () => {
    if (!result) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      setAnalysis(await analyzeScan(result.scan_id));
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  let label = "READY";
  if (status === "requesting") label = "CHECKING CAMERA";
  else if (phase === "uploading") label = "PROCESSING";
  else if (phase === "done") label = "UPLOADED";
  else if (phase === "deleted") label = "DELETED";
  else if (phase === "error") label = "UPLOAD FAILED";
  else if (active && modelStatus === "loading") label = "LOADING FACE MODEL";
  else if (active && !report.faceFound) label = "POSITION YOUR FACE";
  else if (active && !report.allOk) label = `FACE DETECTED — ADJUST`;
  else if (active) label = `SCANNING ${angle.toUpperCase()}`;

  const hint =
    capturing && report.faceFound
      ? CHECKS.map((c) => report[c.key]).find((c) => !c.ok)?.hint ?? "Perfect — hold still"
      : null;

  const captured = Object.keys(shots).length;
  const overall = phase === "capturing" ? (captured + (capturing ? progress : 0)) / 3 : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={() => {
          stop();
          onBack();
        }}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 32 }}
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 items-center">
        <div>
          <span className="eyebrow" style={{ marginBottom: 20, display: "inline-flex" }}>
            Step 2 of 3 · {label}
          </span>
          <h2 style={{ fontSize: 30, marginBottom: 16 }}>
            {phase === "capturing" && active ? INSTRUCTION[angle] : phase === "capturing" ? "Get ready" : "Your scan"}
          </h2>

          <div className="flex gap-2 mb-5" aria-label="Capture progress">
            {ANGLES.map((a, i) => (
              <span
                key={a}
                className="flex items-center gap-2"
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 700,
                  textTransform: "capitalize",
                  border: "1px solid var(--line)",
                  background: shots[a] ? "var(--mint-soft)" : i === angleIdx && phase === "capturing" ? "var(--rose-soft)" : "var(--surface)",
                  color: shots[a] ? "var(--mint)" : i === angleIdx && phase === "capturing" ? "var(--rose-deep)" : "var(--ink-faint)",
                }}
              >
                {shots[a] && <Check size={13} strokeWidth={3} />} {a}
              </span>
            ))}
          </div>

          <div style={{ height: 4, borderRadius: 4, background: "var(--line)", overflow: "hidden", marginBottom: 24 }}>
            <div style={{ height: "100%", width: `${overall * 100}%`, background: "linear-gradient(90deg, var(--rose-deep), var(--lilac))", transition: "width 0.3s ease" }} />
          </div>

          {status === "idle" && phase === "capturing" && (
            <>
              <ul className="flex flex-col gap-3 mb-6">
                {CAMERA_TIPS.map((tip) => (
                  <li key={tip} className="flex items-center gap-3" style={{ fontSize: 15, color: "var(--ink-soft)" }}>
                    <Check size={16} color="var(--mint)" strokeWidth={3} /> {tip}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-3 mb-6" style={{ fontSize: 13.5, color: "var(--ink-soft)", cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  I consent to my face images being processed to generate this skin analysis. Images stay private and
                  can be deleted at any time.
                </span>
              </label>
              <button onClick={start} disabled={!consent} className="btn btn-primary" style={{ opacity: consent ? 1 : 0.4 }}>
                Enable camera
              </button>
            </>
          )}

          {capturing && (
            <>
              <ul className="flex flex-col gap-3 mb-5">
                {CHECKS.map(({ key, label: name }) => {
                  const c = report[key];
                  return (
                    <li key={key} className="flex items-center gap-3" style={{ fontSize: 15 }}>
                      {c.ok ? <Check size={18} color="var(--mint)" strokeWidth={3} /> : <Circle size={18} color="var(--ink-faint)" />}
                      <span style={{ fontWeight: 600, minWidth: 118 }}>{name}</span>
                      <span style={{ color: c.ok ? "var(--mint)" : "var(--ink-faint)", fontSize: 13 }}>{c.hint}</span>
                    </li>
                  );
                })}
              </ul>
              {hint && <p style={{ fontWeight: 600, color: "var(--ink)" }}>{hint}</p>}
              <p style={{ fontSize: 12.5, marginTop: 6 }}>Capture is automatic once everything is good — no need to move quickly.</p>
              {isDemo && (
                <button onClick={() => void captureCurrent()} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                  Dev: capture this frame
                </button>
              )}
            </>
          )}

          {status === "requesting" && <p style={{ fontWeight: 600 }}>Requesting camera access…</p>}
          {status === "denied" && (
            <p style={{ color: "#c0392b", display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={16} /> Camera access was denied. Enable it in your browser settings to continue.
            </p>
          )}
          {(status === "unsupported" || status === "error") && (
            <p style={{ color: "#c0392b" }}>
              {status === "unsupported" ? "Your browser doesn't support camera access." : "Couldn't start the camera. Check that no other app is using it."}
            </p>
          )}
          {active && modelStatus === "error" && <p style={{ color: "#c0392b" }}>Face detection couldn't load. Refresh the page and try again.</p>}

          {phase === "uploading" && <p style={{ fontWeight: 600 }}>Uploading your three angles securely…</p>}

          {phase === "done" && result && (
            <div>
              <div className="flex gap-3 mb-4">
                {ANGLES.map((a) => (
                  <img key={a} src={shots[a]?.url} alt={`${a} angle`} style={{ width: 72, height: 96, objectFit: "cover", borderRadius: 14, transform: "scaleX(-1)" }} />
                ))}
              </div>
              <p style={{ fontWeight: 700, color: "var(--ink)" }}>All three angles captured and uploaded</p>
              <p style={{ fontSize: 13.5, marginTop: 4 }}>
                Scan <code>{result.scan_id}</code> is stored privately.
                {!analysis && " Lancez l’analyse pour obtenir les prédictions des modèles disponibles et les mesures d’image."}
              </p>

              {!analysis && (
                <button onClick={() => void runAnalysis()} disabled={analyzing} className="btn btn-primary btn-sm mt-4" style={{ opacity: analyzing ? 0.6 : 1 }}>
                  {analyzing ? "Analyzing…" : "Analyze my skin"}
                </button>
              )}
              {analyzeError && (
                <p style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>
                  Couldn't analyze ({analyzeError}).{" "}
                  <button onClick={() => void runAnalysis()} className="btn btn-ghost btn-sm" style={{ display: "inline-flex", marginLeft: 4 }}>
                    Retry
                  </button>
                </p>
              )}
              {analysis && (
                <div style={{ marginTop: 16, marginBottom: 4 }}>
                  <ScanResultPanel result={analysis} />
                  <Link to={`/analysis/${result.scan_id}`} className="btn btn-ghost btn-sm mt-3">
                    <ExternalLink size={14} /> View full report
                  </Link>
                </div>
              )}

              <FaceRegionExplorer imageUrl={scanImageUrl(result.scan_id, "front")} showMap={false} />
              <div className="flex gap-3 mt-4">
                <button onClick={restart} className="btn btn-ghost btn-sm">
                  <RotateCcw size={14} /> New scan
                </button>
                <button onClick={remove} className="btn btn-ghost btn-sm">
                  <Trash2 size={14} /> Delete this scan
                </button>
              </div>
            </div>
          )}

          {phase === "deleted" && (
            <div>
              <p style={{ fontWeight: 700, color: "var(--ink)" }}>Scan and images deleted</p>
              <button onClick={restart} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                <RotateCcw size={14} /> Start a new scan
              </button>
            </div>
          )}

          {phase === "error" && (
            <div>
              <p style={{ color: "#c0392b", marginBottom: 12 }}>
                Couldn't upload the scan ({error}). Is the backend running on {import.meta.env.VITE_API_URL ?? "http://localhost:8000"}?
              </p>
              <div className="flex gap-3">
                <button onClick={() => void send(shots as Record<ScanAngle, Shot>)} className="btn btn-primary btn-sm">
                  Retry upload
                </button>
                <button onClick={restart} className="btn btn-ghost btn-sm">
                  Start over
                </button>
              </div>
            </div>
          )}
          {phase === "done" && error && <p style={{ color: "#c0392b", marginTop: 8 }}>{error}</p>}
        </div>

        {phase === "done" && shots.front?.landmarks ? (
          <FaceRegionMap shot={shots.front} />
        ) : (
          <div
            className="relative overflow-hidden"
            style={{ aspectRatio: "3 / 4", borderRadius: "var(--radius-xl)", background: "linear-gradient(160deg, #fff, var(--rose-tint))", border: "1px solid var(--line)" }}
          >
            <div style={{ position: "absolute", inset: 0, transform: "scaleX(-1)" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: active ? 1 : 0, transition: "opacity 0.4s ease" }}
              />
              <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            {capturing && (
              <svg viewBox="0 0 100 133" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <path d="M0 0H100V133H0Z M50 12C68 12 79 32 79 58C79 88 67 112 50 112C33 112 21 88 21 58C21 32 32 12 50 12Z" fill="rgba(18,17,19,0.35)" fillRule="evenodd" />
                <ellipse cx="50" cy="62" rx="29" ry="50" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.9" strokeDasharray="2.5 2" />
                <ellipse
                  cx="50"
                  cy="62"
                  rx="29"
                  ry="50"
                  fill="none"
                  stroke="#2fb888"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={`${progress * 100} 100`}
                  transform="rotate(-90 50 62)"
                  style={{ transition: "stroke-dasharray 0.1s linear" }}
                />
              </svg>
            )}

            {!active && phase === "capturing" && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--ink-faint)", fontSize: 14, fontWeight: 600 }}>
                Camera preview appears here
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
