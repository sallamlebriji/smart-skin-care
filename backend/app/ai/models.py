"""Trained inference only. Missing checkpoints never produce numeric values."""
import numpy as np
from app.ai.acne_model import predict_acne_severity
from app.ai.base import BaseSkinModel, ModelOutput
from app.ai.onnx_models import predict_configured
from app.ai.wrinkle_model import predict_wrinkles


class ConfiguredOrMockModel(BaseSkinModel):
    def predict(self, face_image: np.ndarray) -> ModelOutput:
        configured = predict_configured(self.metric_name, face_image)
        return configured if configured is not None else ModelOutput(self.metric_name, None, 0, True)


class AcneModel(BaseSkinModel):
    metric_name = "acne"
    def predict(self, face_image: np.ndarray) -> ModelOutput:
        configured = predict_configured(self.metric_name, face_image)
        if configured is not None:
            return configured
        from app.ai.acne_model import MODEL_ID, MODEL_REVISION
        score, confidence, label = predict_acne_severity(face_image)
        return ModelOutput(self.metric_name, score, confidence, False, label, MODEL_ID, MODEL_REVISION)


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
    def predict(self, face_image: np.ndarray) -> ModelOutput:
        configured = predict_configured(self.metric_name, face_image)
        if configured is not None:
            return configured
        try:
            result = predict_wrinkles(face_image)
        except Exception:
            # A failed optional detector cannot manufacture a score or discard a successful acne result.
            return ModelOutput(self.metric_name, None, 0, True)
        probability = result["wrinkle_probability"]
        confidence = probability if result["label"] == "wrinkle" else 1 - probability
        return ModelOutput(self.metric_name, None, confidence, False, result["label"], result["model"], result["revision"])

class ScarModel(ConfiguredOrMockModel):
    metric_name = "scars"

class UniformityModel(ConfiguredOrMockModel):
    metric_name = "uniformity"

ALL_MODELS: list[type[BaseSkinModel]] = [AcneModel, RednessModel, PigmentationModel, PoreModel, TextureModel, WrinkleModel, ScarModel, UniformityModel]
