from test_accounts import clients, upload  # shared isolated database/storage fixture


def native(client, email="native@example.com", action="register"):
    response = client.post(f"/api/mobile/auth/{action}", json={"email": email, "password": "example-password"})
    assert response.status_code == (201 if action == "register" else 200), response.text
    assert "set-cookie" not in response.headers
    body = response.json()
    assert body["token_type"] == "bearer" and body["expires_in"] > 0
    client.headers["Authorization"] = f"Bearer {body['access_token']}"
    return body


def test_native_rotation_reuse_and_logout(clients):
    first, second = clients
    old = native(first)
    assert first.get("/api/auth/me").json() == old["user"]
    response = first.post("/api/mobile/auth/refresh", json={"refresh_token": old["refresh_token"]})
    assert response.status_code == 200 and "set-cookie" not in response.headers
    new = response.json()
    assert new["refresh_token"] != old["refresh_token"]
    assert first.get("/api/auth/me").status_code == 401
    assert second.post("/api/mobile/auth/refresh", json={"refresh_token": old["refresh_token"]}).status_code == 401
    first.headers["Authorization"] = f"Bearer {new['access_token']}"
    assert first.get("/api/profile").status_code == 200
    assert first.post("/api/mobile/auth/logout", json={"refresh_token": new["refresh_token"]}).status_code == 204
    assert first.get("/api/auth/me").status_code == 401
    assert first.post("/api/mobile/auth/refresh", json={"refresh_token": new["refresh_token"]}).status_code == 401


def test_native_ownership_and_web_compatibility(clients):
    first, second = clients
    native(first)
    native(second, "other@example.com")
    scan_id = upload(first)["scan_id"]
    assert first.get("/api/scans").json()[0]["scan_id"] == scan_id
    assert second.get("/api/scans").json() == []
    for suffix in ("", "/image/front"):
        assert second.get(f"/api/scans/{scan_id}{suffix}").status_code == 404
    assert second.delete(f"/api/scans/{scan_id}").status_code == 404
    assert second.post(f"/api/scans/{scan_id}/analyze").status_code == 404
    first.headers.pop("Authorization")
    assert first.post("/api/auth/login", json={"email": "native@example.com", "password": "example-password"}).status_code == 200
    assert first.get("/api/scans").status_code == 200
    for authorization in ("Basic ignored", "Bearer ", "Bearer invalid"):
        assert first.get("/api/auth/me", headers={"Authorization": authorization}).status_code == 401


def test_native_login_validation_and_origin(clients):
    first, _ = clients
    native(first)
    native(first, action="login")
    assert first.post("/api/mobile/auth/login", json={"email": "native@example.com", "password": "wrong-password"}).status_code == 401
    assert first.post("/api/mobile/auth/refresh", json={"refresh_token": "x"}, headers={"Origin": "https://attacker.example"}).status_code == 403
    assert first.post("/api/mobile/auth/logout", json={}).status_code == 422
