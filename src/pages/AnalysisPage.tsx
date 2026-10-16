import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScanResultPanel from "@/components/scan/ScanResultPanel";
import FaceRegionExplorer from "@/components/scan/FaceRegionExplorer";
import { getScan, analyzeScan, analyzeWrinkles, scanImageUrl } from "@/services/scanService";
import { ApiError } from "@/lib/apiClient";
import { SAFETY_DISCLAIMER } from "@/content/safety";
import { useAuthStore } from "@/store/useAuthStore";

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const scanQuery = useQuery({
    queryKey: ["scan", id, user?.id ?? "guest"],
    queryFn: () => getScan(id!),
    enabled: !!id && !sessionLoading,
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

  const wrinkleMutation = useMutation({ mutationFn: () => analyzeWrinkles(id!) });

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
                    Analyse la photo avec les modèles disponibles. Les indicateurs sans modèle ne reçoivent aucun score.
                  </p>
                  <button
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending || wrinkleMutation.isPending}
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

              <FaceRegionExplorer imageUrl={scanImageUrl(scanQuery.data.scan_id, "front")} />

              <section style={{ margin: "24px 0", padding: 24, border: "1px solid var(--line)", borderRadius: 20 }}>
                <h2>Wrinkle detection · experimental</h2>
                <p>Analyze only the front photo for visible wrinkles. This separate binary model does not measure severity and does not affect appearance scores or routines.</p>
                {scanQuery.data.wrinkle_assessment && <div role="status">
                  <strong>{scanQuery.data.wrinkle_assessment.label === "wrinkle" ? "Wrinkles detected by the model" : "Wrinkles not detected by the model"}</strong>
                  <p>Wrinkle class probability: {(scanQuery.data.wrinkle_assessment.wrinkle_probability * 100).toFixed(1)}%. This is not a severity score or a calibrated clinical confidence.</p>
                  <small>Model: {scanQuery.data.wrinkle_assessment.model} · revision {scanQuery.data.wrinkle_assessment.revision.slice(0, 7)}</small>
                </div>}
                <button className="btn btn-primary" disabled={wrinkleMutation.isPending || analyzeMutation.isPending} onClick={() => wrinkleMutation.mutate()}>
                  {wrinkleMutation.isPending ? "Detecting wrinkles… First use may download the model." : scanQuery.data.wrinkle_assessment ? "Run wrinkle detection again" : "Detect wrinkles only"}
                </button>
                {wrinkleMutation.isError && <p role="alert">{wrinkleMutation.error instanceof Error ? wrinkleMutation.error.message : "Detection failed. Please retry."}</p>}
                <p><small>Community model; accuracy across skin tones, lighting and devices has not been independently validated here. A negative result does not rule out wrinkles.</small></p>
              </section>

              {scanQuery.data.result && (
                <div className="flex flex-col gap-6">
                  <button className="btn btn-primary" disabled={analyzeMutation.isPending || wrinkleMutation.isPending} onClick={() => analyzeMutation.mutate()}>
                    {analyzeMutation.isPending ? "Analyse des modèles en cours…" : "Recalculer avec les modèles disponibles"}
                  </button>
                  {analyzeError && <p role="alert">{analyzeError}</p>}
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
