import { apiClient } from "@/lib/apiClient";
import type { RecommendationsResponse, Routine } from "@/types/skin";

export const getRecommendations = (scanId: string) =>
  apiClient.get<RecommendationsResponse>(`/api/recommendations?scan_id=${encodeURIComponent(scanId)}`);

export const getRoutine = (scanId: string) =>
  apiClient.get<Routine>(`/api/routine?scan_id=${encodeURIComponent(scanId)}`);

export const getSavedRoutine = () => apiClient.get<Routine | null>("/api/routine/saved");
export const saveRoutine = (routine: Routine) => apiClient.put<Routine>("/api/routine", routine);
