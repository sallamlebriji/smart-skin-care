"""
Runs every registered model over a face crop and assembles the shared
SkinScanResult shape. Invoked by the scan analysis API; capture guidance
and face positioning are currently performed by the client.
"""

import numpy as np

from app.ai.models import ALL_MODELS


def run_models(face_image: np.ndarray) -> dict:
    outputs = [model_cls().predict(face_image) for model_cls in ALL_MODELS]
    unavailable = [o.metric_name for o in outputs if o.is_mock]
    # Keep this legacy exclusion list for older web/native clients. Binary presence is not a severity index.
    mock_metrics = [o.metric_name for o in outputs if o.is_mock or o.score is None]
    measured = [o for o in outputs if not o.is_mock]

    return {
        "metrics": {o.metric_name: o.score for o in measured if o.score is not None},
        "confidence": min((o.confidence for o in measured), default=0),
        "is_mock_result": bool(mock_metrics),  # Legacy partial-index flag; no fabricated values are generated.
        "mock_metrics": mock_metrics,  # Legacy exclusion list, also excludes binary classifications from indices.
        "unavailable_metrics": unavailable,
        "model_assessments": {o.metric_name: {"label": o.label, "probability": o.confidence,
            "source": o.source, "revision": o.revision, "experimental": True}
            for o in measured if o.label is not None},
    }
