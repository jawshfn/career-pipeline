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

Startup applies additive local schema work when needed. Historical outcome reconciliation is one-time and marker protected; local and demo behavior should remain aligned. Relevant focused tests cover transitions, Insights, contributors, cache behavior, and backup persistence.

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

## Spreadsheet import verification

Run the complete release checks from the repository roots:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
cd ../frontend
npm.cmd test -- --run
npm.cmd run build
```

Focused import coverage includes `backend/app/tests/test_application_imports.py`, `frontend/src/components/import/SpreadsheetImportWorkflow.test.jsx`, `frontend/src/components/import/spreadsheetImportReviewState.test.js`, `frontend/src/import/importFieldDefinitions.test.js`, `frontend/src/import/spreadsheetIntake.test.js`, `frontend/src/import/spreadsheetIntake.xlsx.test.js`, `frontend/src/import/spreadsheetNormalization.test.js`, `frontend/src/pages/DataPage.test.jsx`, and `frontend/src/demo/demoImport.test.js`.

For manual testing, run FastAPI with `python -m uvicorn app.main:app --reload` from `backend`, and Vite with `npm run dev` from `frontend`. Normal local mode uses FastAPI and SQLite. Set `VITE_APP_MODE=demo` to exercise the fictional, in-memory demo; it resets after reload. The browser parses the spreadsheet and submits normalized JSON only. The established ExcelJS bundle-size warning is nonblocking when it remains the only build warning.

## First-run and demo guidance

`frontend/src/components/command-center/onboardingState.js` keeps local workspace selection pure: empty and one-application states are distinguished from an established workspace. Demo guidance is mode-driven and remains independent of application count. `StartingSurface.jsx` owns versioned dismissal using `pursuithq:onboarding:local:v1` and `pursuithq:onboarding:demo:v1`; storage failures leave the guide usable. Increment `ONBOARDING_VERSION` deliberately when a material guide change should re-present it.

`CommandCenterPage.jsx` wires the guide and its focus restoration, while `SupportPage.jsx` renders the local starting choices or the demo walkthrough using the existing featured-application callback from `App.jsx`. Focused coverage lives in `onboardingState.test.js`, `CommandCenterPage.test.jsx`, `SupportPage.test.jsx`, and `demoData.test.js`.

## Application shell and navigation

`frontend/src/components/layout/AppLayout.jsx` owns grouped shell presentation. Its `navigationGroups` configuration is the source for destination grouping and labels; add future destinations there instead of duplicating desktop and mobile arrays. Desktop expanded/compact presentation and the transient mobile Menu have separate state responsibilities. `frontend/src/components/layout/sidebarPreference.js` owns the browser-local compact preference under `SIDEBAR_COLLAPSED_STORAGE_KEY` (`pursuithq:sidebar:collapsed`): missing, malformed, or inaccessible storage safely falls back to expanded.

`MOBILE_NAVIGATION_QUERY` is `(max-width: 780px)`. The mobile Menu is never stored, closes across responsive transitions, and does not change the desktop preference. The existing `onNavigate` return value tells `AppLayout` whether immediate mobile navigation succeeded. `App.jsx` remains the owner of top-level page state and guarded navigation; `resetViewportForPageTransition` resets only successful changes to a different top-level page. Focused coverage lives in `frontend/src/components/layout/AppLayout.test.jsx`, `frontend/src/components/layout/sidebarPreference.test.js`, `frontend/src/App.test.jsx`, and `frontend/src/App.browserTextCapture.test.jsx`.

## CI and deployment

`ci.yml` runs backend pytest, browser-extension Node tests, frontend Vitest, and a frontend build on pushes and pull requests. `pages.yml` runs frontend tests, builds demo mode from `frontend/dist`, and deploys GitHub Pages on `main` or manual dispatch. `deploy-ai-gateway.yml` is manually dispatched; it installs gateway dependencies, tests, validates a Wrangler deployment, and deploys the Worker with repository secrets.

## Documentation and definition of done

Keep each document focused on one responsibility, avoid private data and speculative commitments, and verify claims against source. A feature is done when its workflow, error states, focused tests, documentation, and relevant demo behavior are complete.
