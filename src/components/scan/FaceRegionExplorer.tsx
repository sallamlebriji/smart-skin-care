import { useEffect, useRef, useState } from "react";
import { computeRegionPolygons, REGION_COLOR, REGION_LABEL, type RegionId, type RegionPolygon } from "@/lib/faceRegions";
import { getFaceLandmarkerImage } from "@/lib/faceLandmarkerImage";
import { segmentImage } from "@/lib/skinSegmenter";
import { analyzeRegions, type RegionStats } from "@/lib/regionAnalysis";

type State = "loading" | "ready" | "no-face" | "error";

/**
 * `HTMLImageElement.decode()` can hang on a backgrounded tab in some
 * browsers — see FaceRegionMap.tsx for the same fix applied there.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
    if (img.complete && img.naturalWidth > 0) resolve(img);
  });
}

/**
 * Interactive per-region skin map for the /analysis dashboard: fetches the
 * scan's stored front photo, runs real face-landmark detection + neural skin
 * segmentation on it (see faceRegions.ts / skinSegmenter.ts), and lets the
 * viewer click a region on the photo or in the list to inspect it. Purely
 * descriptive image statistics — not a diagnosis; see SAFETY_DISCLAIMER.
 */
export default function FaceRegionExplorer({ imageUrl }: { imageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const polygonsRef = useRef<RegionPolygon[]>([]);
  const [state, setState] = useState<State>("loading");
  const [stats, setStats] = useState<RegionStats[]>([]);
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setSelected(null);

    (async () => {
      const img = await loadImage(imageUrl);
      const landmarker = await getFaceLandmarkerImage();
      const detection = landmarker.detect(img);
      const face = detection.faceLandmarks[0];
      if (!face) {
        if (!cancelled) setState("no-face");
        return;
      }

      const polygons = computeRegionPolygons(face, img.naturalWidth, img.naturalHeight);
      const segmentation = await segmentImage(img);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const results = analyzeRegions(canvas, polygons, segmentation);
      if (cancelled) return;

      polygonsRef.current = polygons;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });

      const view = canvasRef.current;
      if (view) {
        view.width = img.naturalWidth;
        view.height = img.naturalHeight;
        view.getContext("2d")!.drawImage(img, 0, 0);
      }

      setStats(results);
      setState("ready");
    })().catch(() => !cancelled && setState("error"));

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Redraw region overlays whenever the selection changes, without re-running detection/segmentation.
  useEffect(() => {
    const view = canvasRef.current;
    if (!view || state !== "ready") return;
    const ctx = view.getContext("2d");
    if (!ctx) return;

    loadImage(imageUrl)
      .then((img) => {
        ctx.clearRect(0, 0, view.width, view.height);
        ctx.drawImage(img, 0, 0);
        for (const region of polygonsRef.current) {
          const isSelected = region.id === selected;
          ctx.beginPath();
          region.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
          ctx.fillStyle = REGION_COLOR[region.id] + (isSelected ? "88" : selected ? "22" : "55");
          ctx.fill();
          ctx.strokeStyle = REGION_COLOR[region.id];
          ctx.lineWidth = Math.max(2, view.width / 220) * (isSelected ? 1.6 : 1);
          ctx.stroke();
        }
      })
      .catch(() => undefined);
  }, [selected, state, imageUrl]);

  function pointInPolygon(x: number, y: number, points: { x: number; y: number }[]) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * natural.w;
    const y = ((e.clientY - rect.top) / rect.height) * natural.h;
    const hit = polygonsRef.current.find((r) => pointInPolygon(x, y, r.points));
    setSelected(hit ? (hit.id === selected ? null : hit.id) : null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr] gap-6 items-start">
      <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", overflow: "hidden", background: "#fff" }}>
        <div className="relative" style={{ aspectRatio: "3 / 4", background: "linear-gradient(160deg, #fff, var(--rose-tint))" }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ width: "100%", height: "100%", objectFit: "cover", cursor: state === "ready" ? "pointer" : "default", opacity: state === "ready" ? 1 : 0.3, transition: "opacity 0.3s ease" }}
          />
          {state === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-faint)" }}>
              Mapping skin regions…
            </div>
          )}
          {state === "no-face" && (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-faint)" }}>
              No face detected in this photo
            </div>
          )}
          {state === "error" && (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-faint)" }}>
              Region map unavailable
            </div>
          )}
        </div>
      </div>

      <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", background: "#fff", padding: 18 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 12 }}>
          Tap a region — visual indicators, not a diagnosis
        </p>
        {state !== "ready" ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>—</p>
        ) : (
          <div className="flex flex-col gap-1">
            {stats.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id === selected ? null : s.id)}
                className="flex items-center gap-3 text-left"
                style={{
                  fontSize: 13,
                  padding: "8px 8px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: selected === s.id ? "var(--bg)" : "transparent",
                }}
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
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
