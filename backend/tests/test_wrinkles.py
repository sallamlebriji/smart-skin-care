import numpy as np
import pytest
from app.ai import wrinkle_model


@pytest.mark.parametrize("probability,label", [(0.8, "wrinkle"), (0.1, "non-wrinkle"), (0.5, "non-wrinkle")])
def test_binary_probability_never_becomes_severity(monkeypatch, probability, label):
    monkeypatch.setattr(wrinkle_model, "_get_pipeline", lambda: lambda image, **kwargs: [
        {"label": "wrinkle", "score": probability}, {"label": "non-wrinkle", "score": 1-probability}])
    result = wrinkle_model.predict_wrinkles(np.zeros((24, 24, 3), dtype=np.uint8))
    assert result["label"] == label
    assert result["wrinkle_probability"] == probability
    assert result["revision"] == wrinkle_model.MODEL_REVISION
    assert result["experimental"] is True
    assert "score" not in result and "severity" not in result


@pytest.mark.parametrize("predictions", [
    [{"label": "unknown", "score": 1}],
    [{"label": "wrinkle", "score": float("nan")}, {"label": "non-wrinkle", "score": 0.2}],
    [{"label": "wrinkle", "score": 0.9}, {"label": "non-wrinkle", "score": 0.9}],
    [{"label": "wrinkle", "score": -0.2}, {"label": "non-wrinkle", "score": 1.2}],
])
def test_invalid_model_contract_is_rejected(monkeypatch, predictions):
    monkeypatch.setattr(wrinkle_model, "_get_pipeline", lambda: lambda image, **kwargs: predictions)
    with pytest.raises(ValueError):
        wrinkle_model.predict_wrinkles(np.zeros((24, 24, 3), dtype=np.uint8))
