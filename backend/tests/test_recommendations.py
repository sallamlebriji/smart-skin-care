import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import scans as scans_module
from app.main import app
from app.services.storage import LocalScanStorage

METRICS = {
    "acne": 30,  # triggers, high priority
    "redness": 55,  # triggers, low priority
    "pigmentation": 80,  # does not trigger
    "pores": 80,
    "texture": 80,
    "wrinkles": 80,
    "scars": 80,
    "uniformity": 80,
}


@pytest.fixture()
def client(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        monkeypatch.setattr(scans_module, "storage", LocalScanStorage(Path(tmp)))
        yield TestClient(app)


def _seed_analyzed_scan(mock_metrics=()):
    scans_module.storage.save_meta("scan_reco_test", {
        "scan_id": "scan_reco_test",
        "status": "analyzed",
        "result": {"metrics": METRICS, "mock_metrics": list(mock_metrics)},
    })


def _seed_unanalyzed_scan():
    scans_module.storage.save_meta("scan_reco_unanalyzed", {"scan_id": "scan_reco_unanalyzed", "status": "uploaded"})


def test_recommendations_trigger_on_low_scores_only(client):
    _seed_analyzed_scan()
    res = client.get("/api/recommendations", params={"scan_id": "scan_reco_test"})
    assert res.status_code == 200
    body = res.json()
    goals = [r["goal"] for r in body["recommendations"]]
    assert any("acne" in g.lower() for g in goals)
    assert any("redness" in g.lower() for g in goals)
    assert len(goals) == 2  # the other 6 metrics scored above threshold

    # worst score (acne, 30) must be sorted first and marked high priority
    assert body["recommendations"][0]["priority"] == "high"
    assert body["recommendations"][1]["priority"] == "low"
    assert body["is_mock_result"] is False
    assert body["mock_goals"] == []


def test_recommendations_flag_mock_derived_goals(client):
    _seed_analyzed_scan(mock_metrics=["redness"])
    body = client.get("/api/recommendations", params={"scan_id": "scan_reco_test"}).json()
    mock_flagged = [r for r in body["mock_goals"]]
    assert len(mock_flagged) == 1
    assert body["is_mock_result"] is True


def test_recommendations_404_for_missing_scan(client):
    assert client.get("/api/recommendations", params={"scan_id": "scan_nope"}).status_code == 404


def test_recommendations_409_for_unanalyzed_scan(client):
    _seed_unanalyzed_scan()
    res = client.get("/api/recommendations", params={"scan_id": "scan_reco_unanalyzed"})
    assert res.status_code == 409


def test_routine_includes_base_steps_and_triggered_ingredients(client):
    _seed_analyzed_scan()
    res = client.get("/api/routine", params={"scan_id": "scan_reco_test"})
    assert res.status_code == 200
    body = res.json()

    am_names = [s["name"] for s in body["morning"]]
    pm_names = [s["name"] for s in body["evening"]]
    assert "Gentle cleanser" in am_names and "Moisturizer" in am_names
    assert "Gentle cleanser" in pm_names and "Moisturizer" in pm_names

    # Salicylic acid (BHA) is photosensitizing/exfoliating — PM only, never AM.
    assert "Salicylic acid (BHA)" in pm_names
    assert "Salicylic acid (BHA)" not in am_names

    # orders are contiguous starting at 1, no gaps or duplicates
    orders = sorted(s["order"] for s in body["morning"])
    assert orders == list(range(1, len(orders) + 1))


def test_routine_404_for_missing_scan(client):
    assert client.get("/api/routine", params={"scan_id": "scan_nope"}).status_code == 404


def test_put_routine_requires_an_account(client):
    r = client.put("/api/routine")
    assert r.status_code == 401


def test_mock_metrics_cannot_add_steps_to_a_routine(client):
    _seed_analyzed_scan(mock_metrics=["acne", "redness"])
    body = client.get("/api/routine", params={"scan_id": "scan_reco_test"}).json()
    names = [step["name"] for step in body["morning"] + body["evening"]]
    assert "Salicylic acid (BHA)" not in names
    assert "Azelaic acid" not in names
