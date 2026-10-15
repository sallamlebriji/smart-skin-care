"""Real checkpoint execution check on synthetic input; does not test accuracy.

Run from backend/: python scripts/check_wrinkles.py
"""
import json
from pathlib import Path
import sys
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ai.wrinkle_model import predict_wrinkles

if __name__ == "__main__":
    print(json.dumps(predict_wrinkles(np.full((224, 224, 3), 128, dtype=np.uint8))))
    print("Synthetic execution check only; not an accuracy or clinical validation.")
