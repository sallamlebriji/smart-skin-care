"""Pydantic mirror of src/types/skin.ts's Recommendation/Routine (Phase 7)."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

RecommendationPriority = Literal["low", "medium", "high"]


class RecommendationItem(BaseModel):
    type: Literal["ingredient", "product", "habit"]
    name: str
    reason: str | None = None


class Recommendation(BaseModel):
    goal: str
    priority: RecommendationPriority
    recommendations: list[RecommendationItem]
    # Not in the frontend's base Recommendation type (kept backend-only via
    # response wrapper) — see RecommendationsResponse.


class RecommendationsResponse(BaseModel):
    scan_id: str
    recommendations: list[Recommendation]
    is_mock_result: bool  # true if ANY triggered goal comes from a still-placeholder metric
    mock_goals: list[str]  # which goals specifically — mirrors mock_metrics' honesty pattern


class RoutineStep(BaseModel):
    order: int = Field(ge=1, le=20)
    name: str = Field(min_length=1, max_length=200)
    reason: str | None = Field(default=None, max_length=2000)
    frequency: str | None = Field(default=None, max_length=100)

    @field_validator("name")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Routine step cannot be blank")
        return value.strip()


class Routine(BaseModel):
    morning: list[RoutineStep]
    evening: list[RoutineStep]
