"""Reproduce the explicitly AI-preannotated research pilot, without serving images publicly."""
import csv
import hashlib
from io import BytesIO
import json
from pathlib import Path
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageOps


def main():
    manifest = json.loads(Path(__file__).with_name("pilot_annotations.json").read_text(encoding="utf-8"))
    root = Path(__file__).resolve().parents[1] / "data" / "wrinkle_training"
    root.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        pages = {}
        for record in manifest["records"]:
            target = (root / record["file"]).resolve()
            if not target.is_relative_to(root.resolve()):
                raise ValueError("Invalid image path in pilot manifest")
            if not target.exists():
                split, index = record["source_split"], record["source_index"]
                offset = index // 100 * 100
                key = (split, offset)
                if key not in pages:
                    response = client.get("https://datasets-server.huggingface.co/rows", params={"dataset": manifest["dataset"], "config": "default", "split": split, "offset": offset, "length": 100})
                    response.raise_for_status()
                    pages[key] = {row["row_idx"]: row for row in response.json()["rows"]}
                source = pages[key][index]["row"]["pixel_values"]["src"]
                if urlparse(source).scheme != "https" or urlparse(source).hostname != "datasets-server.huggingface.co":
                    raise ValueError("Unexpected public image asset host")
                response = client.get(source); response.raise_for_status()
                if len(response.content) > 8_000_000:
                    raise ValueError("Image exceeds pilot download limit")
                with Image.open(BytesIO(response.content)) as original:
                    image = ImageOps.exif_transpose(original).convert("RGB")
                    digest = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
                    if digest != record["sha256"]:
                        raise ValueError("Dataset image changed; review provenance instead of silently reusing labels")
                    target.parent.mkdir(parents=True, exist_ok=True); image.save(target)
            with Image.open(target) as original:
                image = original.convert("RGB")
                if hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest() != record["sha256"]:
                    raise ValueError("Local image differs from annotated pilot")
    fields = ["file", "sha256", "subject_id", "label", "split", "annotator"]
    destination = root / "annotations-ai-pilot.csv"
    with destination.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader(); writer.writerows(manifest["records"])
    print(f"Prepared {len(manifest['records'])} AI-provisional annotations at {destination}. Not clinician-reviewed.")


if __name__ == "__main__":
    main()
