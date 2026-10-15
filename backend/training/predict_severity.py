"""Run the local research prototype; never interprets probability as severity."""
import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="data/wrinkle_training/pilot-severity")
    parser.add_argument("--photo", required=True)
    args = parser.parse_args()
    directory = Path(args.model_dir)
    report = json.loads((directory / "evaluation.json").read_text(encoding="utf-8"))
    if report["labels"] != ["none", "mild", "moderate", "marked"]:
        raise ValueError("Unexpected severity class contract")
    with Image.open(args.photo) as original:
        config = report["input"]
        height, width = config["shape"][2:]
        image = ImageOps.exif_transpose(original).convert("RGB").resize((width, height), Image.Resampling.BILINEAR)
        pixels = np.asarray(image, dtype=np.float32) / 255
        pixels = (pixels - np.asarray(config.get("mean", [0, 0, 0]), dtype=np.float32)) / np.asarray(config.get("std", [1, 1, 1]), dtype=np.float32)
        tensor = pixels.transpose(2, 0, 1)[None].copy()
    model = ort.InferenceSession(str(directory / "severity.onnx"), providers=["CPUExecutionProvider"])
    logits = model.run(["logits"], {"image": tensor})[0][0]
    if logits.shape != (4,) or not np.isfinite(logits).all():
        raise ValueError("Invalid classifier output")
    probabilities = np.exp(logits - logits.max()); probabilities /= probabilities.sum()
    print(json.dumps({"predicted_class": report["labels"][int(logits.argmax())],
                      "class_probabilities": dict(zip(report["labels"], probabilities.tolist())),
                      "annotation_origin": report["annotation_origin"],
                      "research_only": True, "clinical_validation": False}, indent=2))
    print("Provisional research prediction only. Review evaluation.json; probabilities are not severity measurements.")


if __name__ == "__main__":
    main()
