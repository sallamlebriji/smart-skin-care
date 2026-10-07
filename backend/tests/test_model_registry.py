import hashlib
import json
from types import SimpleNamespace

import numpy as np
import pytest

from app.config import settings
from app.ai import onnx_models, models, acne_model


@pytest.fixture()
def registry(tmp_path, monkeypatch):
    session_cache = onnx_models._session
    monkeypatch.setattr(settings, "model_registry_dir", str(tmp_path))
    onnx_models._manifest.cache_clear()
    session_cache.cache_clear()
    yield tmp_path
    onnx_models._manifest.cache_clear()
    session_cache.cache_clear()


def write_manifest(root, **overrides):
    # This is a unit-test fixture, not a trained skin checkpoint.
    checkpoint = root / "test-only.onnx"
    checkpoint.write_bytes(b"test-only-graph")
    spec = {"file": checkpoint.name, "sha256": hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
            "trained": True, "source": "unit-test fixture", "license": "test only", "training_data": "synthetic adapter test, not clinical data",
            "input_size": [32, 48], "mean": [0, 0, 0], "std": [1, 1, 1], "resize": "stretch",
            "output_kind": "probabilities", "class_scores": [0, 100]}
    spec.update(overrides)
    (root / "manifest.json").write_text(json.dumps({"version": 1, "models": {"redness": spec}}))
    return spec


def test_missing_checkpoints_remain_explicitly_mocked(registry):
    result = models.RednessModel().predict(np.zeros((32, 32, 3), dtype=np.uint8))
    assert result.is_mock is True
    assert onnx_models.predict_configured("redness", np.zeros((32, 32, 3), dtype=np.uint8)) is None
    assert onnx_models.model_status()["indicators"][1]["status"] == "not_configured"


@pytest.mark.parametrize("overrides", [
    {"sha256": "0" * 64}, {"trained": False}, {"file": "../outside.onnx"},
    {"std": [0, 1, 1]}, {"class_scores": [-1, 100]}, {"source": ""}, {"input_size": [0, 224]},
])
def test_registry_refuses_invalid_or_untraceable_checkpoints(registry, overrides):
    write_manifest(registry, **overrides)
    with pytest.raises(onnx_models.ModelConfigurationError):
        onnx_models.configured_models()


def test_preprocessing_matches_float_rgb_nchw_contract(registry):
    spec = write_manifest(registry)
    image = np.full((100, 80, 3), 255, dtype=np.uint8)
    tensor = onnx_models.preprocess(image, spec)
    assert tensor.shape == (1, 3, 32, 48) and tensor.dtype == np.float32
    assert tensor.flags.c_contiguous and np.allclose(tensor, 1)


def test_logits_and_probabilities_have_the_same_score_direction():
    logits = onnx_models.interpret("redness", np.array([[0, 1000]]), {"output_kind": "logits", "class_scores": [0, 100]})
    probabilities = onnx_models.interpret("redness", np.array([[0.25, 0.75]]), {"output_kind": "probabilities", "class_scores": [0, 100]})
    assert logits.score == 100 and logits.is_mock is False
    assert probabilities.score == 75 and probabilities.confidence == 0.75


@pytest.mark.parametrize("output", [np.array([1, 1]), np.array([np.nan, 0]), np.array([0.5]), np.array([-0.1, 1.1])])
def test_invalid_outputs_do_not_become_real_scores(output):
    with pytest.raises(onnx_models.ModelConfigurationError):
        onnx_models.interpret("redness", output, {"output_kind": "probabilities", "class_scores": [0, 100]})


def test_configured_predictor_replaces_only_its_own_placeholder(registry, monkeypatch):
    write_manifest(registry)
    class Runtime:
        def get_inputs(self): return [SimpleNamespace(name="image", type="tensor(float)")]
        def get_outputs(self): return [SimpleNamespace(name="probability")]
        def run(self, names, inputs):
            assert inputs["image"].shape == (1, 3, 32, 48)
            return [np.array([[0.25, 0.75]])]
    monkeypatch.setattr(onnx_models, "_session", lambda *args: Runtime())
    image = np.zeros((32, 32, 3), dtype=np.uint8)
    assert models.RednessModel().predict(image).is_mock is False
    assert models.RednessModel().predict(image).score == 75
    assert models.TextureModel().predict(image).is_mock is True


def test_configured_inference_failure_never_silently_falls_back(registry, monkeypatch):
    write_manifest(registry)
    def fail(*args): raise onnx_models.ModelConfigurationError("bad graph")
    monkeypatch.setattr(onnx_models, "_session", fail)
    with pytest.raises(onnx_models.ModelConfigurationError):
        models.RednessModel().predict(np.zeros((32, 32, 3), dtype=np.uint8))


def test_acne_refuses_unknown_model_labels(monkeypatch):
    monkeypatch.setattr(acne_model, "_get_pipeline", lambda: lambda image: [{"label": "unknown", "score": 1}])
    with pytest.raises(ValueError, match="documented contract"):
        acne_model.predict_acne_severity(np.zeros((32, 32, 3), dtype=np.uint8))


def test_actual_onnx_graph_contract(registry):
    onnx = pytest.importorskip("onnx")
    pytest.importorskip("onnxruntime")
    from onnx import helper, TensorProto
    write_manifest(registry, output_kind="logits", class_scores=[0, 100])
    graph = helper.make_graph([
        helper.make_node("GlobalAveragePool", ["image"], ["pooled"]),
        helper.make_node("Flatten", ["pooled"], ["flat"]),
        helper.make_node("Gemm", ["flat", "weights", "bias"], ["logits"]),
    ], "synthetic-contract-test-only", [helper.make_tensor_value_info("image", TensorProto.FLOAT, [1, 3, 32, 48])],
       [helper.make_tensor_value_info("logits", TensorProto.FLOAT, [1, 2])],
       [helper.make_tensor("weights", TensorProto.FLOAT, [3, 2], [0, 1, 0, 1, 0, 1]), helper.make_tensor("bias", TensorProto.FLOAT, [2], [0, 0])])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], ir_version=9)
    checkpoint = registry / "test-only.onnx"
    onnx.save(model, str(checkpoint))
    manifest_path = registry / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["models"]["redness"]["sha256"] = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    manifest_path.write_text(json.dumps(manifest))
    output = models.RednessModel().predict(np.full((32, 32, 3), 255, dtype=np.uint8))
    assert output.is_mock is False and 95 < output.score < 96
