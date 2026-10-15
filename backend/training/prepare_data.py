"""Fetch a small public Kaggle image pool and prepare EMPTY severity annotations.

The source provides binary labels only. Those labels are deliberately not reused
as severity. Run from backend/: python training/prepare_data.py
"""
import csv
import hashlib
import json
from pathlib import Path
import zipfile
import httpx
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1] / "data" / "wrinkle_training"
SOURCE = "rishantrokaha/skin-wrinkles-vs-nonwrinkles"


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    archive = ROOT / "source.zip"
    if not archive.exists():
        partial = ROOT / "source.zip.partial"
        try:
            with httpx.stream("GET", f"https://www.kaggle.com/api/v1/datasets/download/{SOURCE}", follow_redirects=True, timeout=120) as response:
                response.raise_for_status()
                size = 0
                with partial.open("wb") as output:
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > 120_000_000:
                            raise ValueError("Archive exceeds the download limit")
                        output.write(chunk)
            if not zipfile.is_zipfile(partial):
                raise ValueError("Kaggle did not return a ZIP; access may require authentication")
            partial.replace(archive)
        finally:
            partial.unlink(missing_ok=True)
    image_dir = ROOT / "images"
    image_dir.mkdir(exist_ok=True)
    records = {}
    with zipfile.ZipFile(archive) as bundle:
        if sum(item.file_size for item in bundle.infolist()) > 500_000_000:
            raise ValueError("Uncompressed archive is too large")
        for item in bundle.infolist():
            if Path(item.filename).suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            try:
                with bundle.open(item) as handle, Image.open(handle) as original:
                    image = ImageOps.exif_transpose(original).convert("RGB")
                    image.thumbnail((512, 512))
                    digest = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
                    image.save(image_dir / f"{digest}.png")
                    records[digest] = {"file": f"images/{digest}.png", "sha256": digest,
                                       "subject_id": "", "label": "", "split": "", "annotator": ""}
            except (OSError, ValueError):
                continue
    annotation = ROOT / "annotations.csv"
    if not annotation.exists():
        with annotation.open("w", newline="", encoding="utf-8") as output:
            writer = csv.DictWriter(output, fieldnames=["file", "sha256", "subject_id", "label", "split", "annotator"])
            writer.writeheader(); writer.writerows(records.values())
    provenance = {"source": f"https://www.kaggle.com/datasets/{SOURCE}",
                  "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                  "unique_images": len(records), "severity_annotations": "not provided by source; must be annotated",
                  "rights": "Publisher allows use with attribution to Rixant Rokaha; images collected from multiple websites. Underlying image rights require separate review before redistribution or commercial use."}
    (ROOT / "source.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    print(json.dumps({"images": len(records), "annotations": str(annotation), "severity_labels_created": 0}))


if __name__ == "__main__":
    main()
