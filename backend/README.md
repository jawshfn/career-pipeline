# Career Pipeline Backend

FastAPI backend for the Career Pipeline local-first prototype. It provides SQLite persistence, SQLAlchemy models, Pydantic schemas, demo data seeding, and pytest coverage for the core job-search workflows.

The backend is used by the full local app. It is not hosted by GitHub Pages; the Pages version is a static frontend demo with fictional in-memory data.

## Current API Areas

- Applications: create, list, retrieve, update, archive
- Application activities: list, create, update, delete timeline entries
- Reminders action items: overdue follow-ups, upcoming follow-ups, and Needs check-in items
- Dashboard summary metrics
- Resume variants
- Job imports: direct Greenhouse Job Board API import, direct canonical Lever Postings API import, and best-effort custom employer Greenhouse discovery
- Health check

Greenhouse imports use the official Job Board API. Canonical `jobs.lever.co` and `jobs.eu.lever.co` posting links use Lever's documented individual Postings API; the backend never crawls a Lever board or infers a company name from its site token. The custom employer Greenhouse path verifies one board token from bounded safe-public-HTML structural evidence before importing; it does not provide generic scraping. The experimental browser helper can also send one user-initiated Indeed text capture to a bounded, in-memory, one-time local transfer endpoint; it never fetches Indeed or writes an application.

The backend is local-development focused. Authentication, production backend deployment, generic scraping, AI extraction, import/export, and email/calendar integrations are not implemented.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Run The API

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Health check:

```text
GET http://127.0.0.1:8000/api/health
```

## Local Database

The default SQLite database is created at:

```text
backend/career_pipeline.db
```

This file is local development state and should not be committed. To use a different SQLite database path, set `CAREER_PIPELINE_DATABASE_URL` before starting the API.

## Run Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Tests use a separate temporary SQLite database and do not write to `backend/career_pipeline.db`.

## Seed Demo Data

Seed fictional, public-safe demo data from the backend directory:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed_demo_data
```

The command refuses to run if local app data already exists:

```text
Demo seed refused because local data already exists. Run with --reset to clear local app demo tables first.
```

Use reset only when you intentionally want to clear local demo tables before reseeding:

```powershell
.\.venv\Scripts\python.exe -m app.seed_demo_data --reset
```
