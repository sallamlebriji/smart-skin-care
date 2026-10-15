"""
Runs every registered model over a face crop and assembles the shared
SkinScanResult shape. Invoked by the scan analysis API; capture guidance
and face positioning are currently performed by the client.
"""

import numpy as np

from app.ai.models import ALL_MODELS


def run_models(face_image: np.ndarray) -> dict:
    outputs = [model_cls().predict(face_image) for model_cls in ALL_MODELS]
    mock_metrics = [o.metric_name for o in outputs if o.is_mock]

    return {
        "metrics": {o.metric_name: o.score for o in outputs},
        "confidence": min(o.confidence for o in outputs),
        "is_mock_result": bool(mock_metrics),  # the API layer must surface this, never hide it
        "mock_metrics": mock_metrics,  # which metrics specifically — not every score here is fake
    }
