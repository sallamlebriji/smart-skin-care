"""
Phase 7: rule-based recommendations + routine, derived from a scan's stored
analysis result. No auth/DB yet (Phase 9) — the caller names the scan via
`scan_id` query param rather than an implicit "current user".
"""

from fastapi import APIRouter, HTTPException

from app.api import scans as scans_module
from app.schemas.recommendation import Recommendation, RecommendationsResponse, Routine
from app.services.recommendations import build_recommendations, build_routine
from app.api.auth import OptionalUser, CurrentUser, DB
from app.database.models import Routine as SavedRoutine
from sqlalchemy import select

router = APIRouter(tags=["recommendations"])


def _load_analyzed_scan(scan_id: str, user=None) -> dict:
    meta = scans_module.accessible_meta(scan_id, user)
    if not meta.get("result"):
        raise HTTPException(409, "Scan hasn't been analyzed yet — call POST /api/scans/{id}/analyze first")
    return meta["result"]


@router.get("/api/recommendations", response_model=RecommendationsResponse)
def get_recommendations(scan_id: str, user: OptionalUser) -> RecommendationsResponse:
    result = _load_analyzed_scan(scan_id, user)
    raw = build_recommendations(result["metrics"], result.get("mock_metrics", []))
    mock_goals = [r["goal"] for r in raw if r["is_mock"]]
    return RecommendationsResponse(
        scan_id=scan_id,
        recommendations=[Recommendation(**{k: v for k, v in r.items() if k != "is_mock"}) for r in raw],
        is_mock_result=bool(mock_goals),
        mock_goals=mock_goals,
    )


@router.get("/api/routine", response_model=Routine)
def get_routine(scan_id: str, user: OptionalUser) -> Routine:
    result = _load_analyzed_scan(scan_id, user)
    raw_recs = build_recommendations(result["metrics"], result.get("mock_metrics", []))
    # Simulated indicators cannot drive an actual routine.
    return Routine(**build_routine([recommendation for recommendation in raw_recs if not recommendation["is_mock"]]))


@router.get("/api/routine/saved", response_model=Routine | None)
def saved_routine(user: CurrentUser, db: DB):
    row = db.scalar(select(SavedRoutine).where(SavedRoutine.user_id == user.id))
    return Routine(morning=row.morning, evening=row.evening) if row else None


@router.put("/api/routine", response_model=Routine)
def save_routine(body: Routine, user: CurrentUser, db: DB):
    if len(body.morning) > 20 or len(body.evening) > 20:
        raise HTTPException(422, "At most 20 steps per routine")
    row = db.scalar(select(SavedRoutine).where(SavedRoutine.user_id == user.id))
    if row is None:
        row = SavedRoutine(user_id=user.id)
        db.add(row)
    row.morning = [{**step.model_dump(), "order": index + 1} for index, step in enumerate(body.morning)]
    row.evening = [{**step.model_dump(), "order": index + 1} for index, step in enumerate(body.evening)]
    db.commit()
    return Routine(morning=row.morning, evening=row.evening)
