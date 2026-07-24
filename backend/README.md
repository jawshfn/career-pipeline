# PursuitHQ Backend

The local FastAPI/SQLAlchemy backend persists the PursuitHQ workspace in SQLite and exposes the `/api` JSON API.

## API areas

- Applications, permanent deletion, and backend-owned status-change activities.
- Application activities, atomic follow-up actions, and reminder action items.
- Dashboard summaries and resume variants, including delete-impact protection.
- Hosted Greenhouse, custom Greenhouse discovery, and canonical Lever imports.
- One-time browser text-capture transfer for the local companion.
- JSON workspace export, applications CSV export, read-only validation, and transactional replace restore.
- `GET /api/health`.

Legacy archive fields remain compatible with older records; normal application removal is permanent. See the [API reference](../docs/API_REFERENCE.md) for endpoint inventory.

## AI boundary

FastAPI does not generate Job Intelligence Briefs. Requests go directly from the frontend to the separate Cloudflare Worker gateway; after frontend validation, FastAPI stores the latest saved brief with the local application.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Check [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) or interactive docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). The default local database is `backend/career_pipeline.db`; override it with `CAREER_PIPELINE_DATABASE_URL`.

## Tests and demo seed

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m app.seed_demo_data
```

The optional seed uses fictional data and refuses to overwrite an existing workspace unless explicitly reset.
