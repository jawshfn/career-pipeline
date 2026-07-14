# Career Pipeline

[![CI](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml)

Career Pipeline is a local-first full-stack job-search workspace for capturing opportunities, tracking applications, managing follow-ups, and reviewing progress.

It is built as a practical product prototype: fast capture when a job looks interesting, richer detail when context matters, and clear daily surfaces for follow-ups, status changes, resumes, red flags, and activity history.

## Static Demo

A GitHub Pages demo is available at [https://jawshfn.github.io/career-pipeline/](https://jawshfn.github.io/career-pipeline/).

The hosted demo uses fictional in-memory sample data. It is useful for reviewing the interface, but it does not connect to the FastAPI backend and changes reset when the page reloads.

## Product Highlights

- **Add Job:** choose Manual Entry, Paste Job Link, or deterministic Paste Job Text review.
- **Applications:** search, filter, sort, and open detailed records across Active, Closed, and All views.
- **Status Board:** scan opportunities by stage and update statuses quickly.
- **Reminders:** review overdue follow-ups, upcoming follow-ups, and Needs check-in items.
- **Dashboard:** see summary metrics, source results, resume results, and red-flag snapshots.
- **Resumes:** manage reusable resume variants and connect them to applications.
- **Application Detail:** edit follow-up, job details, resume/prep notes, red flags, and activity timeline entries.

## Smart Capture / Paste Job Text

Career Pipeline includes a review-first Smart Capture workflow for copied job postings. Paste the job text, review suggested fields, then save the opportunity. It works best when the copied text includes the posting header and the full job description. The Source and Job Link stay user-controlled.

Read the [Smart Capture Guide](docs/SMART_CAPTURE_GUIDE.md) for copy-and-review tips.

## Greenhouse Capture

Paste Job Link can import structured public job data from supported hosted Greenhouse links. Custom employer career links with one explicit `gh_jid` use best-effort server-side configuration discovery. When a site exposes its Greenhouse configuration only after page JavaScript runs, the optional local browser helper can hand a verified board token and job ID to the local app. Every path opens an editable review, and nothing is saved automatically.

## Optional Browser Helper

The Greenhouse helper is an experimental Chrome extension loaded unpacked for the local full-stack app at `http://localhost:5173/`. It requests only `activeTab` and `scripting`, sends and stores no employer-page data, and intentionally opens a new Career Pipeline tab so existing work is not replaced. It is not a Chrome Web Store feature, and the GitHub Pages demo does not support live browser-assisted imports.

See the [Browser Extension Guide](browser-extension/README.md) for local setup and privacy boundaries.

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS
- Backend: FastAPI, Python, SQLAlchemy
- Database: SQLite
- Testing: pytest, Vitest
- CI: GitHub Actions

## Run Locally

The full local app uses the React frontend, FastAPI backend, and SQLite database.

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

The frontend expects the backend at `http://127.0.0.1:8000`.

## Verification

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Frontend:

```powershell
cd frontend
npm test
npm run build
```

Browser extension:

```powershell
node --test browser-extension/*.test.mjs
```

## Optional Demo Data

For local screenshots or demos, seed fictional data from the backend directory:

```powershell
.\.venv\Scripts\python.exe -m app.seed_demo_data
```

The seed command refuses to run if local application data already exists. Use `--reset` only when you intentionally want to clear local demo tables before reseeding.

## Static Demo Build

To build the frontend in GitHub Pages demo mode:

```powershell
cd frontend
$env:VITE_APP_MODE="demo"
$env:VITE_BASE_PATH="/career-pipeline/"
npm run build
```

## Project Status

Career Pipeline is a working local-first prototype, not a production SaaS app. The GitHub Pages site is a static portfolio demo with reset-on-refresh sample data.

Implemented: official Greenhouse Job Board API import, best-effort custom Greenhouse discovery, and an experimental locally loaded Greenhouse browser helper with local browser-to-app transfer.

Not implemented: Chrome Web Store distribution, production backend/SaaS deployment, generic job-board scraping, authentication, multi-user synchronization, AI extraction, import/export, or email/calendar integrations.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Smart Capture Guide](docs/SMART_CAPTURE_GUIDE.md)
- [Capture Engine](docs/CAPTURE_ENGINE.md)
- [Browser Extension Guide](browser-extension/README.md)
- [Data Model](docs/DATA_MODEL.md)
- [API Plan](docs/API_PLAN.md)
- [Development Guide](docs/DEVELOPMENT.md)
