"""
Adapter interface every per-indicator model implements (spec §11). Phase 1
ships this contract plus mock adapters (see app/ai/models/) so the
aggregation pipeline and API shape are real, even though no model is
trained yet. Swapping a mock for a real PyTorch model later means writing
one class here — nothing upstream should need to change.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class ModelOutput:
    metric_name: str
    score: float  # 0-100 estimated appearance score
    confidence: float  # 0-1
    is_mock: bool  # never present mock output as a real production result


class BaseSkinModel(ABC):
    metric_name: str

    @abstractmethod
    def predict(self, face_image: np.ndarray) -> ModelOutput:
        """face_image: aligned, cropped RGB face crop as a numpy array."""
        raise NotImplementedError
