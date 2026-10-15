"""Opt-in trained classifiers. No checkpoint is invented or downloaded here."""
from functools import lru_cache
import hashlib
import importlib.util
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageOps

from app.ai.base import ModelOutput
from app.config import settings

METRICS = ("acne", "redness", "pigmentation", "pores", "texture", "wrinkles", "scars", "uniformity")


class ModelConfigurationError(RuntimeError):
    pass


@lru_cache(maxsize=4)
def _manifest(root: str, revision: int) -> dict:
    path = Path(root)
    try:
        registry = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
        if registry.get("version") != 1 or not isinstance(registry.get("models"), dict):
            raise ValueError("Expected a version 1 model manifest")
        for metric, spec in registry["models"].items():
            if metric not in METRICS or spec.get("trained") is not True:
                raise ValueError("Every configured entry must name a trained indicator model")
            checkpoint = (path / spec["file"]).resolve()
            if not checkpoint.is_relative_to(path) or checkpoint.suffix.lower() != ".onnx" or not checkpoint.is_file():
                raise ValueError("Checkpoint must be an existing ONNX file inside the registry")
            if not re.fullmatch(r"[a-f0-9]{64}", spec["sha256"]):
                raise ValueError("A SHA-256 checkpoint checksum is required")
            if hashlib.sha256(checkpoint.read_bytes()).hexdigest() != spec["sha256"]:
                raise ValueError("Checkpoint checksum mismatch")
            if not all(isinstance(spec.get(key), str) and spec[key].strip() for key in ("source", "license", "training_data")):
                raise ValueError("Checkpoint provenance is required")
            size = spec["input_size"]
            if len(size) != 2 or any(type(value) is not int or not 16 <= value <= 2048 for value in size):
                raise ValueError("Input size must be [height, width], each 16–2048")
            if spec.get("resize", "stretch") not in {"stretch", "center_crop"} or spec.get("output_kind") not in {"logits", "probabilities"}:
                raise ValueError("Unsupported model preprocessing/output contract")
            mean = np.asarray(spec["mean"], dtype=float)
            std = np.asarray(spec["std"], dtype=float)
            scores = np.asarray(spec["class_scores"], dtype=float)
            if mean.shape != (3,) or std.shape != (3,) or not np.isfinite(mean).all() or not np.isfinite(std).all() or (std <= 0).any():
                raise ValueError("Mean/std must contain three finite RGB values; std must be positive")
            if scores.ndim != 1 or len(scores) < 2 or not np.isfinite(scores).all() or (scores < 0).any() or (scores > 100).any():
                raise ValueError("Class scores must be on the appearance scale 0–100, higher means clearer")
            spec["absolute_file"] = str(checkpoint)
        return registry["models"]
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
        raise ModelConfigurationError(f"Invalid model registry: {error}") from error


def configured_models() -> dict:
    root = Path(settings.model_registry_dir).resolve()
    manifest = root / "manifest.json"
    if not manifest.exists():
        return {}
    return _manifest(str(root), manifest.stat().st_mtime_ns)


@lru_cache(maxsize=8)
def _session(filename: str, checksum: str):
    try:
        import onnxruntime as ort
        return ort.InferenceSession(filename, providers=["CPUExecutionProvider"])
    except Exception as error:
        raise ModelConfigurationError("Configured model could not load; install the ONNX runtime and verify its graph") from error


def preprocess(image: np.ndarray, spec: dict) -> np.ndarray:
    height, width = spec["input_size"]
    rgb = Image.fromarray(image).convert("RGB")
    rgb = ImageOps.fit(rgb, (width, height), method=Image.Resampling.BILINEAR) if spec.get("resize") == "center_crop" else rgb.resize((width, height), Image.Resampling.BILINEAR)
    tensor = np.asarray(rgb, dtype=np.float32) / 255.0
    tensor = (tensor - np.asarray(spec["mean"], dtype=np.float32)) / np.asarray(spec["std"], dtype=np.float32)
    return np.ascontiguousarray(tensor.transpose(2, 0, 1)[None], dtype=np.float32)


def interpret(metric: str, values: np.ndarray, spec: dict) -> ModelOutput:
    values = np.asarray(values, dtype=np.float64)
    if values.ndim == 2 and values.shape[0] == 1:
        values = values[0]
    if values.shape != (len(spec["class_scores"]),) or not np.isfinite(values).all():
        raise ModelConfigurationError("Model output does not match its classification contract")
    if spec["output_kind"] == "logits":
        probabilities = np.exp(values - values.max()); probabilities /= probabilities.sum()
    else:
        if (values < 0).any() or (values > 1).any() or not np.isclose(values.sum(), 1, atol=1e-3):
            raise ModelConfigurationError("Model probabilities are invalid")
        probabilities = values / values.sum()
    return ModelOutput(metric, round(float(probabilities @ np.asarray(spec["class_scores"])), 2), float(probabilities.max()), False)


def predict_configured(metric: str, image: np.ndarray) -> ModelOutput | None:
    spec = configured_models().get(metric)
    if spec is None:
        return None
    try:
        runtime = _session(spec["absolute_file"], spec["sha256"])
        inputs = runtime.get_inputs()
        if len(inputs) != 1 or inputs[0].type != "tensor(float)":
            raise ModelConfigurationError("Configured model must accept one float32 NCHW RGB input")
        output_name = spec.get("output_name") or runtime.get_outputs()[0].name
        values = runtime.run([output_name], {inputs[0].name: preprocess(image, spec)})[0]
        return interpret(metric, values, spec)
    except ModelConfigurationError:
        raise
    except Exception as error:
        raise ModelConfigurationError("Configured model inference failed; verify preprocessing and output contract") from error


def model_status() -> dict:
    models = configured_models()
    available = importlib.util.find_spec("onnxruntime") is not None
    from app.ai.wrinkle_model import MODEL_ID, MODEL_REVISION
    return {"onnx_runtime_available": available, "binary_assessments": [{
        "name": "wrinkle_presence", "source": MODEL_ID, "revision": MODEL_REVISION,
        "runtime_available": all(importlib.util.find_spec(package) is not None for package in ("torch", "transformers")),
        "experimental": True, "license": "MIT",
    }], "indicators": [{
        "metric": metric,
        "status": "configured" if metric in models else "community_checkpoint" if metric == "acne" else "not_configured",
        "runtime_available": available if metric in models else metric == "acne" and all(importlib.util.find_spec(package) is not None for package in ("torch", "transformers")),
        "source": models[metric]["source"] if metric in models else "imfarzanansari/skintelligent-acne" if metric == "acne" else None,
        "license": models[metric]["license"] if metric in models else "MIT" if metric == "acne" else None,
    } for metric in METRICS]}
