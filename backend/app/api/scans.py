"""
Scan capture and analysis endpoints. Account scans enforce ownership;
guest scans are addressed by an unguessable id.
"""

import json
import secrets
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image

from app.ai.aggregation import run_models
from app.config import settings
from app.services.storage import LocalScanStorage
from app.api.auth import OptionalUser, CurrentUser
from app.database.models import SkinScan
from app.database.session import get_db
from sqlalchemy import select

router = APIRouter(tags=["scans"])
storage = LocalScanStorage(Path(settings.scan_storage_dir))

ANGLES = ("front", "left", "right")


def accessible_meta(scan_id: str, user) -> dict:
    meta = storage.load_meta(scan_id)
    if meta is None or (meta.get("user_id") and (user is None or user.id != meta["user_id"])):
        raise HTTPException(404, "Scan not found")
    return meta


def sync_scan(meta: dict, *, remove: bool = False) -> None:
    if not meta.get("user_id"):
        return
    db_gen = get_db()
    db = next(db_gen)
    try:
        row = db.get(SkinScan, meta["scan_id"])
        if remove:
            if row:
                db.delete(row)
        else:
            if row is None:
                row = SkinScan(id=meta["scan_id"], user_id=meta["user_id"], capture_mode=meta["capture_mode"],
                               created_at=datetime.fromisoformat(meta["created_at"]).replace(tzinfo=None))
                db.add(row)
            row.result = meta.get("result")
            row.quality = meta.get("quality")
        db.commit()
    finally:
        db_gen.close()


@router.get("/api/scans")
def list_scans(user: CurrentUser) -> list[dict]:
    db_gen = get_db()
    db = next(db_gen)
    try:
        rows = db.scalars(select(SkinScan).where(SkinScan.user_id == user.id).order_by(SkinScan.created_at.desc()).limit(100))
        return [meta for row in rows if (meta := storage.load_meta(row.id)) is not None]
    finally:
        db_gen.close()

MAGIC = {
    b"\xff\xd8\xff": "jpg",
    b"\x89PNG\r\n\x1a\n": "png",
}


def _image_ext(data: bytes) -> str | None:
    for magic, ext in MAGIC.items():
        if data.startswith(magic):
            return ext
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


async def _read_valid(angle: str, upload: UploadFile) -> tuple[bytes, str]:
    data = await upload.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, f"{angle} image exceeds {settings.max_upload_bytes} bytes")
    ext = _image_ext(data)
    if ext is None:
        raise HTTPException(415, f"{angle} is not a JPEG, PNG or WebP image")
    return data, ext


@router.post("/api/scans", status_code=201)
async def create_scan(
    front: Annotated[UploadFile, File()],
    left: Annotated[UploadFile, File()],
    right: Annotated[UploadFile, File()],
    consent: Annotated[bool, Form()],
    user: OptionalUser,
    capture_mode: Annotated[Literal["camera", "truedepth"], Form()] = "camera",
    quality: Annotated[str, Form()] = "{}",
) -> dict:
    if not consent:
        raise HTTPException(400, "Explicit consent is required to process face images")
    try:
        quality_by_angle = json.loads(quality)
        if not isinstance(quality_by_angle, dict):
            raise ValueError
    except ValueError:
        raise HTTPException(422, "quality must be a JSON object keyed by angle")

    files = {"front": front, "left": left, "right": right}
    validated = {angle: await _read_valid(angle, f) for angle, f in files.items()}

    scan_id = "scan_" + secrets.token_hex(16)
    stored = {angle: storage.save_image(scan_id, angle, data, ext) for angle, (data, ext) in validated.items()}
    meta = {
        "scan_id": scan_id,
        "capture_mode": capture_mode,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "consent": True,
        "images": stored,
        "quality": quality_by_angle,
        "status": "uploaded",  # becomes "analyzed" only once a real model has run (Phase 5)
        "user_id": user.id if user else None,
    }
    storage.save_meta(scan_id, meta)
    try:
        sync_scan(meta)
    except Exception:
        storage.delete_scan(scan_id)
        raise
    return meta


