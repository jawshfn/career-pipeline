# PursuitHQ · [Live Demo](https://jawshfn.github.io/career-pipeline/)

[![CI](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml)

**A local-first workspace for capturing job opportunities and following through on them.**

PursuitHQ helps job seekers capture opportunities, track application status and next actions, manage follow-ups, organize resume variants, preserve Job Posting Snapshots, review red flags, track activity, and export or restore their workspace. It can also generate and save the latest optional Job Intelligence Brief with an application.

## What it does

- Add jobs manually, from supported links, or with deterministic Paste Job Text review.
- Use the local Browser Capture companion for supported job pages.
- Manage applications in Application Detail, Status Board, Reminders, and Dashboard.
- Assign resume variants, record preparation notes, red flags, and activity.
- Back up a complete workspace as JSON; export applications as CSV or XLSX.
- Generate an explicit, review-only AI Brief without changing saved application fields; local mode stores the latest brief in SQLite.

## Runtime architecture

```text
Local workspace:
React/Vite <-> FastAPI <-> SQLite
     |
     +-> deployed Cloudflare Worker -> Google Gemini

Public demo:
Static React/Vite + fictional in-memory data
     |
     +-> deployed Cloudflare Worker -> Google Gemini
```

The local full-stack app stores workspace data in SQLite. The optional Chrome companion is locally loaded and opens an editable review; it never saves an application automatically.

The locally running PursuitHQ app includes AI access by default through the deployed PursuitHQ gateway. The Gemini API key remains server-side in that Worker: normal local use needs neither a Gemini key nor Cloudflare, Wrangler, or gateway setup. Job Intelligence Brief does not run Gemini or the Worker on the user's computer.

The public demo is a static GitHub Pages build. It uses fictional in-memory workspace data, so ordinary edits reset on reload and it does not connect to FastAPI. It also uses the deployed AI gateway, includes five AI-ready fictional applications (with Harborview Systems featured), and keeps generated briefs only for the browser session. Browser Capture and workspace restore are local-only.

The AI gateway is a Cloudflare Worker that validates a six-field request, calls Google Gemini with `gemini-3.5-flash-lite`, validates schema version 2 responses, and returns a result for the local app to save. The gateway does not persist workspace data. Generation is user initiated; two valid attempts per minute are allowed per bounded client key.

## Technology

React, Vite, FastAPI, SQLAlchemy, SQLite, Cloudflare Workers, Google Gemini, pytest, Vitest, Node tests, and GitHub Actions.

## Run locally

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

The backend and frontend above are all that ordinary local use requires. Browser Capture is optional; [AI gateway setup](ai-gateway/README.md) is only for contributors and operators developing, testing, deploying, or self-hosting that service.

## Verification

```powershell
cd backend; .\.venv\Scripts\python.exe -m pytest
cd frontend; npm test; npm run build
node --test browser-extension/*.test.mjs
cd ai-gateway; npm run check
```

## Current limitations

- No authentication, multi-user workspace, or multi-device synchronization.
- No hosted FastAPI backend or automatic application submission.
- No generic job-board scraping; the browser companion is experimental and locally loaded.
- AI output requires review, is never persisted, and is not AI extraction.
- The demo workspace resets after reload.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Development guide](docs/DEVELOPMENT.md)
- [API reference](docs/API_REFERENCE.md)
- [Data model](docs/DATA_MODEL.md)
- [Capture engine](docs/CAPTURE_ENGINE.md)
- [Paste Job Text guide](docs/SMART_CAPTURE_GUIDE.md)
- [Roadmap](docs/ROADMAP.md)
- [Backend](backend/README.md), [frontend](frontend/README.md), [Browser Capture](browser-extension/README.md), and [AI gateway](ai-gateway/README.md)
