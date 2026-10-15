"""Train a small CPU-friendly experimental 4-class wrinkle appearance model.

Requires real human annotations. Never derives severity from age or probabilities.
Run from backend/: python training/train_severity.py --annotations data/wrinkle_training/annotations.csv
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import random

import numpy as np
from PIL import Image, ImageOps

LABELS = ("none", "mild", "moderate", "marked")
SPLITS = ("train", "val", "test")


def read_annotations(path):
    path = Path(path).resolve()
    with path.open(encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("No annotated images")
    subjects, hashes = {}, {}
    counts = {split: {label: 0 for label in LABELS} for split in SPLITS}
    for row in rows:
        if row.get("label") not in LABELS or row.get("split") not in SPLITS or not row.get("subject_id", "").strip() or not row.get("annotator", "").strip():
            raise ValueError("Human severity label, subject_id, annotator and train/val/test split are required for EVERY row; blank labels cannot train a severity model")
        image = (path.parent / row["file"]).resolve()
        if not image.is_relative_to(path.parent) or not image.is_file():
            raise ValueError("Image must exist within the dataset directory")
        with Image.open(image) as original:
            pixels = ImageOps.exif_transpose(original).convert("RGB")
            fingerprint = hashlib.sha256(str(pixels.size).encode() + pixels.tobytes()).hexdigest()
        if row.get("sha256") != fingerprint:
            raise ValueError("Image fingerprint differs from annotations")
        if fingerprint in hashes:
            raise ValueError("Duplicate images must be removed before training")
        hashes[fingerprint] = row["split"]
        subject = row["subject_id"].strip()
        if subject in subjects and subjects[subject] != row["split"]:
            raise ValueError("Subject leakage across train/val/test splits")
        subjects[subject] = row["split"]
        counts[row["split"]][row["label"]] += 1
        row["path"] = image
    for split in SPLITS:
        minimum = 20 if split == "train" else 5
        if min(counts[split].values()) < minimum:
            raise ValueError(f"Need at least {minimum} real annotations per class in {split}; found {counts[split]}")
    return rows, counts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--annotations", required=True)
    parser.add_argument("--output", default="data/wrinkle_training/artifacts")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("epochs and batch size must be positive")
    rows, counts = read_annotations(args.annotations)
    import torch
    from torch import nn
    from torch.utils.data import Dataset, DataLoader
    from safetensors.torch import save_file
    random.seed(42); np.random.seed(42); torch.manual_seed(42)
    torch.set_num_threads(2)

    class Photos(Dataset):
        def __init__(self, split): self.rows = [row for row in rows if row["split"] == split]; self.split = split
        def __len__(self): return len(self.rows)
        def __getitem__(self, index):
            row = self.rows[index]
            with Image.open(row["path"]) as original:
                image = ImageOps.exif_transpose(original).convert("RGB").resize((128, 128), Image.Resampling.BILINEAR)
                if self.split == "train" and random.random() < 0.5: image = ImageOps.mirror(image)
                pixels = np.asarray(image, dtype=np.float32) / 255
            return torch.from_numpy(pixels.transpose(2, 0, 1).copy()), LABELS.index(row["label"])

    model = nn.Sequential(nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                          nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                          nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(1),
                          nn.Flatten(), nn.Linear(64, 4))
    loaders = {split: DataLoader(Photos(split), batch_size=args.batch_size, shuffle=split == "train", num_workers=0) for split in SPLITS}
    weights = torch.tensor([1 / counts["train"][label] for label in LABELS]); weights /= weights.mean()
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    def evaluate(split):
        model.eval(); confusion = np.zeros((4, 4), dtype=int)
        with torch.inference_mode():
            for pixels, labels in loaders[split]:
                for truth, predicted in zip(labels.tolist(), model(pixels).argmax(1).tolist()): confusion[truth, predicted] += 1
        f1 = [2 * confusion[i, i] / max(1, confusion[i].sum() + confusion[:, i].sum()) for i in range(4)]
        return {"macro_f1": float(np.mean(f1)), "accuracy": float(confusion.trace() / confusion.sum()), "confusion_matrix": confusion.tolist()}

    best, best_weights, history = -1, None, []
    for epoch in range(args.epochs):
        model.train()
        for pixels, labels in loaders["train"]:
            optimizer.zero_grad(); loss = criterion(model(pixels), labels); loss.backward(); optimizer.step()
        result = evaluate("val"); history.append(result)
        print(json.dumps({"epoch": epoch + 1, "validation": result}), flush=True)
        if result["macro_f1"] > best:
            best = result["macro_f1"]; best_weights = {key: value.detach().clone() for key, value in model.state_dict().items()}
    model.load_state_dict(best_weights); model.eval()
    test = evaluate("test")  # test set evaluated only after model selection
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    save_file(model.state_dict(), str(output / "severity.safetensors"))
    torch.onnx.export(model, torch.zeros(1, 3, 128, 128), str(output / "severity.onnx"),
                      input_names=["image"], output_names=["logits"], opset_version=17, dynamo=False)
    import onnxruntime as ort
    probe = np.random.default_rng(42).random((1, 3, 128, 128), dtype=np.float32)
    with torch.inference_mode(): expected = model(torch.from_numpy(probe)).numpy()
    actual = ort.InferenceSession(str(output / "severity.onnx"), providers=["CPUExecutionProvider"]).run(None, {"image": probe})[0]
    np.testing.assert_allclose(actual, expected, rtol=1e-4, atol=1e-5)
    report = {"labels": LABELS, "counts": counts, "seed": 42, "validation_history": history, "held_out_test": test,
              "dataset_sha256": hashlib.sha256(Path(args.annotations).read_bytes()).hexdigest(),
              "input": {"shape": [1, 3, 128, 128], "rgb": True, "scaling": "divide by 255", "resize": "stretch"},
              "experimental": True, "clinical_validation": False, "automatically_activated": False}
    (output / "evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Experimental model exported. Review held-out performance before any application integration.")


if __name__ == "__main__":
    main()
