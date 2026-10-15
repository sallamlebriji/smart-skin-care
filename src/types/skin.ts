/**
 * Shared result shape produced by BOTH capture modes (browser camera and
 * iOS TrueDepth). Keeping this identical across platforms is what lets a
 * single result/dashboard UI render either origin — see spec §13/§31.
 */

export type CaptureMode = "camera" | "truedepth";

export interface WrinkleAssessment {
  label: "wrinkle" | "non-wrinkle";
  wrinkle_probability: number;
  model: string;
  revision: string;
  experimental: boolean;
}

export type FaceRegionId =
  | "forehead"
  | "nose"
  | "chin"
  | "left_cheek"
  | "right_cheek"
  | "left_under_eye"
  | "right_under_eye"
  | "full_face";

export interface ScanQuality {
  lighting: number;
  face_visibility: number;
  position: number;
}

/**
 * 0-100 estimated appearance scores. These are visual, camera-derived
 * assessments — never physiological measurements or diagnoses. See the
 * safety-language rules in src/content/safety.ts.
 */
export interface SkinMetrics {
  acne: number;
  redness: number;
  pigmentation: number;
  pores: number;
  texture: number;
  wrinkles: number;
  scars: number;
  uniformity: number;
}

export type SkinRegionMetrics = Partial<SkinMetrics>;

export type SkinRegions = Partial<Record<FaceRegionId, SkinRegionMetrics>>;

export type SkinTypeEstimate =
  | "dry"
  | "oily"
  | "combination"
  | "normal"
  | "sensitive";

export interface SkinScanResult {
  scan_id: string;
  capture_mode: CaptureMode;
  created_at: string;
  quality: ScanQuality;
  skin_type_estimate: SkinTypeEstimate;
  overall_score: number;
  metrics: SkinMetrics;
  regions: SkinRegions;
  confidence: number;
  /** True while any field in `metrics` is still a Phase 1 placeholder, not real inference. */
  is_mock_result: boolean;
  /** Which `metrics` keys are placeholders right now — check this, not just `acne`, before trusting a score. */
  mock_metrics: Array<keyof SkinMetrics>;
}

export type RecommendationPriority = "low" | "medium" | "high";

export interface Recommendation {
  goal: string;
  priority: RecommendationPriority;
  recommendations: Array<{
    type: "ingredient" | "product" | "habit";
    name: string;
    reason?: string;
  }>;
}

export interface RoutineStep {
  order: number;
  name: string;
  reason?: string;
  frequency?: string;
}

export interface Routine {
  morning: RoutineStep[];
  evening: RoutineStep[];
}

export interface RecommendationsResponse {
  scan_id: string;
  recommendations: Recommendation[];
  /** True if any triggered goal comes from a still-placeholder metric — see SkinScanResult.mock_metrics. */
  is_mock_result: boolean;
  mock_goals: string[];
}
