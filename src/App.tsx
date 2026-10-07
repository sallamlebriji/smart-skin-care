import { Routes, Route, Link } from "react-router-dom";
import Landing from "@/pages/Landing";
import ScanPage from "@/pages/ScanPage";
import AnalysisPage from "@/pages/AnalysisPage";
import RecommendationsPage from "@/pages/RecommendationsPage";
import RoutinePage from "@/pages/RoutinePage";
import WorkspacePage from "@/pages/WorkspacePage";
import AccountPage from "@/pages/AccountPage";
import { useEffect } from "react";
import { loadSession } from "@/services/accountService";
export default function App() {
  useEffect(() => { void loadSession(); }, []);
  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/scan" element={<ScanPage />} />
    <Route path="/analysis/:id" element={<AnalysisPage />} />
    <Route path="/recommendations" element={<RecommendationsPage />} />
    <Route path="/routine" element={<RoutinePage />} />
    <Route path="/dashboard" element={<WorkspacePage key="dashboard" mode="dashboard" />} />
    <Route path="/history" element={<WorkspacePage key="history" mode="history" />} />
    <Route path="/chat" element={<WorkspacePage key="chat" mode="chat" />} />
    <Route path="/account" element={<AccountPage />} />
    <Route path="*" element={<main className="section container"><h1>Page not found</h1><Link className="btn btn-primary" to="/dashboard">Open dashboard</Link></main>} />
  </Routes>;
}
