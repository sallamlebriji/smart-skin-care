import { apiClient, ApiError } from "@/lib/apiClient";
import { useAuthStore, type Account } from "@/store/useAuthStore";
import { useSkinStore } from "@/store/useSkinStore";
import { queryClient } from "@/lib/queryClient";
import type { ScanMeta } from "@/services/scanService";

export interface Profile {
  display_name: string;
  skin_type: string | null;
  goals: string[];
  consent_data_use: boolean;
}

export async function syncAccountScans() {
  const ownerId = useAuthStore.getState().user?.id;
  const scans = await apiClient.get<ScanMeta[]>("/api/scans");
  if (ownerId && useAuthStore.getState().user?.id === ownerId) {
    useSkinStore.getState().replaceHistory(scans.flatMap((scan) => scan.result ? [{ ...scan.result, created_at: scan.created_at }] : []));
  }
  return scans;
}

async function establishAccount(user: Account) {
  queryClient.clear();
  useSkinStore.getState().reset();
  useSkinStore.getState().setAccountMode(true);
  useAuthStore.getState().setUser(user);
}

async function bootstrapSession() {
  try {
    let user: Account;
    try { user = await apiClient.get<Account>("/api/auth/me"); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      user = await apiClient.post<Account>("/api/auth/refresh");
    }
    await establishAccount(user);
  } catch { useAuthStore.getState().setUser(null); }
}

let bootstrapPromise: Promise<void> | null = null;
export function loadSession() {
  bootstrapPromise ??= bootstrapSession().finally(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}

export async function signIn(mode: "login" | "register", email: string, password: string) {
  const user = await apiClient.post<Account>(`/api/auth/${mode}`, { email, password });
  await establishAccount(user);
}

export async function signOut() {
  await apiClient.post<void>("/api/auth/logout");
  queryClient.clear();
  useSkinStore.getState().reset();
  useSkinStore.getState().setAccountMode(false);
  useAuthStore.getState().setUser(null);
}

export const getProfile = () => apiClient.get<Profile>("/api/profile");
export const saveProfile = (profile: Profile) => apiClient.put<Profile>("/api/profile", profile);
