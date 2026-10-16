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

Acne classification and binary wrinkle presence use pinned community checkpoints, not validated diagnostic models. `model_assessments` reports the predicted labels, their probabilities and source revisions. Missing indicator models produce no score. `unavailable_metrics` lists unavailable specialist outputs; `mock_metrics` remains a legacy exclusion list for old clients and also excludes binary wrinkle presence from severity-index calculations. `metrics` is sparse and contains only actual legacy model indices. The compatibility-only overall index excludes unavailable indicators; it and the fixed skin-type estimate are not physical measurements. Missing indicators cannot drive routines or chat context. Model loading is lazy; `WARM_MODEL_ON_STARTUP=true` optionally warms acne. Unit tests do not download models or call a live provider.


## Optional trained ONNX indicators

Install `requirements-models.txt` and place licensed trained classification checkpoints in `MODEL_REGISTRY_DIR` (default `data/models`, relative to the backend working directory). Use `model-manifest.example.json` as the format for `manifest.json`; replace every placeholder with the actual file, SHA-256, source, license, training-data provenance and training preprocessing. The example is not a trained model and cannot activate an indicator as supplied.

Each entry declares an indicator, `trained: true`, relative `.onnx` file, SHA-256, RGB NCHW float32 input size `[height, width]`, mean/std after scaling to 0–1, `stretch` or `center_crop`, logits or probabilities, and one 0–100 score per class (higher means clearer appearance). Classification confidence is the maximum class probability, not a clinically calibrated confidence. Provenance is an operator declaration; it does not establish training quality or clinical validity. Models must be trusted files. Restart after replacing checkpoints.

A configured model replaces only its indicator's unavailable status (or its default community model). Invalid configuration or configured inference failure returns 503 rather than fabricated results. The optional default wrinkle detector may be marked unavailable if it fails while acne analysis succeeds. No seven additional trained checkpoints or validated annotated datasets are bundled. The browser's separate pixel-statistics panel is documented in `../docs/IMAGE_MEASUREMENTS.md`.

The registry tests include an actual ONNX Runtime execution of a small synthetic graph, which only checks integration. Install `onnx` alongside `requirements-models.txt` to run that optional graph test; it is skipped when either package is unavailable. Reference: [ONNX Runtime Python API](https://onnxruntime.ai/docs/api/python/api_summary.html).


## Verify the real acne model locally

After installing `requirements-dev.txt`, run from `backend/`:

```powershell
.\.venv\Scripts\python.exe scripts/check_model.py
```

The first run downloads the pinned community checkpoint, then performs CPU inference on a synthetic RGB image. A successful result checks loading and execution only, not accuracy. Supply a local photo path as an optional argument; the script processes it locally and does not store or upload it. Checkpoint weights remain in the local Hugging Face cache and are not committed. The model revision is fixed in `app/ai/acne_model.py`, and only safetensors weights with remote code disabled are loaded. The application still requires separately trained, validated checkpoints for its other seven indicators.


## Experimental wrinkle presence detection

`POST /api/scans/{id}/analyze-wrinkles` runs independently from acne analysis on the stored front photograph. The existing owner/guest access rules apply. Results are saved as `wrinkle_assessment` in scan metadata and appear in account scan listings. The original scan status, appearance scores and routines remain unchanged.

The pinned community checkpoint is `imfarzanansari/skintelligent-wrinkles` at revision `32ddddd41a7e035bbe3abbe4510e0a0ca4b6fb12`, with MIT declared by its publisher. Only safetensors weights are loaded and remote code is disabled. Dependencies are in `requirements.txt`; the first run downloads the weights. Run `python scripts/check_wrinkles.py` for a synthetic execution check. Model source: [publisher's model card](https://huggingface.co/imfarzanansari/skintelligent-wrinkles).

The result contains `label`, `wrinkle_probability`, `model`, `revision` and `experimental`. The probability is for the wrinkle class, not the selected class, and is not a severity/quality score or calibrated clinical confidence. There is no independent accuracy validation bundled. Failures return 503 and retain any earlier saved assessment. Web users can open a scan analysis page and choose **Detect wrinkles only**; iOS users use the same action in History. Older scans without an assessment remain readable. No photos are sent to Hugging Face; weights are downloaded and inference runs on the configured backend.
