import type { SkinScanResult, SkinMetrics } from "@/types/skin";

const METRIC_LABEL: Record<keyof SkinMetrics, string> = {
  acne: "Acne",
  redness: "Redness",
  pigmentation: "Pigmentation",
  pores: "Pores",
  texture: "Texture",
  wrinkles: "Wrinkles",
  scars: "Scars",
  uniformity: "Uniformity",
};

/**
 * Renders a SkinScanResult with every metric honestly labeled real vs.
 * placeholder — `mock_metrics` is the source of truth, not a blanket
 * "AI analysis complete" claim. See acne_model.py for what "real" means here.
 */
export default function ScanResultPanel({ result }: { result: SkinScanResult }) {
  const metrics = Object.entries(result.metrics) as [keyof SkinMetrics, number][];

  return (
    <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", background: "#fff", padding: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
          Scan analysis
        </p>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--rose-deep)" }}>{result.overall_score.toFixed(0)}/100</span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 16 }}>
        Visual, camera-derived indicators — not a medical diagnosis. Metrics marked{" "}
        <em>placeholder</em> below aren't from a trained model yet.
      </p>

      <div className="flex flex-col gap-3">
        {metrics.map(([key, score]) => {
          const isMock = result.mock_metrics.includes(key);
          return (
            <div key={key}>
              <div className="flex items-center justify-between" style={{ fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{METRIC_LABEL[key]}</span>
                <span style={{ color: "var(--ink-faint)", display: "flex", alignItems: "center", gap: 6 }}>
                  {isMock && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "var(--bg)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      placeholder
                    </span>
                  )}
                  {score.toFixed(0)}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${score}%`,
                    borderRadius: 4,
                    background: isMock ? "var(--ink-faint)" : "linear-gradient(90deg, var(--rose-deep), var(--lilac))",
                    opacity: isMock ? 0.35 : 1,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 16, lineHeight: 1.5 }}>
        Acne is scored by a public, MIT-licensed community model (not independently clinically
        validated). Every other metric above is still a placeholder until its own model is trained.
      </p>
    </div>
  );
}
