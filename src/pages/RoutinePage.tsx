import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getRoutine, getSavedRoutine, saveRoutine } from "@/services/recommendationService";
import { useAuthStore } from "@/store/useAuthStore";
import { SAFETY_DISCLAIMER } from "@/content/safety";
import type { Routine } from "@/types/skin";
import "./WorkspacePage.css";

export default function SavedRoutinePage() {
  const [params] = useSearchParams();
  const scanId = params.get("scan_id");
  const { user, loading } = useAuthStore();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Routine | null>(null);
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["routine-editor", user?.id, scanId], queryFn: () => scanId ? getRoutine(scanId) : getSavedRoutine(), enabled: !loading && (!!scanId || !!user), retry: 1 });
  useEffect(() => { setDraft(query.data ?? null); }, [query.data]);
  const saved = useQuery({ queryKey: ["saved-routine", user?.id], queryFn: getSavedRoutine, enabled: !!user && !!scanId });
  const save = useMutation({ mutationFn: () => saveRoutine(draft!), onSuccess: async () => { setNotice("Your routine is saved to your account."); await queryClient.invalidateQueries({ queryKey: ["saved-routine"] }); await queryClient.invalidateQueries({ queryKey: ["routine-editor", user?.id, null] }); } });
  function change(period: "morning" | "evening", index: number, name: string) {
    if (draft) setDraft({ ...draft, [period]: draft[period].map((step, i) => i === index ? { ...step, name } : step) });
    setNotice("");
  }
  return <><Navbar /><main className="section workspace"><div className="container">
    <Link className="btn btn-ghost" to="/dashboard">Back to dashboard</Link><h1>Morning &amp; evening</h1>
    <p className="lede">Review your routine, adapt the steps, and save it to your account.</p>
    {(loading || query.isFetching) && <p role="status">Loading your routine…</p>}
    {query.isError && <p role="alert">{query.error.message} <button className="btn btn-ghost" onClick={() => void query.refetch()}>Retry</button></p>}
    {!draft && !query.isFetching && !query.isError && <section className="workspace-card"><h2>No routine saved yet</h2><p>Open a scan's recommendations to generate a routine, or create your own.</p><Link className="btn btn-primary" to="/scan">Start a scan</Link>{user ? <button className="btn btn-ghost" onClick={() => setDraft({ morning: [], evening: [] })}>Create my own routine</button> : <Link className="btn btn-ghost" to="/account">Sign in</Link>}</section>}
    {saved.data && <button className="btn btn-ghost" onClick={() => setDraft(saved.data!)}>Load my saved routine</button>}
    {draft && <form onSubmit={(event) => { event.preventDefault(); if (user) save.mutate(); }}>
      <div className="workspace-grid">{(["morning", "evening"] as const).map((period) => <section className="workspace-card" key={period}><h2>{period === "morning" ? "Morning" : "Evening"}</h2><ol>{draft[period].map((step, index) => <li key={`${period}-${index}`}>
        {user ? <><label htmlFor={`${period}-${index}`}>Step {index + 1}</label><input id={`${period}-${index}`} required maxLength={200} value={step.name} onChange={(event) => change(period, index, event.target.value)} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft({ ...draft, [period]: draft[period].filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i + 1 })) }); setNotice(""); }}>Remove step</button></> : <strong>{step.name}</strong>}
        {step.reason && <p>{step.reason}</p>}{step.frequency && <p>{step.frequency}</p>}
      </li>)}</ol>{user && <button type="button" className="btn btn-ghost" disabled={draft[period].length >= 20} onClick={() => { setDraft({ ...draft, [period]: [...draft[period], { order: draft[period].length + 1, name: "", frequency: "Daily" }] }); setNotice(""); }}>Add step</button>}</section>)}</div>
      {user ? <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save my routine"}</button> : <Link className="btn btn-primary" to="/account">Sign in to edit and save</Link>}
      {save.isError && <p role="alert">{save.error.message}</p>}{notice && <p role="status">{notice}</p>}
    </form>}
    <p className="workspace-disclaimer">{SAFETY_DISCLAIMER}</p>
  </div></main><Footer /></>;
}

