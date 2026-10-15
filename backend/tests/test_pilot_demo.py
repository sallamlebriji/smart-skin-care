from io import BytesIO
from fastapi.testclient import TestClient
from PIL import Image
from training.serve_pilot import app


def test_local_demo_blocks_foreign_origin():
    response = TestClient(app).post("/predict", files={"photo": ("photo.jpg", b"not an image", "image/jpeg")}, headers={"Origin": "https://external.example"})
    assert response.status_code == 403


def test_local_demo_rejects_unreadable_and_faceless_input():
    client = TestClient(app)
    response = client.post("/predict", files={"photo": ("photo.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 422
    data = BytesIO(); Image.new("RGB", (224,224)).save(data, format="PNG")
    assert client.post("/predict", files={"photo": ("photo.png", data.getvalue(), "image/png")}).status_code == 422


def test_local_demo_upload_limit_and_cache_control():
    client = TestClient(app)
    assert client.get("/").headers["cache-control"] == "no-store"
    assert client.post("/predict", files={"photo": ("photo.png", b"x"*5_000_001, "image/png")}).status_code == 413
