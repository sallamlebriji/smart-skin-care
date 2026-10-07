"""Run against an isolated local backend; creates synthetic test accounts only.

Example: python scripts/smoke_check.py http://localhost:8001
"""
import io
import secrets
import sys
import httpx
from PIL import Image

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001"
email = "smoke-" + secrets.token_hex(6) + "@example.invalid"
password = secrets.token_urlsafe(24)
with httpx.Client(base_url=base, timeout=15, headers={"Origin": "http://localhost:5174"}) as first, httpx.Client(base_url=base, timeout=15) as second:
    assert first.get("/api/health").json() == {"status": "ok"}
    account = first.post("/api/auth/register", json={"email": email, "password": password})
    assert account.status_code == 201, account.text
    assert account.headers["access-control-allow-origin"] == "http://localhost:5174"
    assert first.get("/api/auth/me").json()["email"] == email
    assert second.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200
    routine = {"morning": [{"order": 1, "name": "Synthetic test step"}], "evening": []}
    assert first.put("/api/routine", json=routine).status_code == 200
    assert second.get("/api/routine/saved").json()["morning"][0]["name"] == "Synthetic test step"
    stream = io.BytesIO()
    Image.new("RGB", (32, 32), (120, 90, 70)).save(stream, format="JPEG")
    scan = first.post("/api/scans", files={angle: ("test.jpg", stream.getvalue(), "image/jpeg") for angle in ("front", "left", "right")}, data={"consent": "true"})
    assert scan.status_code == 201, scan.text
    scan_id = scan.json()["scan_id"]
    assert second.get("/api/scans").json()[0]["scan_id"] == scan_id
    assert second.get(f"/api/scans/{scan_id}/image/front").status_code == 200
    chat = first.post("/api/chat", json={"message": "Summarize my saved scans", "allow_external_ai": False})
    assert chat.status_code == 200 and chat.json()["provider"] == "local"
    assert len(second.get("/api/chat/history").json()["messages"]) == 2
    assert first.delete(f"/api/scans/{scan_id}").status_code == 204
    assert second.get("/api/scans").json() == []
    assert first.delete("/api/chat/history").status_code == 204
    assert first.post("/api/auth/refresh").status_code == 200
    assert first.post("/api/auth/logout").status_code == 204
    assert first.get("/api/auth/me").status_code == 401
    assert second.post("/api/auth/logout").status_code == 204
print("Live HTTP check passed: accounts, CORS, cookies, cross-session scans, saved routine, local chat, deletion and logout.")
