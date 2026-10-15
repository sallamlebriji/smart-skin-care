"""Research-only transfer baseline for the explicitly AI-preannotated pilot.

Frozen public ViT features + trained severity head. No clinical truth is implied.
"""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from training.train_severity import read_annotations, LABELS
from app.ai.wrinkle_model import MODEL_ID, MODEL_REVISION


def main():
    import torch
    from torch import nn
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    from safetensors.torch import save_file
    torch.manual_seed(42); torch.set_num_threads(2)
    root = Path(__file__).resolve().parents[1] / "data" / "wrinkle_training"
    annotations = root / "annotations-ai-pilot.csv"
    rows, counts = read_annotations(annotations)
    print("Research-only AI-preannotated transfer pilot; not clinician-reviewed.", flush=True)
    processor = AutoImageProcessor.from_pretrained(MODEL_ID, revision=MODEL_REVISION, use_fast=False, trust_remote_code=False)
    classifier = AutoModelForImageClassification.from_pretrained(MODEL_ID, revision=MODEL_REVISION,
                                                                use_safetensors=True, trust_remote_code=False,
                                                                attn_implementation="eager")
    backbone = classifier.vit.eval()
    for parameter in backbone.parameters(): parameter.requires_grad_(False)
    features, targets = [], []
    with torch.inference_mode():
        for offset in range(0, len(rows), 4):
            batch = rows[offset:offset+4]
            images = []
            for row in batch:
                with Image.open(row["path"]) as original: images.append(original.convert("RGB"))
            inputs = processor(images=images, return_tensors="pt")["pixel_values"]
            features.append(backbone(pixel_values=inputs).last_hidden_state[:, 0].clone())
            targets.extend(LABELS.index(row["label"]) for row in batch)
            if offset % 40 == 0: print(f"Features: {min(offset+4,len(rows))}/{len(rows)}", flush=True)
    # Clone outside inference mode: the trainable head needs regular tensors.
    x = torch.cat(features).clone(); y = torch.tensor(targets)
    masks = {split: torch.tensor([row["split"] == split for row in rows]) for split in counts}
    head = nn.Linear(x.shape[1], 4)
    optimizer = torch.optim.AdamW(head.parameters(), lr=0.003, weight_decay=0.05)
    weights = torch.tensor([1/counts["train"][label] for label in LABELS]); weights /= weights.mean()
    loss_fn = nn.CrossEntropyLoss(weight=weights)

    def evaluate(split):
        with torch.inference_mode(): predictions = head(x[masks[split]]).argmax(1).tolist()
        confusion = np.zeros((4,4), dtype=int)
        for truth, predicted in zip(y[masks[split]].tolist(), predictions): confusion[truth,predicted] += 1
        f1 = [2*confusion[i,i]/max(1,confusion[i].sum()+confusion[:,i].sum()) for i in range(4)]
        return {"macro_f1": float(np.mean(f1)), "accuracy": float(confusion.trace()/confusion.sum()), "confusion_matrix": confusion.tolist()}

    best, history, state = -1, [], None
    for epoch in range(100):
        optimizer.zero_grad(); loss=loss_fn(head(x[masks["train"]]),y[masks["train"]]); loss.backward(); optimizer.step()
        validation=evaluate("val"); history.append(validation)
        if validation["macro_f1"] > best:
            best=validation["macro_f1"]; state={key:value.detach().clone() for key,value in head.state_dict().items()}
    head.load_state_dict(state); head.eval()
    print(json.dumps({"best_validation_macro_f1":best}),flush=True)
    test=evaluate("test")

    class Severity(nn.Module):
        def __init__(self): super().__init__(); self.backbone=backbone; self.head=head
        def forward(self, image): return self.head(self.backbone(pixel_values=image).last_hidden_state[:,0])
    model=Severity().eval()
    output=root/"pilot-severity-transfer";output.mkdir(exist_ok=True)
    save_file(head.state_dict(),str(output/"severity-head.safetensors"))
    torch.onnx.export(model,torch.zeros(1,3,224,224),str(output/"severity.onnx"),
                      input_names=["image"],output_names=["logits"],opset_version=17,dynamo=False)
    import onnxruntime as ort
    probe=np.random.default_rng(42).random((1,3,224,224),dtype=np.float32)*2-1
    with torch.inference_mode(): expected=model(torch.from_numpy(probe)).numpy()
    actual=ort.InferenceSession(str(output/"severity.onnx"),providers=["CPUExecutionProvider"]).run(None,{"image":probe})[0]
    np.testing.assert_allclose(actual,expected,rtol=1e-3,atol=1e-4)
    report={"labels":LABELS,"counts":counts,"seed":42,"architecture":"frozen ViT CLS features + trained linear severity head",
            "backbone":MODEL_ID,"backbone_revision":MODEL_REVISION,"validation_history":history,"best_validation_macro_f1":best,
            "held_out_test":test,"annotation_origin":"ai_visual_provisional","subject_grouping":"source_image_only",
            "dataset_source":"https://huggingface.co/datasets/AmirGenAI/my-wrinkle-seg-dataset",
            "dataset_sha256":hashlib.sha256(annotations.read_bytes()).hexdigest(),
            "input":{"shape":[1,3,224,224],"rgb":True,"scaling":"divide by 255","resize":"stretch","mean":processor.image_mean,"std":processor.image_std},
            "intended_use":"research_only","experimental":True,"clinical_validation":False,"automatically_activated":False}
    (output/"evaluation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"held_out_test":test,"output":str(output)}),flush=True)


if __name__ == "__main__": main()
