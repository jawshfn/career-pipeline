# Career Pipeline Backend

This backend is the Phase 1 foundation for Career Pipeline. It provides a local-first FastAPI API with SQLite persistence, SQLAlchemy models, Pydantic schemas, seed data, and pytest coverage for the initial application and resume-version workflows.

The React frontend, dashboard, red flags, follow-up queue, pipeline UI, deployment, and frontend CI are intentionally out of scope for this phase.

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

After installing dependencies, run:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m app.seed
```

The seed script creates fictional, public-safe demo resume versions and applications. It does not use personal job-search data.
