"""Configured trained ONNX models, with explicitly flagged placeholders otherwise."""
import hashlib
import numpy as np
from app.ai.acne_model import predict_acne_severity
from app.ai.base import BaseSkinModel, ModelOutput
from app.ai.onnx_models import predict_configured


def _stable_pseudo_score(seed: str, face_image: np.ndarray) -> float:
    digest = hashlib.sha256(seed.encode() + face_image.tobytes()[:256]).hexdigest()
    return int(digest[:4], 16) % 60 + 15


class ConfiguredOrMockModel(BaseSkinModel):
    def predict(self, face_image: np.ndarray) -> ModelOutput:
        configured = predict_configured(self.metric_name, face_image)
        return configured if configured is not None else ModelOutput(self.metric_name, _stable_pseudo_score(self.metric_name, face_image), 0.4, True)


class AcneModel(BaseSkinModel):
    metric_name = "acne"
    def predict(self, face_image: np.ndarray) -> ModelOutput:
        configured = predict_configured(self.metric_name, face_image)
        if configured is not None:
            return configured
        score, confidence, _label = predict_acne_severity(face_image)
        return ModelOutput(self.metric_name, score, confidence, False)


class RednessModel(ConfiguredOrMockModel):
    metric_name = "redness"

class PigmentationModel(ConfiguredOrMockModel):
    metric_name = "pigmentation"

class PoreModel(ConfiguredOrMockModel):
    metric_name = "pores"

class TextureModel(ConfiguredOrMockModel):
    metric_name = "texture"

class WrinkleModel(ConfiguredOrMockModel):
    metric_name = "wrinkles"

class ScarModel(ConfiguredOrMockModel):
    metric_name = "scars"

class UniformityModel(ConfiguredOrMockModel):
    metric_name = "uniformity"

ALL_MODELS: list[type[BaseSkinModel]] = [AcneModel, RednessModel, PigmentationModel, PoreModel, TextureModel, WrinkleModel, ScarModel, UniformityModel]
