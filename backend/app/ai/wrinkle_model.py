"""Experimental binary presence classifier; not a wrinkle severity score."""
import math
import threading

import numpy as np
from PIL import Image

MODEL_ID = "imfarzanansari/skintelligent-wrinkles"
MODEL_REVISION = "32ddddd41a7e035bbe3abbe4510e0a0ca4b6fb12"
_lock = threading.Lock()
_pipe = None


def _get_pipeline():
    global _pipe
    if _pipe is None:
        with _lock:
            if _pipe is None:
                from transformers import pipeline
                _pipe = pipeline("image-classification", model=MODEL_ID,
                                 revision=MODEL_REVISION, trust_remote_code=False,
                                 use_fast=False, model_kwargs={"use_safetensors": True})
    return _pipe


def predict_wrinkles(image: np.ndarray) -> dict:
    predictions = _get_pipeline()(Image.fromarray(image).convert("RGB"), top_k=None)
    probabilities = {item["label"]: float(item["score"]) for item in predictions}
    if len(predictions) != 2 or set(probabilities) != {"wrinkle", "non-wrinkle"}:
        raise ValueError("Wrinkle checkpoint returned unexpected labels")
    if any(not math.isfinite(p) or not 0 <= p <= 1 for p in probabilities.values()) or not math.isclose(sum(probabilities.values()), 1, abs_tol=1e-4):
        raise ValueError("Wrinkle checkpoint returned invalid probabilities")
    detected = probabilities["wrinkle"] > probabilities["non-wrinkle"]
    return {"label": "wrinkle" if detected else "non-wrinkle",
            "wrinkle_probability": probabilities["wrinkle"],
            "model": MODEL_ID, "revision": MODEL_REVISION, "experimental": True}
