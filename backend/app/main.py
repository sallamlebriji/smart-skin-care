import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, chat, health, models, recommendations, scans
from app.config import settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Loading the acne model (Phase 5) takes ~60s on first use (HF Hub
    # metadata check + CPU weight load) — warm it in the background so the
    # first real /analyze call doesn't pay that cost. Best-effort: analyze()
    # loads it lazily anyway if this hasn't finished yet.
    def warm():
        from app.ai.acne_model import _get_pipeline

        try:
            _get_pipeline()
        except Exception:
            pass  # analyze() will surface the real error on first use instead

    if settings.warm_model_on_startup:
        threading.Thread(target=warm, daemon=True).start()
    yield


app = FastAPI(
    title="Smart Skin Care API",
    version="0.1.0",
    description="Skin scan capture, analysis, private accounts, saved routines and grounded chat.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+" if settings.debug else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)


@app.middleware("http")
async def private_api_responses(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/") and request.url.path != "/api/health":
        response.headers["Cache-Control"] = "private, no-store"
    return response


app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(scans.router)
app.include_router(recommendations.router)
app.include_router(models.router)
