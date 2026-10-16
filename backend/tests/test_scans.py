import io
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import scans as scans_module
from app.main import app
from app.services.storage import LocalScanStorage

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture()
def client(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        monkeypatch.setattr(scans_module, "storage", LocalScanStorage(Path(tmp)))
        yield TestClient(app)


def _files(**overrides):
    base = {a: (f"{a}.jpg", io.BytesIO(JPEG), "image/jpeg") for a in ("front", "left", "right")}
    base.update(overrides)
    return base


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_upload_get_delete_roundtrip(client):
    r = client.post("/api/scans", files=_files(), data={"consent": "true", "quality": '{"front": {"luma": 0.5}}'})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "uploaded"
    assert set(body["images"]) == {"front", "left", "right"}
    scan_id = body["scan_id"]

    got = client.get(f"/api/scans/{scan_id}")
    assert got.status_code == 200 and got.json()["quality"]["front"]["luma"] == 0.5

    assert client.delete(f"/api/scans/{scan_id}").status_code == 204
    assert client.get(f"/api/scans/{scan_id}").status_code == 404


def test_consent_required(client):
    r = client.post("/api/scans", files=_files(), data={"consent": "false"})
    assert r.status_code == 400


def test_missing_angle_rejected(client):
    files = _files()
    del files["right"]
    assert client.post("/api/scans", files=files, data={"consent": "true"}).status_code == 422


def test_non_image_rejected(client):
    files = _files(left=("left.jpg", io.BytesIO(b"<html>not an image</html>"), "image/jpeg"))
    r = client.post("/api/scans", files=files, data={"consent": "true"})
    assert r.status_code == 415


def test_png_accepted_and_oversize_rejected(client, monkeypatch):
    ok = client.post("/api/scans", files=_files(front=("f.png", io.BytesIO(PNG), "image/png")), data={"consent": "true"})
    assert ok.status_code == 201
    monkeypatch.setattr(scans_module.settings, "max_upload_bytes", 32)
    assert client.post("/api/scans", files=_files(), data={"consent": "true"}).status_code == 413


def test_path_traversal_id_is_not_found(client):
    assert client.get("/api/scans/..%2F..%2Fetc").status_code == 404


def _real_jpeg() -> bytes:
    """The magic-bytes-only JPEG above passes upload validation but isn't a
    real decodable image — analyze needs one PIL can actually open."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color=(120, 90, 80)).save(buf, format="JPEG")
    return buf.getvalue()


def _fake_run_models(_face_image):
    mock = ["redness", "pigmentation", "pores", "texture", "wrinkles", "scars", "uniformity"]
    return {
        "metrics": {"acne": 70.0, **{m: 50.0 for m in mock}},
        "confidence": 0.6,
        "is_mock_result": True,
        "mock_metrics": mock,
    }


def test_analyze_computes_and_persists_result(client, monkeypatch):
    monkeypatch.setattr(scans_module, "run_models", _fake_run_models)

    files = _files(front=("front.jpg", io.BytesIO(_real_jpeg()), "image/jpeg"))
    quality = '{"front": {"luma": 0.5, "imbalance": 0.05, "yaw": 0.5}}'
    scan_id = client.post("/api/scans", files=files, data={"consent": "true", "quality": quality}).json()["scan_id"]

    res = client.post(f"/api/scans/{scan_id}/analyze")
    assert res.status_code == 200
    body = res.json()
    assert body["metrics"]["acne"] == 70.0
    assert body["metrics"] == {"acne": 70.0}
    assert body["analysis_version"] == 2
    assert body["mock_metrics"] == ["redness", "pigmentation", "pores", "texture", "wrinkles", "scars", "uniformity"]
    assert body["is_mock_result"] is True
    assert body["overall_score"] == 70.0  # Never average simulated values into a real result.
    assert body["quality"]["lighting"] == 0.95  # 1 - |0.5-0.5|*2 - 0.05
    assert body["quality"]["position"] == 1.0  # yaw exactly centered

    got = client.get(f"/api/scans/{scan_id}").json()
    assert got["status"] == "analyzed"
    assert got["result"]["metrics"]["acne"] == 70.0


def test_analyze_missing_scan_is_404(client):
    assert client.post("/api/scans/scan_doesnotexist/analyze").status_code == 404


def test_analysis_respects_exif_orientation(client, monkeypatch):
    from PIL import Image
    image = Image.new("RGB", (20, 40), (120, 90, 80))
    exif = image.getexif(); exif[274] = 6
    stream = io.BytesIO(); image.save(stream, format="JPEG", exif=exif)
    def check(pixels):
        assert pixels.shape == (20, 40, 3)
        return _fake_run_models(pixels)
    monkeypatch.setattr(scans_module, "run_models", check)
    scan_id = client.post("/api/scans", files=_files(front=("front.jpg", stream.getvalue(), "image/jpeg")), data={"consent": "true"}).json()["scan_id"]
    assert client.post(f"/api/scans/{scan_id}/analyze").status_code == 200


def test_get_scan_image_roundtrip(client):
    jpeg = _real_jpeg()
    files = _files(front=("front.jpg", io.BytesIO(jpeg), "image/jpeg"))
    scan_id = client.post("/api/scans", files=files, data={"consent": "true"}).json()["scan_id"]

    res = client.get(f"/api/scans/{scan_id}/image/front")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    assert res.content == jpeg

    assert client.get(f"/api/scans/{scan_id}/image/left").status_code == 200
    assert client.get(f"/api/scans/scan_doesnotexist/image/front").status_code == 404


def test_analyze_undecodable_image_is_500(client):
    """The other tests' placeholder JPEG (magic bytes only) passes upload
    validation but analyze must fail loudly on it, not silently fake a result."""
    scan_id = client.post("/api/scans", files=_files(), data={"consent": "true"}).json()["scan_id"]
    assert client.post(f"/api/scans/{scan_id}/analyze").status_code == 500
