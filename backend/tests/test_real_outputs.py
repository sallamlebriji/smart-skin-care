import numpy as np
import pytest
from app.ai import aggregation, models, acne_model
from app.config import settings


@pytest.fixture()
def actual_outputs(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
    monkeypatch.setattr(models, "predict_acne_severity", lambda image: (58, 0.75, "level 1"))
    monkeypatch.setattr(models, "predict_wrinkles", lambda image: {
        "label": "wrinkle", "wrinkle_probability": 0.8, "model": "test-only-wrinkle-model", "revision": "test-revision"})


def test_no_random_or_placeholder_numbers_are_generated(actual_outputs):
    output = aggregation.run_models(np.zeros((32, 32, 3), dtype=np.uint8))
    assert output["metrics"] == {"acne": 58}
    assert set(output["unavailable_metrics"]) == {"redness", "pigmentation", "pores", "texture", "scars", "uniformity"}
    assert output["model_assessments"]["acne"]["label"] == "level 1"
    assert output["model_assessments"]["acne"]["probability"] == 0.75
    assert output["model_assessments"]["wrinkles"]["label"] == "wrinkle"
    assert output["model_assessments"]["wrinkles"]["probability"] == 0.8
    assert "wrinkles" not in output["metrics"]  # presence probability is never turned into severity


def test_optional_wrinkle_failure_does_not_invent_a_value_or_hide_acne(actual_outputs, monkeypatch):
    def fail(image): raise RuntimeError("model unavailable")
    monkeypatch.setattr(models, "predict_wrinkles", fail)
    result = aggregation.run_models(np.zeros((32, 32, 3), dtype=np.uint8))
    assert result["metrics"] == {"acne": 58}
    assert "wrinkles" in result["unavailable_metrics"]
    assert "wrinkles" not in result["model_assessments"]


@pytest.mark.parametrize("probability", [float("nan"), float("inf"), -0.1, 1.1])
def test_invalid_acne_probability_is_rejected(monkeypatch, probability):
    monkeypatch.setattr(acne_model, "_get_pipeline", lambda: lambda image: [{"label": "level 1", "score": probability}])
    with pytest.raises(ValueError, match="probability"):
        acne_model.predict_acne_severity(np.zeros((32, 32, 3), dtype=np.uint8))
