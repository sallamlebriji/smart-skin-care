import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScanResultPanel from "@/components/scan/ScanResultPanel";
import FaceRegionExplorer from "@/components/scan/FaceRegionExplorer";
import { getScan, analyzeScan, scanImageUrl } from "@/services/scanService";
import { ApiError } from "@/lib/apiClient";
import { SAFETY_DISCLAIMER } from "@/content/safety";

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const scanQuery = useQuery({
    queryKey: ["scan", id],
    queryFn: () => getScan(id!),
    enabled: !!id,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeScan(id!),
    onSuccess: () => {
      setAnalyzeError(null);
      void queryClient.invalidateQueries({ queryKey: ["scan", id] });
    },
    onError: (e) => setAnalyzeError(e instanceof Error ? e.message : "Analysis failed"),
  });

  return (
    <>
      <Navbar />
      <main className="section" style={{ minHeight: "75vh" }}>
        <div className="container" style={{ maxWidth: 1040 }}>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 28 }}>
            <ArrowLeft size={15} /> Back to home
          </Link>

          {scanQuery.isPending && <p style={{ fontWeight: 600, color: "var(--ink-faint)" }}>Loading scan…</p>}

          {scanQuery.isError && (
            <div className="text-center" style={{ maxWidth: 420, margin: "0 auto" }}>
              <h1 style={{ fontSize: 26, marginBottom: 10 }}>Scan not found</h1>
              <p className="lede" style={{ marginBottom: 24 }}>
                {scanQuery.error instanceof ApiError && scanQuery.error.status === 404
                  ? "This scan doesn't exist, or it's already been deleted."
                  : `Couldn't load this scan (${scanQuery.error instanceof Error ? scanQuery.error.message : "unknown error"}).`}
              </p>
              <Link to="/scan" className="btn btn-primary">
                Start a new scan
              </Link>
            </div>
          )}

          {scanQuery.data && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="section-head" style={{ textAlign: "left", margin: "0 0 28px" }}>
                <span className="eyebrow">Step 3 of 3</span>
                <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>Your scan analysis</h1>
                <p className="lede">Scan {scanQuery.data.scan_id} · captured via {scanQuery.data.capture_mode}</p>
              </div>

              {!scanQuery.data.result && (
                <div style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", background: "#fff", padding: 32, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
                  <p style={{ fontWeight: 700, marginBottom: 8 }}>This scan hasn't been analyzed yet</p>
                  <p style={{ fontSize: 13.5, color: "var(--ink-faint)", marginBottom: 20 }}>
                    Runs a real acne-severity model on the front photo. Other indicators are still placeholders — see the
                    breakdown once it's done.
                  </p>
                  <button
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                    className="btn btn-primary"
                    style={{ opacity: analyzeMutation.isPending ? 0.6 : 1 }}
                  >
                    <Sparkles size={15} /> {analyzeMutation.isPending ? "Analyzing… (can take up to a minute)" : "Analyze this scan"}
                  </button>
                  {analyzeError && (
                    <p style={{ color: "#c0392b", fontSize: 13, marginTop: 12 }}>Couldn't analyze ({analyzeError}).</p>
                  )}
                </div>
              )}

              {scanQuery.data.result && (
                <div className="flex flex-col gap-6">
                  <FaceRegionExplorer imageUrl={scanImageUrl(scanQuery.data.scan_id, "front")} />
                  <div style={{ maxWidth: 480 }}>
                    <ScanResultPanel result={scanQuery.data.result} />
                  </div>
                  <div className="flex justify-center">
                    <Link to={`/recommendations?scan_id=${scanQuery.data.scan_id}`} className="btn btn-primary">
                      See my recommendations <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              )}

              <p className="text-center" style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 32 }}>
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