@router.get("/api/scans/{scan_id}")
def get_scan(scan_id: str, user: OptionalUser) -> dict:
    return accessible_meta(scan_id, user)


_CONTENT_TYPE = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


@router.get("/api/scans/{scan_id}/image/{angle}")
def get_scan_image(scan_id: str, angle: Literal["front", "left", "right"], user: OptionalUser) -> Response:
    """
    Serves a stored capture by scan id + angle (spec: the dashboard needs the
    actual photo, not just the JSON meta). Account ownership is checked;
    guest scans use the scan id as an unguessable secret.
    """
    meta = accessible_meta(scan_id, user)
    filename = meta.get("images", {}).get(angle)
    data = storage.load_image(scan_id, filename) if filename else None
    if data is None:
        raise HTTPException(404, f"No stored {angle} image for this scan")
    ext = filename.rsplit(".", 1)[-1]
    return Response(content=data, media_type=_CONTENT_TYPE.get(ext, "application/octet-stream"), headers={"Cache-Control": "private, no-store"})


@router.delete("/api/scans/{scan_id}", status_code=204)
def delete_scan(scan_id: str, user: OptionalUser) -> None:
    meta = accessible_meta(scan_id, user)
    sync_scan(meta, remove=True)
    if not storage.delete_scan(scan_id):
        raise HTTPException(404, "Scan not found")


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _quality_from_capture(front_quality: dict) -> dict:
    """
    Derives the 0-1 ScanQuality fields from the real client-captured metrics
    (Phase 2/3's luma/imbalance/yaw — see src/lib/faceQuality.ts), rather than
    re-measuring. `face_visibility` is 1.0 because the frontend already gates
    capture on that check passing, not a fresh independent measurement.
    """
    luma = front_quality.get("luma", 0.5)
    imbalance = front_quality.get("imbalance", 0.0)
    yaw = front_quality.get("yaw", 0.5)
    return {
        "lighting": _clip01(1 - abs(luma - 0.5) * 2 - imbalance),
        "face_visibility": 1.0,
        "position": _clip01(1 - abs(yaw - 0.5) * 4),
    }


@router.post("/api/scans/{scan_id}/analyze")
def analyze_scan(scan_id: str, user: OptionalUser) -> dict:
    meta = accessible_meta(scan_id, user)

    front_filename = meta.get("images", {}).get("front")
    data = storage.load_image(scan_id, front_filename) if front_filename else None
    if data is None:
        raise HTTPException(500, "Stored front image is missing or unreadable")

    try:
        face_image = np.array(Image.open(BytesIO(data)).convert("RGB"))
    except Exception:
        raise HTTPException(500, "Stored front image could not be decoded")

    try:
        run = run_models(face_image)
    except Exception:
        raise HTTPException(503, "Analysis is unavailable. The server operator must check model configuration or connectivity.")
    overall_score = sum(run["metrics"].values()) / len(run["metrics"])
    quality = _quality_from_capture(meta.get("quality", {}).get("front", {}))

    result = {
        "scan_id": scan_id,
        "created_at": meta["created_at"],
        "capture_mode": meta.get("capture_mode", "camera"),
        "quality": quality,
        # No real skin-type classifier yet (still a fixed placeholder) — this
        # scan's `mock_metrics` list is the authoritative signal for what's
        # real; don't trust this field on its own.
        "skin_type_estimate": "normal",
        "overall_score": round(overall_score, 1),
        "metrics": run["metrics"],
        "regions": {},  # Phase 4's region map runs client-side only; not sent here yet
        "confidence": round(run["confidence"], 2),
        "is_mock_result": run["is_mock_result"],
        "mock_metrics": run["mock_metrics"],
    }

    meta["status"] = "analyzed"
    meta["result"] = result
    storage.save_meta(scan_id, meta)
    sync_scan(meta)
    return result
