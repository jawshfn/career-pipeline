# Development Guide

## Principles

Keep PursuitHQ local-first, review-first, and clear about privacy boundaries. Changes should preserve a small, dependable workflow, use fictional public examples, and update documentation when behavior or setup changes.

## Repository architecture

- `frontend/`: React/Vite application; local and static demo modes.
- `backend/`: FastAPI/SQLAlchemy API and SQLite persistence.
- `browser-extension/`: experimental locally loaded Chrome companion.
- `ai-gateway/`: Cloudflare Worker for Job Intelligence Briefs.
- `.github/workflows/`: CI, Pages deployment, and manually dispatched gateway deployment.

## Runtime modes and setup

Start the backend and frontend using the commands in [the root README](../README.md). Local mode calls FastAPI and uses SQLite. Demo mode uses fictional in-memory data, does not call FastAPI, and resets after reload.

## Environment and secrets

| Area | Variable | Purpose |
| --- | --- | --- |
| Frontend | `VITE_APP_MODE` | `demo` selects demo mode; other values use local mode. |
| Frontend | `VITE_BASE_PATH` | Vite deployment base path. |
| Frontend | `VITE_AI_GATEWAY_URL` | Optional gateway override; otherwise the committed deployed gateway URL is used. |
| Backend | `CAREER_PIPELINE_DATABASE_URL` | Optional SQLite/SQLAlchemy database URL. |
| AI gateway | `GEMINI_API_KEY` | Worker secret; never commit it. |
| AI gateway | `AI_ENABLED` | Enables generation when `true`. |
| AI gateway | `GOOGLE_AI_TIMEOUT_MS` | Provider timeout. |
| AI gateway | `AI_MAX_COMPLETION_TOKENS` | Bounded completion token setting. |
| AI gateway | `ALLOWED_ORIGINS` | Comma-separated CORS allowlist. |
| AI gateway | `AI_RATE_LIMITER` | Required Worker rate-limit binding. |

Use ignored `ai-gateway/.dev.vars` for local gateway secrets; do not add it to source control.

## Verification matrix

| Change | Required checks |
| --- | --- |
| Documentation only | Diff and link checks; product suites are not required. |
| Frontend | `cd frontend; npm test; npm run build` |
| Backend | `cd backend; .\.venv\Scripts\python.exe -m pytest` |
| Browser companion | `node --test browser-extension/*.test.mjs` |
| AI gateway | `cd ai-gateway; npm run check` |
| Cross-stack | Relevant checks for every changed subsystem. |

## CI and deployment

`ci.yml` runs backend pytest, browser-extension Node tests, frontend Vitest, and a frontend build on pushes and pull requests. `pages.yml` runs frontend tests, builds demo mode from `frontend/dist`, and deploys GitHub Pages on `main` or manual dispatch. `deploy-ai-gateway.yml` is manually dispatched; it installs gateway dependencies, tests, validates a Wrangler deployment, and deploys the Worker with repository secrets.

## Documentation and definition of done

Keep each document focused on one responsibility, avoid private data and speculative commitments, and verify claims against source. A feature is done when its workflow, error states, focused tests, documentation, and relevant demo behavior are complete.
