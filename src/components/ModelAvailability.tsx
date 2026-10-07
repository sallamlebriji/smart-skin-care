import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
interface Availability {
  indicators: Array<{ metric: string; status: "configured" | "community_checkpoint" | "not_configured"; runtime_available: boolean }>;
}
export default function ModelAvailability() {
  const query = useQuery({ queryKey: ["model-availability"], queryFn: () => apiClient.get<Availability>("/api/models"), retry: 1 });
  return <details style={{ margin: "20px 0", padding: 16, border: "1px solid var(--line)", borderRadius: 16 }}>
    <summary style={{ cursor: "pointer", fontWeight: 600 }}>Available analysis models</summary>
    {query.isPending && <p>Checking models…</p>}
    {query.isError && <p role="alert">Could not verify model availability. <button onClick={() => void query.refetch()}>Retry</button></p>}
    {query.data?.indicators.map((indicator) => <p key={indicator.metric} style={{ marginTop: 8 }}><strong>{indicator.metric}</strong> — {indicator.status === "not_configured" ? "No trained checkpoint configured" : !indicator.runtime_available ? "Checkpoint configured; runtime unavailable" : indicator.status === "community_checkpoint" ? "Community acne model" : "Operator-provided trained checkpoint"}</p>)}
    <p style={{ marginTop: 12, fontSize: 13 }}>Model availability does not establish clinical validation. Missing models remain explicitly simulated and are excluded from comparisons, chat context and routines.</p>
  </details>;
}
