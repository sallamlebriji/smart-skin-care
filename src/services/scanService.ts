import { apiClient, BASE_URL } from "@/lib/apiClient";
import type { ScanAngle } from "@/lib/faceQuality";
import type { SkinScanResult, WrinkleAssessment } from "@/types/skin";
import { useSkinStore } from "@/store/useSkinStore";
import { useAuthStore } from "@/store/useAuthStore";
import { queryClient } from "@/lib/queryClient";

export interface UploadedScan {
  scan_id: string;
  capture_mode: "camera" | "truedepth";
  created_at: string;
  images: Record<ScanAngle, string>;
  /** "uploaded" until a real model has analyzed it (Phase 5). */
  status: "uploaded" | "analyzed";
}

export interface ScanMeta extends UploadedScan {
  result?: SkinScanResult;
  wrinkle_assessment?: WrinkleAssessment;
}

export const analyzeWrinkles = async (scanId: string) => {
  const result = await apiClient.post<WrinkleAssessment>(`/api/scans/${scanId}/analyze-wrinkles`);
  void queryClient.invalidateQueries({ queryKey: ["scan", scanId] });
  void queryClient.invalidateQueries({ queryKey: ["account-scans"] });
  return result;
};

export const getScan = async (scanId: string) => {
  const ownerId = useAuthStore.getState().user?.id;
  const scan = await apiClient.get<ScanMeta>(`/api/scans/${scanId}`);
  if (scan.result && useAuthStore.getState().user?.id === ownerId) useSkinStore.getState().setLatestScan({ ...scan.result, created_at: scan.created_at });
  return scan;
};

export const scanImageUrl = (scanId: string, angle: ScanAngle) => `${BASE_URL}/api/scans/${scanId}/image/${angle}`;

export async function uploadScan(
  images: Record<ScanAngle, Blob>,
  quality: Record<ScanAngle, unknown>,
): Promise<UploadedScan> {
  const form = new FormData();
  form.append("consent", "true");
  form.append("capture_mode", "camera");
  form.append("quality", JSON.stringify(quality));
  (Object.keys(images) as ScanAngle[]).forEach((angle) => form.append(angle, images[angle], `${angle}.jpg`));
  const scan = await apiClient.postForm<UploadedScan>("/api/scans", form);
  void queryClient.invalidateQueries({ queryKey: ["account-scans"] });
  return scan;
}

export const deleteScan = async (scanId: string) => {
  await apiClient.delete<void>(`/api/scans/${scanId}`);
  useSkinStore.getState().removeScan(scanId);
  queryClient.removeQueries({ queryKey: ["scan", scanId] });
  void queryClient.invalidateQueries({ queryKey: ["account-scans"] });
};

/** Runs available trained models. Missing indicators have no numeric result. */
export const analyzeScan = async (scanId: string) => {
  const ownerId = useAuthStore.getState().user?.id;
  const result = await apiClient.post<SkinScanResult>(`/api/scans/${scanId}/analyze`);
  if (useAuthStore.getState().user?.id === ownerId) useSkinStore.getState().setLatestScan(result);
  void queryClient.invalidateQueries({ queryKey: ["account-scans"] });
  return result;
};
