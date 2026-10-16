"""
Pydantic mirror of src/types/skin.ts on the frontend (spec §13). Keep the two
in sync by hand for now — codegen can come later once the shape stabilizes.
"""

from typing import Literal

from pydantic import BaseModel, Field

CaptureMode = Literal["camera", "truedepth"]

FaceRegionId = Literal[
    "forehead",
    "nose",
    "chin",
    "left_cheek",
    "right_cheek",
    "left_under_eye",
    "right_under_eye",
    "full_face",
]

SkinTypeEstimate = Literal["dry", "oily", "combination", "normal", "sensitive"]


class WrinkleAssessment(BaseModel):
    label: Literal["wrinkle", "non-wrinkle"]
    wrinkle_probability: float = Field(ge=0, le=1)
    model: str
    revision: str
    experimental: Literal[True] = True


class ScanQuality(BaseModel):
    lighting: float = Field(ge=0, le=1)
    face_visibility: float = Field(ge=0, le=1)
    position: float = Field(ge=0, le=1)


class SkinMetrics(BaseModel):
    acne: float
    redness: float
    pigmentation: float
    pores: float
    texture: float
    wrinkles: float
    scars: float
    uniformity: float


class SkinScanResult(BaseModel):
    scan_id: str
    created_at: str
    capture_mode: CaptureMode
    quality: ScanQuality
    skin_type_estimate: SkinTypeEstimate
    overall_score: float = Field(ge=0, le=100)
    metrics: dict[str, float]  # Sparse: only indices actually produced by an available model.
    regions: dict[str, dict[str, float]] = Field(default_factory=dict)
    confidence: float = Field(ge=0, le=1)
    is_mock_result: bool  # true while any metric below is still a placeholder (Phase 1 stub)
    mock_metrics: list[str]  # which SkinMetrics fields are placeholders, not real inference
