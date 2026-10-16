"""Audit downloaded research archives, without treating concern/type labels as severity.

Run from backend: .venv/Scripts/python.exe training/audit_skin_datasets.py
Photos and generated reports remain in ignored data/. No upstream code is executed.
"""
import csv
import hashlib
from io import BytesIO, StringIO
import json
from collections import Counter
from pathlib import Path
import zipfile

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1] / "data" / "skin_dataset_search"
SOURCES = json.loads(Path(__file__).with_name("skin_sources.json").read_text(encoding="utf-8"))
EXTENSIONS = {".jpg", ".jpeg", ".png", ".jfif", ".webp"}


def audit(name, spec):
    archive = ROOT / f"{name}.zip"
    with archive.open("rb") as handle:
        checksum = hashlib.file_digest(handle, "sha256").hexdigest()
    if checksum != spec["sha256"]:
        raise ValueError(f"Archive checksum mismatch: {name}")
    hashes, classes, annotation_counts = {}, Counter(), Counter()
    unreadable, image_count, pore_count = 0, 0, 0
    pores = ROOT / "prepared_pores" / "images"
    pores.mkdir(parents=True, exist_ok=True)
    pore_records, scar_records = {}, {}
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError(f"Corrupt archive: {name}")
        for entry in z.infolist():
            if Path(entry.filename).suffix.lower() not in EXTENSIONS:
                if entry.filename.endswith("_annotations.csv"):
                    rows = csv.DictReader(StringIO(z.read(entry).decode("utf-8-sig")))
                    annotation_counts.update(row["class"] for row in rows)
                continue
            image_count += 1
            category = entry.filename.rsplit("/", 1)[0]
            classes[category] += 1
            try:
                with Image.open(BytesIO(z.read(entry))) as original:
                    im = ImageOps.exif_transpose(original).convert("RGB")
                    fingerprint = hashlib.sha256(str(im.size).encode() + im.tobytes()).hexdigest()
                    hashes[fingerprint] = hashes.get(fingerprint, 0) + 1
                    if "/pores/" in entry.filename:
                        pore_count += 1
                        # Content-derived names avoid unsafe extraction and source personal names.
                        im.save(pores / f"{fingerprint}.png")
                        pore_records[fingerprint] = {"file": f"images/{fingerprint}.png", "label": "pores",
                                                     "severity": None, "subject_id": None,
                                                     "split": None, "source_version": spec["version"]}
                    if name == "scarnet-research" and "/dataset/" in entry.filename:
                        folder = ROOT / "prepared_scars" / "images"
                        folder.mkdir(parents=True, exist_ok=True)
                        im.save(folder / f"{fingerprint}.png")
                        scar_records[fingerprint] = {"file": f"images/{fingerprint}.png",
                                                     "label": entry.filename.split("/dataset/")[1].split("/")[0],
                                                     "severity": None, "subject_id": None, "split": None,
                                                     "source_revision": spec["version"]}
            except (OSError, ValueError):
                unreadable += 1
    if pore_records:
        (pores.parent / "manifest.json").write_text(json.dumps(list(pore_records.values()), indent=2), encoding="utf-8")
    if scar_records:
        (ROOT / "prepared_scars" / "manifest.json").write_text(json.dumps(list(scar_records.values()), indent=2), encoding="utf-8")
    for folder, records in ((pores.parent, pore_records), (ROOT / "prepared_scars", scar_records)):
        # Preserve any review CSV already edited by a person.
        review = folder / "severity-to-review.csv"
        if records and not review.exists():
            with review.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["file", "sha256", "subject_id", "label", "split", "annotator", "original_type"])
                writer.writeheader()
                for fingerprint, row in records.items():
                    writer.writerow({"file": row["file"], "sha256": fingerprint, "original_type": row["label"]})
    return {"source": spec["source"], "archive_sha256": spec["sha256"], "images": image_count,
            "unique_pixel_images_exif_oriented": len(hashes), "duplicate_groups": sum(n > 1 for n in hashes.values()),
            "unreadable_images": unreadable, "categories": dict(classes),
            "bounding_box_classes": dict(annotation_counts), "pore_images": pore_count,
            "unique_pore_images": len(pore_records), "severity_labels_available": False,
            "unique_scar_images": len(scar_records),
            "subject_independent_split_available": False}


if __name__ == "__main__":
    reports = {name: audit(name, spec) for name, spec in SOURCES.items() if "version" in spec}
    (ROOT / "verified_audit.json").write_text(json.dumps(reports, indent=2), encoding="utf-8")
    print(json.dumps(reports, indent=2))
