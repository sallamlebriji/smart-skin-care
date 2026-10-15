# Smart Skin Care

A browser application for camera capture, visual skin analysis, account-based history, recommendations, saved routines and a scan-grounded assistant.

## Implemented

- Landing page, responsive navigation and WebGL/reduced-motion fallbacks.
- Three-angle camera capture with MediaPipe face guidance and quality checks.
- Consent-based private photo uploads, analysis, interactive face regions and deletion.
- Registration/login, hashed passwords, JWT access cookies, rotating refresh sessions, logout and editable profiles.
- Account-scoped scans and photos, dashboard, server-backed history and two-scan comparisons. Uploaded scans can be analyzed later.
- Guest mode with browser-local history. Signing in before a scan associates it with your account; guest scans are not automatically imported. Account results are not persisted to browser local storage. Signing out clears the client cache.
- Recommendations with explicit simulated-indicator labels. Simulated indicators do not generate routine steps.
- Editable AM/PM routines saved to the account.
- Persisted chat with an optional OpenAI Responses API provider. The user must opt in before external AI requests. Only available scan estimates, conversation, self-reported skin type and saved routine are sent; photos, email and credentials are excluded. Without a key or consent, replies are explicitly local summaries. Provider failures use a labeled local fallback.

## Run locally

Frontend (first terminal, repository root):

```powershell
npm install
npm run dev
```

Backend (second terminal):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open http://localhost:5173/account. Use the same hostname for frontend and API (localhost on both), because authentication uses HTTP-only cookies. `VITE_API_URL` defaults to `http://localhost:8000`.

SQLite is the local default (`backend/data/smartskin.db`). PostgreSQL is supported via `DATABASE_URL`. New databases can also bootstrap automatically on their first account request; apply Alembic migrations before using an existing database. Back up the database and `SCAN_STORAGE_DIR` together.

Optional generative chat: configure `OPENAI_API_KEY` and `OPENAI_MODEL` in `backend/.env` and restart the backend. The provider adapter uses `store=false`; this is not a promise of zero provider retention. Reference: [official Responses API documentation](https://developers.openai.com/api/reference/python/resources/responses/methods/create).

## Validation

```powershell
npm run typecheck
npm run build
cd backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

Tests cover capture, consent, recommendation provenance, authenticated routines, account isolation (including photos), password hashing, token rotation/revocation, profiles, chat history, provider consent and provider failure. Tests do not download models or call a live AI service.

## Docker development

Copy `backend/.env.example` to `backend/.env`, then run `docker compose up --build`. Compose uses PostgreSQL, waits for its health check, and persists database and scan files in separate volumes. These Dockerfiles run development servers; use HTTPS and production hosting before public deployment. Configure a private `JWT_SECRET_KEY`, set `DEBUG=false`, and restrict `CORS_ORIGINS` for deployment.

## Model and platform limits

Only the acne indicator currently uses a trained model, a community checkpoint with no clinical validation established here. The seven other indicators remain explicitly simulated until trained ONNX checkpoints are configured. The registry validates checksums, preprocessing and output contracts, and `/api/models` reports availability. See backend/README.md. Overall score and skin-type estimate are not validated measurements. Comparisons and chat context exclude simulated indicators. Model loading happens on first analysis and may require network access; optional `WARM_MODEL_ON_STARTUP=true` preloads it.

The native iOS/TrueDepth app now includes an Xcode project, camera capture, account history, routines and chat under `ios/`. Source syntax and project structure were checked on Windows; the iOS simulator app also compiled successfully with Xcode in GitHub Actions. Signing and camera/TrueDepth device validation still require a Mac and iPhone. See ios/README.md. Additional real indicators require suitable datasets, trained checkpoints and validation, not invented scores. The application offers visual assessments, not diagnoses.

Design tokens: `src/index.css`. Shared result contract: `src/types/skin.ts` and `backend/app/schemas/scan.py`.


## Automated verification

Local wrinkle severity training: [dataset preparation, annotation tool and CPU training guide](backend/training/README.md). The downloaded image pool has no severity labels; human annotation is required before a severity model can be trained. The existing binary detector remains available.

[GitHub Actions](https://github.com/sallamlebriji/smart-skin-care/actions) builds the web app, runs backend tests (including the synthetic ONNX graph integration) and compiles the iOS simulator app on macOS. All three jobs passed for commit `dff2f65`: [verified run](https://github.com/sallamlebriji/smart-skin-care/actions/runs/38726050716). CI does not establish model accuracy or replace real camera/TrueDepth device testing. The real acne checkpoint was also executed locally through upload, analysis and deletion using a synthetic image.
