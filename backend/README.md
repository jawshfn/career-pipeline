# Career Pipeline Backend

This backend began as the Phase 1 foundation for Career Pipeline. It provides a local-first FastAPI API with SQLite persistence, SQLAlchemy models, Pydantic schemas, local demo data, and pytest coverage for the application, resume-version, archive, dashboard, activity, and action-item workflows.

The React frontend now exists, and GitHub Actions CI runs backend tests, frontend tests, and the frontend production build. The backend currently supports applications, resume versions, pipeline status updates, archive behavior, Daily Command Center action items for overdue follow-ups, upcoming follow-ups due within 3 days, stale active applications, application activity entries, and Dashboard summary metrics. Deployment and authentication are planned for later phases.

## Setup

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Run the API

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

This file is local development state and should not be committed.

To use a different SQLite database path, set `CAREER_PIPELINE_DATABASE_URL` before starting the API.

## Run Tests

From the backend directory:

```powershell
cd backend
python -m pytest
```

Tests use a separate temporary SQLite database and do not write to `backend/career_pipeline.db`.

GitHub Actions CI runs this same backend test command on push and pull request.

## Seed Demo Data

After installing dependencies, run this from the backend directory:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed_demo_data
```

The seed script creates fictional, public-safe demo resume versions, applications, and activity entries. It does not use personal job-search data.

The command refuses to run if local app data already exists:

```text
Demo seed refused because local data already exists. Run with --reset to clear local app demo tables first.
```

Use reset only when you intentionally want to clear the local app demo tables before reseeding:

```powershell
.\.venv\Scripts\python.exe -m app.seed_demo_data --reset
```
