import { useEffect, useRef, useState } from "react";
import { computeRegionPolygons, REGION_COLOR, REGION_LABEL, type RegionId } from "@/lib/faceRegions";
import { segmentImage } from "@/lib/skinSegmenter";
import { analyzeRegions, type RegionStats } from "@/lib/regionAnalysis";
import type { Shot } from "./CameraScan";

/**
 * `HTMLImageElement.decode()` can hang indefinitely on a backgrounded tab in
 * some browsers (it's a paint-readiness hint, not a load event) — a real risk
 * here since this runs right after upload finishes, when a user may well have
 * switched tabs. `load`/`complete` reflect data readiness instead and don't
 * have that caveat.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
    if (img.complete && img.naturalWidth > 0) resolve(img);
  });
}

type State = "loading" | "ready" | "error";

/**
 * Draws the captured front photo with each face region traced from real
 * landmark polygons, clipped to actual skin pixels via neural segmentation
 * (hair, glasses, and background are excluded). Purely descriptive image
 * statistics — not a skin diagnosis; see SAFETY_DISCLAIMER.
 */
export default function FaceRegionMap({ shot }: { shot: Shot }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<State>("loading");
  const [stats, setStats] = useState<RegionStats[]>([]);
  const [hover, setHover] = useState<RegionId | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!shot.landmarks) {
      setState("error");
      return;
    }

    (async () => {
      const img = await loadImage(shot.url);

      const canvas = document.createElement("canvas");
      canvas.width = shot.width;
      canvas.height = shot.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);

      const polygons = computeRegionPolygons(shot.landmarks!, shot.width, shot.height);
      const segmentation = await segmentImage(img);
      const results = analyzeRegions(canvas, polygons, segmentation);
      if (cancelled) return;

      const view = canvasRef.current;
      if (view) {
        view.width = shot.width;
        view.height = shot.height;
        const ctx = view.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        for (const region of polygons) {
          ctx.beginPath();
          region.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
          ctx.fillStyle = REGION_COLOR[region.id] + "55";
          ctx.fill();
          ctx.strokeStyle = REGION_COLOR[region.id];
          ctx.lineWidth = Math.max(2, shot.width / 220);
          ctx.stroke();
        }
      }

      setStats(results);
      setState("ready");
    })().catch((e) => {
      if (import.meta.env.DEV) console.error("FaceRegionMap failed:", e);
      if (!cancelled) setState("error");
    });

    return () => {
      cancelled = true;
    };
    // Re-running only on a new shot is intentional: recomputation is expensive and the shot is immutable once captured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot.url]);

  return (
    <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", overflow: "hidden", background: "#fff" }}>
      <div className="relative" style={{ aspectRatio: "3 / 4", background: "linear-gradient(160deg, #fff, var(--rose-tint))" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", opacity: state === "ready" ? 1 : 0.3, transition: "opacity 0.3s ease" }}
        />
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-faint)" }}>
            Mapping skin regions…
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-faint)" }}>
            Region map unavailable for this capture
          </div>
        )}
      </div>

      {state === "ready" && (
        <div style={{ padding: 16, borderTop: "1px solid var(--line)" }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 10 }}>
            Visual indicators by region — not a diagnosis
          </p>
          <div className="flex flex-col gap-2">
            {stats.map((s) => (
              <div
                key={s.id}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                className="flex items-center gap-3"
                style={{ fontSize: 13, padding: "4px 6px", borderRadius: 8, background: hover === s.id ? "var(--bg)" : "transparent" }}
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: REGION_COLOR[s.id], flexShrink: 0 }} />
                <span style={{ fontWeight: 600, minWidth: 108 }}>{REGION_LABEL[s.id]}</span>
                {s.sampleCount < 40 ? (
                  <span style={{ color: "var(--ink-faint)" }}>Not enough visible skin to measure</span>
                ) : (
                  <span style={{ color: "var(--ink-faint)" }}>
                    tone {(s.luma * 100).toFixed(0)}% · texture {s.texture < 15 ? "smooth" : s.texture < 45 ? "moderate" : "uneven"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
