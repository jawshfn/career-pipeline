# Career Pipeline

[![CI](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml)

Career Pipeline is a local-first full-stack job-search workspace for capturing opportunities, tracking applications, managing follow-ups, and reviewing progress.

It is built as a practical product prototype: fast capture when a job looks interesting, richer detail when context matters, and clear daily surfaces for follow-ups, status changes, resumes, red flags, and activity history.

## Static Demo

A GitHub Pages demo is available at [https://jawshfn.github.io/career-pipeline/](https://jawshfn.github.io/career-pipeline/).

The hosted demo uses fictional in-memory sample data. It is useful for reviewing the interface, but it does not connect to the FastAPI backend and changes reset when the page reloads.

## Product Highlights

- **Browser Capture:** recommended local workflow for supported Greenhouse, Indeed, and LinkedIn pages; opens an editable review without manually copying the posting.
- **Add Job:** choose Manual Entry, Paste Job Link, or deterministic Paste Job Text review.
- **Applications:** search, filter, sort, and open detailed records across Active, Closed, and All views.
- **Status Board:** scan opportunities by stage and update statuses quickly.
- **Reminders:** review overdue follow-ups, upcoming follow-ups, and Needs check-in items.
- **Dashboard:** see summary metrics, source results, resume results, and red-flag snapshots.
- **Resumes:** manage reusable resume variants and connect them to applications.
- **Application Detail:** edit follow-up, job details, a dedicated Job Posting Snapshot, resume/prep notes, red flags, and activity timeline entries.

## Browser Capture - Recommended Local Workflow

The experimental, locally loaded Career Pipeline Capture Helper is the fastest local workflow when you are already viewing a supported job. It supports verified Greenhouse identifiers, bounded Indeed text capture, LinkedIn search-results current-job panels, and LinkedIn standalone job pages. After you confirm a detection, it opens an editable review; nothing is saved automatically.

Browser Capture requires the local frontend and FastAPI backend. It is not Chrome Web Store distributed, and the GitHub Pages demo does not support the helper. The helper reads only the active page after you click it, then transfers only the approved bounded job data to the local app.

See the [Browser Extension Guide](browser-extension/README.md) for local setup and privacy boundaries.

## Structured Job Link Import

Paste Job Link automatically recognizes supported hosted Greenhouse and Lever postings, then opens structured details in an editable review. Lever supports canonical global and EU hosted links through its public Postings API; company remains a review field because Lever does not provide a dependable display name. Custom employer career links with one explicit `gh_jid` use best-effort Greenhouse configuration discovery. Unknown links retain link-only and Paste Job Text fallbacks. Nothing is saved automatically.

## Paste Job Text Fallback

Paste Job Text remains the broad deterministic fallback for unsupported sites or layouts, recruiter messages, copied postings, and recovery when Browser Capture cannot confidently identify a job. Paste text, review suggested fields, correct anything that looks wrong, then explicitly save. Source and Job Link remain user-controlled.

Read the [Paste Job Text Guide](docs/SMART_CAPTURE_GUIDE.md) for copy-and-review tips.

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

Implemented: Greenhouse and Lever structured link imports, best-effort custom Greenhouse discovery, experimental locally loaded Greenhouse browser identifier capture, Indeed and LinkedIn browser text capture, one-time local transfer, and editable review with no autosave.

Not implemented: Chrome Web Store distribution, production backend/SaaS deployment, generic job-board scraping, authentication, multi-user synchronization, AI extraction, import/export, or email/calendar integrations.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Paste Job Text Guide](docs/SMART_CAPTURE_GUIDE.md)
- [Capture Engine](docs/CAPTURE_ENGINE.md)
- [Browser Extension Guide](browser-extension/README.md)
- [Data Model](docs/DATA_MODEL.md)
- [API Plan](docs/API_PLAN.md)
- [Development Guide](docs/DEVELOPMENT.md)
