# Career Pipeline

[![CI](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml)

Career Pipeline is a local-first full-stack job-search workspace for capturing opportunities, tracking applications, managing follow-ups, and reviewing progress.

It is built as a practical product prototype: fast capture when a job looks interesting, richer detail when context matters, and clear daily surfaces for follow-ups, status changes, resumes, red flags, and activity history.

## Product Highlights

- **Add Job:** save opportunities manually or with deterministic Smart Capture from pasted job text.
- **Applications:** search, filter, sort, and open detailed records across Active, Closed, and All views.
- **Status Board:** scan opportunities by stage and update statuses quickly.
- **Reminders:** review overdue follow-ups, upcoming follow-ups, and Needs check-in items.
- **Dashboard:** see summary metrics, source results, resume results, and red-flag snapshots.
- **Resumes:** manage reusable resume variants and connect them to applications.
- **Application Detail:** edit follow-up, job details, resume/prep notes, red flags, and activity timeline entries.

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

## Optional Demo Data

For local screenshots or demos, seed fictional data from the backend directory:

```powershell
.\.venv\Scripts\python.exe -m app.seed_demo_data
```

The seed command refuses to run if local application data already exists. Use `--reset` only when you intentionally want to clear local demo tables before reseeding.

## Project Status

Career Pipeline is a working local-first prototype, not a deployed production SaaS app.

Not implemented: authentication, deployment, scraping, browser extension workflows, AI extraction, import/export, email/calendar integrations, or multi-user sync.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Data Model](docs/DATA_MODEL.md)
- [API Plan](docs/API_PLAN.md)
- [Development Guide](docs/DEVELOPMENT.md)
