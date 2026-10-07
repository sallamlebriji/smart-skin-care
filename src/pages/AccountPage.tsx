import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuthStore } from "@/store/useAuthStore";
import { signIn, signOut, getProfile, saveProfile, type Profile } from "@/services/accountService";
import "./WorkspacePage.css";

export default function AccountPage() {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    let active = true;
    if (user) getProfile().then((data) => { if (active) setProfile(data); }).catch(() => { if (active) setError("Could not load your profile. Reload to try again."); });
    else setProfile(null);
    return () => { active = false; };
  }, [user]);
  async function submit() {
    setBusy(true); setError(""); setNotice("");
    try {
      if (user && profile) { await saveProfile(profile); setNotice("Profile saved."); }
      else { await signIn(mode, email, password); setPassword(""); navigate("/dashboard"); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not complete the request"); }
    finally { setBusy(false); }
  }
  return <><Navbar /><main className="section workspace"><div className="container" style={{ maxWidth: 600 }}>
    <h1>{user ? "Your account" : mode === "register" ? "Create your account" : "Welcome back"}</h1>
    <p className="lede">Save your scans and routine to your account.</p>
    {loading ? <p>Checking your session…</p> : <section className="workspace-card">
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {!user ? <>
          <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password (at least 8 characters)</label><input id="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
        </> : <><p>{user.email}</p>{profile && <>
          <label htmlFor="display-name">Display name</label><input id="display-name" maxLength={80} value={profile.display_name} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} />
          <label htmlFor="skin-type">Self-reported skin type</label><select id="skin-type" value={profile.skin_type ?? ""} onChange={(event) => setProfile({ ...profile, skin_type: event.target.value || null })}><option value="">Not sure</option>{["dry", "oily", "combination", "normal", "sensitive"].map((value) => <option key={value}>{value}</option>)}</select>
          <label htmlFor="goals">Your goals (comma separated)</label><input id="goals" value={profile.goals.join(",")} onChange={(event) => setProfile({ ...profile, goals: event.target.value.split(",").slice(0, 10) })} />
        </>}</>}
        <button className="btn btn-primary" disabled={busy || (!!user && !profile)}>{busy ? "Saving…" : user ? "Save profile" : mode === "register" ? "Create account" : "Sign in"}</button>
      </form>
      {!user ? <button className="btn btn-ghost" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "I already have an account"}</button> : <button className="btn btn-ghost" disabled={busy} onClick={async () => { setBusy(true); try { await signOut(); navigate("/"); } catch { setError("Sign out failed. Try again."); } finally { setBusy(false); } }}>Sign out</button>}
    </section>}
  </div></main><Footer /></>;
}
