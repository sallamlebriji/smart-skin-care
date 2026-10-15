"""
Phase 5's first real trained model: a community fine-tune of google/vit-base
for acne severity classification (imfarzanansari/skintelligent-acne, MIT
license, Hugging Face Transformers, ~35k downloads/month at time of writing).

Honesty note, on purpose: this is a public community checkpoint with no
published validation metrics, dataset citation, or clinical review — not a
certified diagnostic model. It is used here as a legitimate, permissively
licensed starting point for a real classifier (replacing the placeholder
random score in models.py), not presented as equivalent to a dermatologist's
assessment. See SAFETY_DISCLAIMER on the frontend for the user-facing wording.

The checkpoint's config.json actually ships 5 classes (verified directly —
its own README prose mentions a 6th "very severe" level that isn't in the
trained head, so that claim is not relied on here):
  level -1  clear skin        level 1  mild acne        level 3  severe acne
  level 0   occasional spots  level 2  moderate acne
"""

import threading

import numpy as np
from PIL import Image

MODEL_ID = "imfarzanansari/skintelligent-acne"
MODEL_REVISION = "f6ac6218b590f518d0a831472c7528b12bd53ae2"

# Higher = clearer skin, matching every other (mock) metric's score direction.
_LABEL_TO_SCORE = {
    "level -1": 96,
    "level 0": 78,
    "level 1": 58,
    "level 2": 38,
    "level 3": 18,
}

_lock = threading.Lock()
_pipe = None


def _get_pipeline():
    global _pipe
    if _pipe is None:
        with _lock:
            if _pipe is None:
                from transformers import pipeline

                _pipe = pipeline("image-classification", model=MODEL_ID, revision=MODEL_REVISION, trust_remote_code=False, model_kwargs={"use_safetensors": True})
    return _pipe


def is_loaded() -> bool:
    return _pipe is not None


def predict_acne_severity(face_image: np.ndarray) -> tuple[float, float, str]:
    """face_image: RGB numpy array (see BaseSkinModel.predict). Returns (score 0-100, confidence 0-1, raw label)."""
    image = Image.fromarray(face_image, mode="RGB")
    pipe = _get_pipeline()
    predictions = pipe(image)  # sorted by score desc: [{"label": ..., "score": ...}, ...]
    top = predictions[0]
    if top["label"] not in _LABEL_TO_SCORE:
        raise ValueError("Acne checkpoint returned a label outside its documented contract")
    score = _LABEL_TO_SCORE[top["label"]]
    return score, float(top["score"]), top["label"]
