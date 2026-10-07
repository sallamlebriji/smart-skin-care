import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSkinStore } from "@/store/useSkinStore";
import { deleteScan } from "@/services/scanService";
import { SAFETY_DISCLAIMER } from "@/content/safety";
import type { SkinScanResult, SkinMetrics } from "@/types/skin";
import "./WorkspacePage.css";
import { useAuthStore } from "@/store/useAuthStore";
import { syncAccountScans } from "@/services/accountService";
import AccountChat from "@/components/AccountChat";

const measured = (scan: SkinScanResult) => Object.entries(scan.metrics).filter(([key]) => !scan.mock_metrics.includes(key as keyof SkinMetrics));

export default function WorkspacePage({ mode }: { mode: "dashboard" | "history" | "chat" }) {
  const { latestScan, scanHistory, removeScan, reset } = useSkinStore();
  const { user, loading } = useAuthStore();
  const queryClient = useQueryClient();
  const accountScans = useQuery({ queryKey: ["account-scans", user?.id], queryFn: syncAccountScans, enabled: !!user, retry: 1, staleTime: 0, refetchOnWindowFocus: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState(false);
  const comparison = scanHistory.filter((scan) => selected.includes(scan.scan_id));
  async function remove(id: string) {
    setBusy(id); setError("");
    try { await deleteScan(id); removeScan(id); setSelected((ids) => ids.filter((value) => value !== id)); await queryClient.invalidateQueries({ queryKey: ["account-scans"] }); }
    catch { setError("Could not delete this scan. Check the API connection and try again."); }
    finally { setBusy(null); }
  }
  return <><Navbar /><main className="section workspace"><div className="container">
    <nav className="workspace-actions" aria-label="Your workspace">{(["dashboard", "history", "chat"] as const).map((page) => <Link className="btn btn-ghost" key={page} to={`/${page}`} aria-current={mode === page ? "page" : undefined}>{page === "chat" ? "Scan assistant" : page === "history" ? "Scan history" : "Dashboard"}</Link>)}</nav>
    <span className="eyebrow">Your skin workspace</span>
    <h1>{mode === "dashboard" ? "Welcome back" : mode === "history" ? "Your scan history" : "Understand your scan"}</h1>
    <p className="lede">{user ? "Your scans are saved to your account and available when you sign in on another device." : "Guest results are saved on this browser. Sign in before scanning to save results to your account."}</p>
    {!user && !loading && <Link className="btn btn-ghost" to="/account">Sign in or create an account</Link>}
    {(loading || (!!user && accountScans.isPending)) && <p role="status">Loading your workspace…</p>}
    {accountScans.isError && <p role="alert">Could not sync your scans. <button className="btn btn-ghost" onClick={() => void accountScans.refetch()}>Retry</button></p>}
    {error && <p role="alert">{error}</p>}
    {mode === "chat" && user && <AccountChat />}
    {user && mode === "dashboard" && <Link className="btn btn-ghost" to="/routine">Open my saved routine</Link>}
    {mode === "dashboard" && <section className="workspace-card"><h2>Your next steps</h2><p>{scanHistory.length} saved analyses</p><div className="workspace-actions"><Link className="btn btn-primary" to="/scan">New scan</Link>{latestScan && <><Link className="btn btn-ghost" to={`/routine?scan_id=${latestScan.scan_id}`}>My routine</Link><Link className="btn btn-ghost" to={`/recommendations?scan_id=${latestScan.scan_id}`}>Recommendations</Link></>}</div></section>}
    {mode === "chat" && !user && <section className="workspace-card"><h2>Saved scan assistant</h2><p>This rule-based assistant summarizes recorded results. Free-form AI conversation is not connected.</p><button className="btn btn-primary" onClick={() => setSummary(true)}>Summarize my latest scan</button><div aria-live="polite">{summary && <p>{latestScan ? `Latest scan: ${new Date(latestScan.created_at).toLocaleString()}. Available model estimates: ${measured(latestScan).map(([key, value]) => `${key}: ${value}/100`).join(", ") || "none"}. Simulated indicators: ${latestScan.mock_metrics.join(", ") || "none"}. Overall score and skin type are not validated measurements. Open the analysis below to inspect the source.` : "No analyzed scan is saved yet. Complete a scan to see your results here."}</p>}</div></section>}
    {mode !== "chat" && !scanHistory.length && <section className="workspace-card"><h2>No scans yet</h2><p>Complete an analysis to begin your history.</p><Link className="btn btn-primary" to="/scan">Start a scan</Link></section>}
    {mode === "history" && scanHistory.length > 0 && <p>Select two scans to compare available model estimates. Lighting and camera changes can affect results.</p>}
    {accountScans.data?.filter((scan) => !scan.result).map((scan) => <section className="workspace-card" key={scan.scan_id}><h2>Scan awaiting analysis</h2><p>{new Date(scan.created_at).toLocaleString()}</p><Link className="btn btn-primary" to={`/analysis/${scan.scan_id}`}>Run analysis</Link><button className="btn btn-ghost" disabled={busy !== null} onClick={() => void remove(scan.scan_id)}>Delete scan & photos</button></section>)}
    <div className="workspace-grid">{(mode === "history" ? scanHistory : latestScan ? [latestScan] : []).map((scan) => <section className="workspace-card" key={scan.scan_id}>
      {mode === "history" && <label><input type="checkbox" checked={selected.includes(scan.scan_id)} disabled={selected.length === 2 && !selected.includes(scan.scan_id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, scan.scan_id] : ids.filter((id) => id !== scan.scan_id))} /> Compare</label>}
      <h2>{new Date(scan.created_at).toLocaleDateString()}</h2><p>{new Date(scan.created_at).toLocaleTimeString()}</p>
      {measured(scan).map(([key, score]) => <p key={key}><strong>{key}</strong>: {score}/100 — model estimate</p>)}
      {!!scan.mock_metrics.length && <p>Other indicators are simulated and excluded here.</p>}
      <div className="workspace-actions"><Link className="btn btn-ghost" to={`/analysis/${scan.scan_id}`}>View analysis</Link>{mode === "history" && <button className="btn btn-ghost" disabled={busy !== null} onClick={() => void remove(scan.scan_id)}>{busy === scan.scan_id ? "Deleting…" : "Delete scan & photos"}</button>}</div>
    </section>)}</div>
    {comparison.length === 2 && <section className="workspace-card"><h2>Comparison</h2><table><thead><tr><th>Indicator</th>{comparison.map((scan) => <th key={scan.scan_id}>{new Date(scan.created_at).toLocaleString()}</th>)}</tr></thead><tbody>{measured(comparison[0]).filter(([key]) => !comparison[1].mock_metrics.includes(key as keyof SkinMetrics)).map(([key, value]) => <tr key={key}><th>{key}</th><td>{value}/100</td><td>{comparison[1].metrics[key as keyof SkinMetrics]}/100</td></tr>)}</tbody></table><p>Simulated indicators and overall scores are excluded.</p></section>}
    {mode === "history" && scanHistory.length > 0 && !user && <button className="btn btn-ghost" onClick={() => { reset(); setSelected([]); }}>Clear local history (keeps server photos)</button>}
    <p className="workspace-disclaimer">{SAFETY_DISCLAIMER}</p>
  </div></main><Footer /></>;
}

