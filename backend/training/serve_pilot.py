"""Local-only severity research demo. No photos are stored or sent externally.

Run from backend/: python -m uvicorn training.serve_pilot:app --host 127.0.0.1 --port 8767
"""
from functools import lru_cache
from io import BytesIO
import json
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from starlette.concurrency import run_in_threadpool
import numpy as np
import onnxruntime as ort
import cv2
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1] / "data" / "wrinkle_training" / "pilot-severity-transfer"
app = FastAPI(title="Local wrinkle severity research demo", docs_url=None, redoc_url=None)


@lru_cache(maxsize=1)
def load():
    report = json.loads((ROOT / "evaluation.json").read_text(encoding="utf-8"))
    if report["labels"] != ["none", "mild", "moderate", "marked"] or report["annotation_origin"] != "ai_visual_provisional":
        raise ValueError("Unexpected pilot contract")
    options = ort.SessionOptions(); options.intra_op_num_threads = 2
    return report, ort.InferenceSession(str(ROOT / "severity.onnx"), sess_options=options, providers=["CPUExecutionProvider"])


def infer(data):
    try:
        with Image.open(BytesIO(data)) as original:
            if original.width * original.height > 20_000_000:
                raise ValueError("Image too large")
            image = ImageOps.exif_transpose(original).convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
    except (OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, "Photo illisible ou trop grande. Utilisez une photo JPEG/PNG de taille raisonnable.")
    detector = cv2.CascadeClassifier(str(Path(__file__).with_name("assets") / "haarcascade_frontalface_default.xml"))
    if detector.empty():
        raise HTTPException(503, "Le contrôle de présence du visage n'est pas disponible.")
    gray = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2GRAY)
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(40,40))
    if len(faces) != 1:
        raise HTTPException(422, "Utilisez une photo nette avec un seul visage de face, sans masque ni forte inclinaison.")
    try:
        report, model = load()
    except (OSError, ValueError):
        raise HTTPException(503, "Prototype non disponible. Exécutez d'abord training/train_transfer.py.")
    pixels = np.asarray(image, dtype=np.float32) / 255
    config = report["input"]
    pixels = (pixels - np.asarray(config["mean"], dtype=np.float32)) / np.asarray(config["std"], dtype=np.float32)
    logits = model.run(["logits"], {"image": pixels.transpose(2,0,1)[None].copy()})[0][0]
    if logits.shape != (4,) or not np.isfinite(logits).all():
        raise HTTPException(503, "Sortie du prototype invalide.")
    return {"label": report["labels"][int(logits.argmax())], "research_only": True,
            "annotation_origin": "ai_visual_provisional", "clinical_validation": False,
            "test_agreement": report["held_out_test"]["accuracy"],
            "test_images": sum(sum(row) for row in report["held_out_test"]["confusion_matrix"])}


@app.middleware("http")
async def no_store(request, call_next):
    response = await call_next(request); response.headers["Cache-Control"] = "no-store"; return response


@app.post("/predict")
async def predict(request: Request, photo: UploadFile = File(...)):
    origin = request.headers.get("origin")
    if origin and origin not in {"http://localhost:8767", "http://127.0.0.1:8767"}:
        raise HTTPException(403, "Origine non autorisée.")
    data = await photo.read(5_000_001)
    if len(data) > 5_000_000:
        raise HTTPException(413, "Choisissez une photo de moins de 5 Mo.")
    return await run_in_threadpool(infer, data)


@app.get("/", response_class=HTMLResponse)
def home():
    return Path(__file__).with_name("pilot.html").read_text(encoding="utf-8")
