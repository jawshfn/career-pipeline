# Career Pipeline

[![CI](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml)

Career Pipeline is a full-stack job-search workspace for capturing opportunities, tracking application status, managing follow-ups, and reviewing job-search progress from one place.

The product is built around a common job-search problem: opportunities arrive from many sources, each application has different dates and context, and follow-up work is easy to lose in a spreadsheet. Career Pipeline keeps the fast capture workflow separate from richer application management so users can move quickly without losing detail.

## Current Features

### Quick Capture

- Dedicated Quick Add page for quickly saving a job opportunity
- Optional status, resume version, applied date, follow-up date, source, job link, and notes
- Follow-up presets for common next-step dates
- Applied-date defaulting when a user selects Applied or a later status and no applied date is set

### Application Management

- Applications page focused on searching, filtering, sorting, and managing existing applications
- Active, Closed, and All views for separating open opportunities from Rejected and Withdrawn outcomes
- Search across company, role, source, location, and notes
- Filters for status, source, resume version, and red-flag state
- Sort options for recently updated, saved date, follow-up date, company, and status
- Applications table with saved date, applied date, follow-up date, red-flag indicators, and compact truncated notes previews

### Application Detail

- Tabbed detail panel for Overview, Dates & Follow-up, Job Details, Contact & Prep, Red Flags, and Activity
- Detail editing for company, role, job link, source, status, resume version, saved date, applied date, follow-up date, next action, contact context, prep notes, location, salary range, employment type, notes, and red flags
- Clear applied-date semantics: `date_saved` is when the job was added to Career Pipeline; `date_applied` is when the user actually applied
- Existing applied dates are not overwritten automatically
- Unsaved-change warnings when closing or switching selected applications
- Activity timeline with manual entries, follow-up quick-action outcomes, and automatic status-change entries, saved independently from the main detail form

### Pipeline Workflow

- Responsive grouped pipeline layout with status filters
- Status updates stay synced with Applications and Dashboard data
- Red-flag indicators appear on application cards where useful
- Archived records remain hidden from normal active workflow views

### Follow-Up Command Center

- Daily Command Center for overdue follow-ups, upcoming follow-ups, and stale active applications
- Action-item sections are backend-derived from `/api/applications/action-items`
- Next Action appears on Command Center cards when present
- Quick follow-up actions: Snooze 3 days, Snooze 1 week, and Clear follow-up
- Follow-up quick actions log Activity Timeline entries and prevent no-op snoozes
- Action results update shared frontend state so Applications and Dashboard remain consistent

### Dashboard Metrics

- Summary cards for active applications, follow-ups, red-flagged applications, interviews, and offers
- Status, source, resume-version usage, and red-flag snapshots
- Source Effectiveness metrics by source for applications, active count, interviews, offers, and closed outcomes
- Resume Version Effectiveness metrics for assigned resume variants
- Metrics are backend-derived from `/api/dashboard/summary`

### Resume Version Management

- Resume Versions page for creating, editing, deactivating, reactivating, and viewing reusable resume variants
- Resume versions can be assigned from Quick Add and Application Detail

### Red Flag Tracking

- Application Detail red-flag checklist and notes
- Compact red-flag counts in Applications and Pipeline
- Red flags are user-managed caution tags, not automated scoring

## App Pages

- Command Center
- Dashboard
- Quick Add
- Applications
- Pipeline
- Resume Versions

The sidebar navigation is sticky on desktop and responsive for narrower desktop layouts. Recent UI polish focuses on full-width and half-screen desktop usability, clearer status colors, dashboard metric accents, and avoiding page-level horizontal overflow.

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS
- Backend: FastAPI, Python, SQLAlchemy
- Database: SQLite for local-first development
- Testing: pytest for backend coverage, Vite production build for frontend verification
- CI: GitHub Actions runs backend tests and frontend build

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

The frontend expects the backend at:

```text
http://127.0.0.1:8000
```

Additional setup details are available in [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

## Verification

Backend tests:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Frontend build:

```powershell
cd frontend
npm run build
```

Docs-only changes do not require tests. Cross-stack product changes should run backend pytest, frontend build, and manual QA for the affected workflows.

## Project Status

Career Pipeline is a working local-first prototype with a FastAPI backend, SQLite database, React/Vite frontend, backend pytest coverage, and GitHub Actions CI. It supports quick capture, application management, tabbed detail editing, pipeline status updates, follow-up and status-change activity logging, dashboard effectiveness metrics, resume-version management, red-flag tracking, next actions, and activity timelines.

Deployment, authentication, AI features, scraping, browser extension workflows, and advanced analytics are not implemented. They are optional future directions rather than current product claims.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Data Model](docs/DATA_MODEL.md)
- [API Plan](docs/API_PLAN.md)
- [Wireframes](docs/WIREFRAMES.md)
- [Development Guide](docs/DEVELOPMENT.md)
