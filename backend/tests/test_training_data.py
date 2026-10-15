import csv
import hashlib
from pathlib import Path
import pytest
from PIL import Image
from training.train_severity import read_annotations


def dataset(tmp_path):
    rows = []
    for label in ("none", "mild", "moderate", "marked"):
        for split, count in (("train", 20), ("val", 5), ("test", 5)):
            for _ in range(count):
                index = len(rows)
                image = Image.new("RGB", (16, 16), (index, 20, 30))
                filename = f"{index}.png"; image.save(tmp_path / filename)
                digest = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
                rows.append(dict(file=filename, sha256=digest, subject_id=f"person-{index}", label=label, split=split, annotator="fixture-only"))
    return rows


def write(tmp_path, rows):
    path = tmp_path / "annotations.csv"
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys()); writer.writeheader(); writer.writerows(rows)
    return path


def test_valid_grouped_annotations(tmp_path):
    rows, counts = read_annotations(write(tmp_path, dataset(tmp_path)))
    assert len(rows) == 120 and counts["test"]["marked"] == 5


@pytest.mark.parametrize("fault", ["blank", "leakage", "duplicate", "tampered", "missing_class"])
def test_training_rejects_invalid_or_leaking_annotations(tmp_path, fault):
    rows = dataset(tmp_path)
    if fault == "blank": rows[0]["label"] = ""
    if fault == "leakage": rows[20]["subject_id"] = rows[0]["subject_id"]
    if fault == "duplicate": rows[1] = rows[0].copy()
    if fault == "tampered": rows[0]["sha256"] = "0" * 64
    if fault == "missing_class": rows = [r for r in rows if not (r["split"] == "test" and r["label"] == "marked")]
    with pytest.raises(ValueError): read_annotations(write(tmp_path, rows))


def test_ai_labels_cannot_be_reported_as_human_reviewed(tmp_path, monkeypatch):
    from training.train_severity import main
    rows = dataset(tmp_path)
    rows[0]["annotator"] = "ai:visual-provisional"
    path = write(tmp_path, rows)
    monkeypatch.setattr("sys.argv", ["train_severity.py", "--annotations", str(path)])
    with pytest.raises(SystemExit) as error:
        main()
    assert error.value.code == 2
