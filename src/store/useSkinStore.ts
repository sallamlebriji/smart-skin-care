import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SkinScanResult } from "@/types/skin";

/**
 * App-wide scan/session state. Deliberately minimal in Phase 1 — no auth,
 * no persistence yet (Phase 9). Grows alongside /scan, /analysis/:id and
 * /dashboard as those are built out.
 */
interface SkinStore {
  latestScan: SkinScanResult | null;
  scanHistory: SkinScanResult[];
  setLatestScan: (scan: SkinScanResult) => void;
  addToHistory: (scan: SkinScanResult) => void;
  reset: () => void;
  removeScan: (id: string) => void;
  accountMode: boolean;
  setAccountMode: (active: boolean) => void;
  replaceHistory: (scans: SkinScanResult[]) => void;
}

export const useSkinStore = create<SkinStore>()(persist((set) => ({
  latestScan: null,
  scanHistory: [],
  accountMode: false,
  setAccountMode: (accountMode) => set({ accountMode }),
  replaceHistory: (scans) => {
    const scanHistory = [...scans].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    set({ scanHistory, latestScan: scanHistory[0] ?? null });
  },
  setLatestScan: (scan) => set((state) => {
    const scanHistory = [scan, ...state.scanHistory.filter((item) => item.scan_id !== scan.scan_id)]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 100);
    return { latestScan: scanHistory[0], scanHistory };
  }),
  addToHistory: (scan) =>
    set((state) => ({ scanHistory: [scan, ...state.scanHistory.filter((item) => item.scan_id !== scan.scan_id)].slice(0, 100) })),
  removeScan: (id) => set((state) => {
    const scanHistory = state.scanHistory.filter((scan) => scan.scan_id !== id);
    return { scanHistory, latestScan: state.latestScan?.scan_id === id ? scanHistory[0] ?? null : state.latestScan };
  }),
  reset: () => set({ latestScan: null, scanHistory: [] }),
}), { name: "smart-skin-scans", version: 1,
  partialize: (state) => ({ latestScan: state.accountMode ? null : state.latestScan, scanHistory: state.accountMode ? [] : state.scanHistory }),
}));
