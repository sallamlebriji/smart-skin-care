# Smart Skin Care API

FastAPI with SQLite (local default) or PostgreSQL, private scan files, cookie-based accounts, stored routines and grounded chat.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Run from `backend/` so `.env` and relative data paths resolve correctly. Test with `.\.venv\Scripts\python.exe -m pytest tests -q`. SQLite data lives in `data/smartskin.db`; captures live in `data/scans`. Configure `DATABASE_URL` for PostgreSQL. New databases bootstrap automatically; migrations are provided for managed deployments.

## Endpoints

- `GET /api/health`, `GET /api/models`
- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`; `GET /api/auth/me`
- `GET`, `PUT /api/profile`
- `POST /api/scans`: multipart front/left/right photos, consent=true, optional quality JSON
- `GET /api/scans`: signed-in user's last 100 uploads
- `GET`, `DELETE /api/scans/{id}`; `GET /api/scans/{id}/image/{angle}`; `POST /api/scans/{id}/analyze`
- `GET /api/recommendations?scan_id=...`, `GET /api/routine?scan_id=...`
- `GET /api/routine/saved`, `PUT /api/routine`: authenticated custom routine
- `POST /api/chat`: message and allow_external_ai=false by default
- `GET`, `DELETE /api/chat/history`: authenticated conversation

See `/docs` for schemas. Account scans enforce ownership on metadata, photos, inference and recommendations. Other users see 404. Guest scans remain accessible by their secret ID; they are not automatically adopted by accounts. Uploading while signed in writes ownership to the private metadata and indexes the scan in the database. Analysis writes the result to both stores. Back up database and scan files together.

Passwords use salted scrypt. JWT access and opaque refresh tokens use HTTP-only cookies; refresh tokens are stored hashed and rotated. Logout revokes the session. Origin checks protect browser mutations; all personal API responses disable caching. Production requires `DEBUG=false`, a private JWT signing key, explicit CORS origins and HTTPS. Keep frontend and API on the same site for cookie authentication.

## Chat

Set `OPENAI_API_KEY` and `OPENAI_MODEL` to enable the optional provider. No external request is made without `allow_external_ai=true`. Context contains only non-mock scores, self-reported skin type, saved routine and recent conversation; no images, email or credentials. Responses requests set `store=false`. Without configuration or consent the assistant gives a local summary; timeouts/provider errors return a labeled local fallback. Conversation history is stored locally in the application database and can be deleted.

## Analysis limits

The acne classifier is a community checkpoint, not a validated diagnostic model. Seven other indicators are still mocked and named in `mock_metrics`; these do not generate routine steps or enter chat context. The overall score and skin-type estimate remain provisional. Model loading is lazy; `WARM_MODEL_ON_STARTUP=true` optionally warms the model. No test performs a model download or live provider call.


## Optional trained ONNX indicators

Install `requirements-models.txt` and place licensed trained classification checkpoints in `MODEL_REGISTRY_DIR` (default `data/models`, relative to the backend working directory). Use `model-manifest.example.json` as the format for `manifest.json`; replace every placeholder with the actual file, SHA-256, source, license, training-data provenance and training preprocessing. The example is not a trained model and cannot activate an indicator as supplied.

Each entry declares an indicator, `trained: true`, relative `.onnx` file, SHA-256, RGB NCHW float32 input size `[height, width]`, mean/std after scaling to 0–1, `stretch` or `center_crop`, logits or probabilities, and one 0–100 score per class (higher means clearer appearance). Classification confidence is the maximum class probability, not a clinically calibrated confidence. Provenance is an operator declaration; it does not establish training quality or clinical validity. Models must be trusted files. Restart after replacing checkpoints.

A configured model replaces only its indicator's placeholder (or the default acne checkpoint). Invalid configuration or failed inference returns 503 rather than fabricated results. Without a registry the default acne classifier and explicitly simulated indicators retain their existing behavior. No seven additional trained checkpoints or annotated datasets are bundled.

The registry tests include an actual ONNX Runtime execution of a small synthetic graph, which only checks integration. Install `onnx` alongside `requirements-models.txt` to run that optional graph test; it is skipped when either package is unavailable. Reference: [ONNX Runtime Python API](https://onnxruntime.ai/docs/api/python/api_summary.html).
