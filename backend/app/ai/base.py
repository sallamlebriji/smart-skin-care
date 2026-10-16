"""
Adapter interface for trained model predictions and explicit unavailable results.
Class probabilities and compatibility appearance indices are distinct outputs.
An absent checkpoint never returns a fabricated numeric score.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class ModelOutput:
    metric_name: str
    score: float | None  # Legacy appearance index, never supplied for unavailable indicators.
    confidence: float  # 0-1
    is_mock: bool  # Legacy adapter flag: True means unavailable, with score=None.
    label: str | None = None
    source: str | None = None
    revision: str | None = None


class BaseSkinModel(ABC):
    metric_name: str

    @abstractmethod
    def predict(self, face_image: np.ndarray) -> ModelOutput:
        """face_image: aligned, cropped RGB face crop as a numpy array."""
        raise NotImplementedError
