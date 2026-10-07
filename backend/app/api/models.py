from fastapi import APIRouter, HTTPException
from app.ai.onnx_models import model_status, ModelConfigurationError

router = APIRouter(tags=["models"])


@router.get("/api/models")
def get_models():
    try:
        return model_status()
    except ModelConfigurationError:
        raise HTTPException(503, "Model configuration is invalid. The server operator must verify its registry.")
