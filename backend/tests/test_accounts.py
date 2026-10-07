import io
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api import scans as scans_module
from app.database import session as db_module
from app.database.models import User, AuthSession, SkinScan
from app.services.storage import LocalScanStorage
from app.config import settings


@pytest.fixture()
def clients(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    db_module.Base.metadata.create_all(engine)
    monkeypatch.setattr(db_module, "SessionLocal", sessionmaker(bind=engine))
    monkeypatch.setattr(db_module, "_initialized", True)
    monkeypatch.setattr(scans_module, "storage", LocalScanStorage(tmp_path))
    monkeypatch.setattr(settings, "openai_api_key", "")
    yield TestClient(app), TestClient(app)
    engine.dispose()


def register(client, email="one@example.com"):
    response = client.post("/api/auth/register", json={"email": email, "password": "example-password"})
    assert response.status_code == 201, response.text
    assert "HttpOnly" in response.headers["set-cookie"]
    return response.json()


def upload(client):
    image = b"\xff\xd8\xff\xe0" + b"\x00" * 64
    response = client.post("/api/scans", files={angle: ("face.jpg", io.BytesIO(image), "image/jpeg")
                                               for angle in ("front", "left", "right")}, data={"consent": "true"})
    assert response.status_code == 201, response.text
    return response.json()


def test_registration_login_profile_and_password_storage(clients):
    first, _ = clients
    user = register(first, " One@Example.com ")
    assert user["email"] == "one@example.com"
    assert first.get("/api/auth/me").json() == user
    with db_module.SessionLocal() as db:
        stored = db.scalar(select(User))
        assert stored.hashed_password.startswith("scrypt$")
        assert "example-password" not in stored.hashed_password
    assert first.post("/api/auth/register", json={"email": "one@example.com", "password": "another-password"}).status_code == 409
    body = {"display_name": "Sam", "skin_type": "dry", "goals": ["Track my routine"], "consent_data_use": False}
    assert first.put("/api/profile", json=body).json() == body
    assert first.get("/api/profile").json() == body
    first.post("/api/auth/logout")
    assert first.get("/api/profile").status_code == 401
    assert first.post("/api/auth/login", json={"email": "one@example.com", "password": "wrong-password"}).status_code == 401
    assert first.post("/api/auth/login", json={"email": "one@example.com", "password": "example-password"}).status_code == 200


def test_validation_and_origin(clients):
    first, _ = clients
    assert first.post("/api/auth/register", json={"email": "invalid", "password": "short"}).status_code == 422
    assert first.post("/api/auth/register", json={"email": "one@example.com", "password": "example-password"}, headers={"Origin": "https://attacker.example"}).status_code == 403
    register(first)
    assert first.put("/api/profile", json={"skin_type": "invented"}).status_code == 422
    assert first.post("/api/chat", json={"message": "  "}).status_code == 422


def test_refresh_rotation_and_logout_revoke_access(clients):
    first, second = clients
    register(first)
    old_refresh = first.cookies.get("skin_refresh")
    old_access = first.cookies.get("skin_access")
    assert first.post("/api/auth/refresh").status_code == 200
    second.cookies.set("skin_refresh", old_refresh, path="/api/auth")
    assert second.post("/api/auth/refresh").status_code == 401
    second.cookies.set("skin_access", old_access, path="/api")
    assert second.get("/api/auth/me").status_code == 401
    copied_access = first.cookies.get("skin_access")
    assert first.post("/api/auth/logout").status_code == 204
    second.cookies.set("skin_access", copied_access, path="/api")
    assert second.get("/api/auth/me").status_code == 401
    with db_module.SessionLocal() as db:
        assert db.scalar(select(AuthSession)) is None


def test_account_scans_cannot_be_read_deleted_or_analyzed_by_others(clients):
    first, second = clients
    register(first)
    register(second, "two@example.com")
    scan = upload(first)
    scan_id = scan["scan_id"]
    assert first.get("/api/scans").json()[0]["scan_id"] == scan_id
    assert second.get("/api/scans").json() == []
    for path in (f"/api/scans/{scan_id}", f"/api/scans/{scan_id}/image/front",
                 f"/api/recommendations?scan_id={scan_id}", f"/api/routine?scan_id={scan_id}"):
        assert second.get(path).status_code == 404
    assert second.delete(f"/api/scans/{scan_id}").status_code == 404
    assert second.post(f"/api/scans/{scan_id}/analyze").status_code == 404
    assert first.get(f"/api/scans/{scan_id}/image/front").status_code == 200
    assert first.delete(f"/api/scans/{scan_id}").status_code == 204
    assert first.get("/api/scans").json() == []
    with db_module.SessionLocal() as db:
        assert db.get(SkinScan, scan_id) is None


def test_routine_and_conversations_are_account_scoped(clients):
    first, second = clients
    register(first)
    register(second, "two@example.com")
    routine = {"morning": [{"order": 1, "name": "My cleanser", "reason": None, "frequency": "Daily"}], "evening": []}
    assert first.put("/api/routine", json=routine).json() == routine
    assert first.get("/api/routine/saved").json() == routine
    assert second.get("/api/routine/saved").json() is None
    response = first.post("/api/chat", json={"message": "Explain my scan"})
    assert response.status_code == 200 and response.json()["provider"] == "local"
    assert len(first.get("/api/chat/history").json()["messages"]) == 2
    assert second.get("/api/chat/history").json()["messages"] == []
    assert first.delete("/api/chat/history").status_code == 204
    assert first.get("/api/chat/history").json()["messages"] == []


def test_chat_context_excludes_mock_scores_and_private_data(clients, monkeypatch):
    first, _ = clients
    user = register(first)
    with db_module.SessionLocal() as db:
        db.add(SkinScan(id="scan_context", user_id=user["id"], capture_mode="camera", created_at=datetime(2026, 1, 1),
                        result={"metrics": {"acne": 58, "redness": 99}, "mock_metrics": ["redness"], "overall_score": 88, "skin_type_estimate": "oily"}))
        db.commit()
    import app.api.chat as chat_module
    def capture(message, context, history, allow):
        assert context["scans"][0]["metrics"] == {"acne": 58}
        assert "overall_score" not in str(context)
        assert "one@example.com" not in str(context)
        assert allow is False
        return "Only acne was analyzed.", "local"
    monkeypatch.setattr(chat_module, "generate_reply", capture)
    assert first.post("/api/chat", json={"message": "Summarize"}).status_code == 200


def test_expired_account_requests_do_not_silently_create_guest_scans(clients):
    first, _ = clients
    register(first)
    first.cookies.delete("skin_access", domain="testserver.local", path="/api")
    assert first.get("/api/auth/me").status_code == 401
    image = b"\xff\xd8\xff" + b"\x00" * 64
    files = {angle: ("face.jpg", image, "image/jpeg") for angle in ("front", "left", "right")}
    assert first.post("/api/scans", files=files, data={"consent": "true"}).status_code == 401
    assert first.post("/api/auth/refresh").status_code == 200
    assert first.get("/api/auth/me").status_code == 200
    first.cookies.clear()
    assert first.post("/api/scans", files=files, data={"consent": "true"}, headers={"X-Account-Session": "true"}).status_code == 401


def test_account_routine_validation_and_private_response_headers(clients):
    first, _ = clients
    register(first)
    assert first.get("/api/profile").headers["cache-control"] == "private, no-store"
    assert first.put("/api/routine", json={"morning": [{"name": " ", "order": 1}], "evening": []}).status_code == 422
    assert first.put("/api/routine", json={"morning": [{"name": "Step", "order": 1}] * 21, "evening": []}).status_code == 422


def test_analyzed_scan_syncs_across_account_sessions(clients, monkeypatch):
    from PIL import Image
    first, second = clients
    register(first)
    stream = io.BytesIO()
    Image.new("RGB", (32, 32), (120, 90, 70)).save(stream, format="JPEG")
    response = first.post("/api/scans", files={angle: ("face.jpg", stream.getvalue(), "image/jpeg") for angle in ("front", "left", "right")}, data={"consent": "true"})
    scan = response.json()
    metrics = {key: 75 for key in ("acne", "redness", "pigmentation", "pores", "texture", "wrinkles", "scars", "uniformity")}
    monkeypatch.setattr(scans_module, "run_models", lambda _: {"metrics": metrics, "confidence": 0.7, "is_mock_result": True, "mock_metrics": [key for key in metrics if key != "acne"]})
    analyzed = first.post(f"/api/scans/{scan['scan_id']}/analyze")
    assert analyzed.status_code == 200
    assert analyzed.json()["created_at"] == scan["created_at"]
    assert second.post("/api/auth/login", json={"email": "one@example.com", "password": "example-password"}).status_code == 200
    history = second.get("/api/scans").json()
    assert history[0]["result"]["metrics"]["acne"] == 75
    assert second.get(f"/api/scans/{scan['scan_id']}/image/front").status_code == 200


def test_chat_handles_uploaded_but_unanalyzed_scans(clients):
    first, _ = clients
    register(first)
    scan = upload(first)
    from sqlalchemy import text
    with db_module.SessionLocal() as db:
        # Earlier JSON columns stored Python None as JSON null, not SQL NULL.
        db.execute(text("UPDATE skin_scans SET result = 'null' WHERE id = :id"), {"id": scan["scan_id"]})
        db.commit()
    result = first.post("/api/chat", json={"message": "Summarize my scans"})
    assert result.status_code == 200
    assert "No analyzed scans" in result.json()["answer"]
