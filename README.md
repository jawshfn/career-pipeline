# Career Pipeline

[![CI](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml)

Career Pipeline is a full-stack job-search command center for capturing opportunities, tracking applications, managing follow-ups, and reviewing job-search progress from one place.

## Why I Built It

Job searches spread across LinkedIn, Indeed, ZipRecruiter, company career pages, recruiters, referrals, and notes. A spreadsheet can track rows, but it often loses the context that matters later: follow-up timing, resume versions, next actions, pasted job details, and warning signs.

Career Pipeline is built as a practical local-first workflow tool, not just a CRUD demo. Quick capture stays lightweight, while richer application management, follow-ups, activity history, and metrics live in focused views.

## Highlights

- Quick Add with Manual Entry and deterministic Smart Capture / Paste Job Text.
- Smart Capture is review-first: Source remains user-selected and Job Link is saved only from the explicit input.
- Application management with Active, Closed, and All views, search, filters, sorting, and detail editing.
- Command Center for overdue follow-ups, upcoming follow-ups, and stale applications.
- Application Detail with status/follow-up, job details, contact/prep notes, red flags, and activity timeline.
- Dashboard metrics for application status, sources, resume versions, red flags, and effectiveness snapshots.
- Tested full-stack foundation with FastAPI, SQLite, React/Vite, pytest, Vitest, and GitHub Actions.

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS
- Backend: FastAPI, Python, SQLAlchemy
- Database: SQLite
- Testing: pytest, Vitest
- CI: GitHub Actions

## Run Locally

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

Docs-only changes do not require tests. Cross-stack product changes should run backend pytest, frontend tests, frontend build, and manual QA for the affected workflows.

## Project Status

Career Pipeline is a working local-first prototype. It supports quick capture, application management, follow-up workflows, activity logging, dashboard metrics, resume-version management, and red-flag tracking.

Not implemented: authentication, deployment, scraping, browser extension workflows, AI extraction, import/export, or external integrations. Smart Capture is deterministic and review-first.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Data Model](docs/DATA_MODEL.md)
- [API Plan](docs/API_PLAN.md)
- [Development Guide](docs/DEVELOPMENT.md)
