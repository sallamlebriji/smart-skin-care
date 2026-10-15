"""Download/load the pinned acne checkpoint and run real inference, without storing photos.

Run from backend/: python scripts/check_model.py [path-to-test-photo]
Without a photo this uses a synthetic image to check execution, not accuracy.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ai.acne_model import MODEL_ID, MODEL_REVISION, predict_acne_severity


def main():
    if len(sys.argv) > 2:
        raise SystemExit("Usage: python scripts/check_model.py [photo]")
    if len(sys.argv) == 2:
        with Image.open(sys.argv[1]) as image:
            pixels = np.asarray(ImageOps.exif_transpose(image).convert("RGB"))
    else:
        pixels = np.full((224, 224, 3), 128, dtype=np.uint8)
    score, confidence, label = predict_acne_severity(pixels)
    if not (0 <= score <= 100 and 0 <= confidence <= 1):
        raise RuntimeError("Invalid model output")
    print(json.dumps({"model": MODEL_ID, "revision": MODEL_REVISION,
                      "inference_passed": True, "synthetic_input": len(sys.argv) == 1,
                      "label": label, "score": score, "confidence": confidence}))
    print("Execution check only; this does not validate accuracy or clinical use.")


if __name__ == "__main__":
    main()
