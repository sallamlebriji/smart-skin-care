import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/useAuthStore";
interface ChatHistory {
  ai_available: boolean;
  messages: Array<{ id: string; role: string; content: string; created_at: string }>;
}
export default function AccountChat() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [provider, setProvider] = useState("");
  const history = useQuery({ queryKey: ["chat-history", user?.id], queryFn: () => apiClient.get<ChatHistory>("/api/chat/history"), enabled: !!user });
  const send = useMutation({ mutationFn: () => apiClient.post<{ answer: string; provider: string }>("/api/chat", { message, allow_external_ai: consent }), onSuccess: async (result) => { setMessage(""); setConsent(false); setProvider(result.provider); await queryClient.invalidateQueries({ queryKey: ["chat-history"] }); } });
  const clear = useMutation({ mutationFn: () => apiClient.delete<void>("/api/chat/history"), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["chat-history"] }); setProvider(""); } });
  return <section className="workspace-card"><h2>Your scan assistant</h2>
    <p>Ask about your saved scans or routine. Only available model estimates are included in scan context.</p>
    {history.isPending && <p>Loading your conversation…</p>}
    {history.isError && <p role="alert">Could not load chat. <button onClick={() => void history.refetch()}>Retry</button></p>}
    <div className="chat-messages" aria-live="polite">{history.data?.messages.map((item) => <article className={`chat-message chat-message--${item.role}`} key={item.id}><strong>{item.role === "user" ? "You" : "Assistant"}</strong><p>{item.content}</p></article>)}</div>
    <form onSubmit={(event) => { event.preventDefault(); if (message.trim()) send.mutate(); }}>
      <label htmlFor="chat-message">Your question</label><textarea id="chat-message" rows={3} required maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain my latest scan" disabled={send.isPending} />
      {history.data?.ai_available ? <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Allow sending my question, recent conversation, available scan estimates and saved routine to OpenAI for this response. Photos and account credentials are excluded.</label> : <p>AI is not configured on the server. Responses use local summary rules.</p>}
      <div className="workspace-actions"><button className="btn btn-primary" disabled={!message.trim() || send.isPending || clear.isPending || history.isError}>{send.isPending ? "Replying…" : "Send"}</button><button type="button" className="btn btn-ghost" disabled={send.isPending || clear.isPending || !history.data?.messages.length} onClick={() => clear.mutate()}>Delete conversation</button></div>
    </form>
    {(send.isError || clear.isError) && <p role="alert">{(send.error ?? clear.error)?.message}</p>}
    {provider && <p role="status">{provider === "openai" ? "AI response" : provider === "local_fallback" ? "AI unavailable — local response" : "Local rule-based response"}</p>}
  </section>;
}

