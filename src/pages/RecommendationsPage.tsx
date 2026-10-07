import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getRecommendations } from "@/services/recommendationService";
import { ApiError } from "@/lib/apiClient";
import { SAFETY_DISCLAIMER } from "@/content/safety";
import type { RecommendationPriority } from "@/types/skin";

const PRIORITY_LABEL: Record<RecommendationPriority, string> = { high: "High priority", medium: "Medium priority", low: "Low priority" };
const PRIORITY_COLOR: Record<RecommendationPriority, string> = { high: "#c0392b", medium: "var(--rose-deep)", low: "var(--ink-faint)" };
const TYPE_LABEL: Record<string, string> = { ingredient: "Ingredient", product: "Product", habit: "Habit" };

export default function RecommendationsPage() {
  const [params] = useSearchParams();
  const scanId = params.get("scan_id");

  const query = useQuery({
    queryKey: ["recommendations", scanId],
    queryFn: () => getRecommendations(scanId!),
    enabled: !!scanId,
    // 404/409 are deterministic (not found / not analyzed yet) — retrying wastes time and
    // leaves the UI showing nothing during the backoff gap between isPending and isError.
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
  });

  return (
    <>
      <Navbar />
      <main className="section" style={{ minHeight: "75vh" }}>
        <div className="container" style={{ maxWidth: 760 }}>
          {scanId && (
            <Link to={`/analysis/${scanId}`} className="btn btn-ghost btn-sm" style={{ marginBottom: 28 }}>
              <ArrowLeft size={15} /> Back to analysis
            </Link>
          )}

          {!scanId && <MissingScanState />}

          {scanId && query.isPending && <p style={{ fontWeight: 600, color: "var(--ink-faint)" }}>Loading recommendations…</p>}

          {scanId && query.isError && (
            <ErrorState scanId={scanId} status={query.error instanceof ApiError ? query.error.status : undefined} />
          )}

          {query.data && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="section-head" style={{ textAlign: "left", margin: "0 0 28px" }}>
                <span className="eyebrow">
                  <Sparkles size={13} /> Based on your scan
                </span>
                <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>Your recommendations</h1>
                <p className="lede">Rule-based suggestions from what your scan visibly showed — not a prescription.</p>
              </div>

              {query.data.recommendations.length === 0 ? (
                <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", background: "#fff", padding: 32, textAlign: "center" }}>
                  <p style={{ fontWeight: 700 }}>Nothing stood out from this scan</p>
                  <p style={{ fontSize: 13.5, color: "var(--ink-faint)", marginTop: 6 }}>
                    Every indicator scored well above our threshold. A consistent basic routine is still worthwhile.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {query.data.recommendations.map((rec) => {
                    const isMock = query.data.mock_goals.includes(rec.goal);
                    return (
                      <div key={rec.goal} style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", background: "#fff", padding: 20 }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                          <h3 style={{ fontSize: 16 }}>{rec.goal}</h3>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: PRIORITY_COLOR[rec.priority] }}>{PRIORITY_LABEL[rec.priority]}</span>
                        </div>
                        {isMock && (
                          <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 10 }}>
                            Based on a placeholder metric — not a real measurement yet.
                          </p>
                        )}
                        <ul className="flex flex-col gap-2" style={{ marginTop: 10 }}>
                          {rec.recommendations.map((item) => (
                            <li key={item.name} style={{ fontSize: 13.5 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.03em",
                                  color: "var(--rose-deep)",
                                  marginRight: 8,
                                }}
                              >
                                {TYPE_LABEL[item.type]}
                              </span>
                              <strong>{item.name}</strong>
                              {item.reason && <span style={{ color: "var(--ink-faint)" }}> — {item.reason}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-center" style={{ marginTop: 28 }}>
                <Link to={`/routine?scan_id=${scanId}`} className="btn btn-primary">
                  Build my routine <ArrowRight size={15} />
                </Link>
              </div>

              <p className="text-center" style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 24 }}>
                {SAFETY_DISCLAIMER}
              </p>
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function MissingScanState() {
  return (
    <div className="text-center" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>No scan selected</h1>
      <p className="lede" style={{ marginBottom: 24 }}>Recommendations are generated from a specific scan. Start or open one first.</p>
      <Link to="/scan" className="btn btn-primary">Start a scan</Link>
    </div>
  );
}

function ErrorState({ scanId, status }: { scanId: string; status?: number }) {
  if (status === 409) {
    return (
      <div className="text-center" style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, marginBottom: 10 }}>This scan hasn't been analyzed yet</h1>
        <p className="lede" style={{ marginBottom: 24 }}>Run analysis first, then come back for recommendations.</p>
        <Link to={`/analysis/${scanId}`} className="btn btn-primary">Go analyze it</Link>
      </div>
    );
  }
  return (
    <div className="text-center" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>{status === 404 ? "Scan not found" : "Couldn't load recommendations"}</h1>
      <p className="lede" style={{ marginBottom: 24 }}>
        {status === 404 ? "This scan doesn't exist, or it's already been deleted." : "Something went wrong. Try again in a moment."}
      </p>
      <Link to="/scan" className="btn btn-primary">Start a new scan</Link>
    </div>
  );
}
