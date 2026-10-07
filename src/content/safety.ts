/**
 * Centralized safety copy (spec §12/§23). Every screen that shows analysis
 * results or scan UI should pull from here instead of writing ad hoc
 * medical-sounding language.
 */
export const SAFETY_DISCLAIMER =
  "This analysis is a visual skincare assessment and is not a medical diagnosis.";

export const SAFETY_NOTE_LONG =
  "Smart Skin Care estimates visible skin indicators from camera images using computer vision. It does not measure physiological properties and cannot detect medical conditions. If something looks like it's worth a second opinion, please consult a dermatologist or healthcare professional.";

export const METRIC_LABELS: Record<string, string> = {
  acne: "Acne",
  redness: "Redness",
  pigmentation: "Pigmentation",
  pores: "Visible pores",
  texture: "Texture",
  wrinkles: "Wrinkles",
  scars: "Scars",
  uniformity: "Uniformity",
};
