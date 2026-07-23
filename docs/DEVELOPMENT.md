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

Start the backend and frontend using the commands in [the root README](../README.md). That is the complete setup for ordinary local PursuitHQ use: local mode calls FastAPI and uses SQLite, while Job Intelligence Brief uses the deployed PursuitHQ gateway by default. It does not run Gemini or a Worker process locally. Demo mode uses fictional in-memory data, does not call FastAPI, resets after reload, and uses that same deployed gateway for AI Briefs.

Running `ai-gateway/` locally is optional contributor/operator work for developing, testing, deploying, or self-hosting the gateway. It is not part of normal local app setup.

## Environment and secrets

| Area | Variable | Purpose |
| --- | --- | --- |
| Frontend | `VITE_APP_MODE` | `demo` selects demo mode; other values use local mode. |
| Frontend | `VITE_BASE_PATH` | Vite deployment base path. |
| Frontend | `VITE_AI_GATEWAY_URL` | Optional contributor/operator override; otherwise both runtime modes use the committed deployed gateway URL. |
| Backend | `CAREER_PIPELINE_DATABASE_URL` | Optional SQLite/SQLAlchemy database URL. |
| AI gateway | `GEMINI_API_KEY` | Worker secret; never commit it. |
| AI gateway | `AI_ENABLED` | Enables generation when `true`. |
| AI gateway | `GOOGLE_AI_TIMEOUT_MS` | Provider timeout. |
| AI gateway | `AI_MAX_COMPLETION_TOKENS` | Bounded completion token setting. |
| AI gateway | `ALLOWED_ORIGINS` | Comma-separated CORS allowlist. |
| AI gateway | `AI_RATE_LIMITER` | Required Worker rate-limit binding. |

The AI gateway rows apply only when working on `ai-gateway/`. Use ignored `ai-gateway/.dev.vars` for its local secrets; do not add it to source control. No Gemini or Cloudflare secret belongs in the frontend or FastAPI environment.

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
