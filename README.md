# Career Pipeline

Career Pipeline is a planned full-stack job-search command center for capturing opportunities, tracking applications, managing follow-ups, and understanding job-search progress across multiple sources.

## Product Goal

Help new grads, early-career applicants, career switchers, and active job seekers quickly capture job opportunities, track each application through a clear pipeline, remember which resume version was used, record company and recruiter notes, identify questionable postings with red-flag tags, and see where responses are coming from.

## Target Users

- New graduates managing many entry-level applications
- Early-career applicants applying across several job boards
- Career switchers tracking role fit, resume variants, and outreach
- Job seekers using LinkedIn, Indeed, ZipRecruiter, company sites, referrals, recruiter calls, and direct outreach

## Planned MVP Features

- Quick-add workflow for fast application capture
- Applications table with search, filtering, and status tracking
- Pipeline board for visual application progress
- Follow-up queue for due and upcoming reminders
- Resume version tracking per application
- Red-flag tags for questionable or suspicious postings
- Basic dashboard metrics for source, status, and response insights
- Application detail view with notes and event history

## Tech Stack

- Frontend: React, JavaScript, HTML/CSS
- Backend: FastAPI, Python
- Database: SQLite
- Testing: pytest
- CI: GitHub Actions
- Deployment: GitHub Pages for the frontend initially; backend local-first at first

## Current Project Status

Career Pipeline is currently in planning and early implementation. Phase 0 product documentation is in place. The Phase 1 backend foundation exists with a local-first FastAPI API, SQLite persistence, and backend pytest coverage. Phase 1.5 added GitHub Actions CI. Phase 2 added the React frontend scaffold, quick-add application form, and applications table connected to the backend.

The full product is not complete yet. The pipeline board, dashboard metrics, red flags, follow-up queue, application detail page, and deployment are still planned.

## Planned Development Phases

1. Phase 0: Documentation and product planning
2. Phase 1: Backend foundation
3. Phase 2: Quick-add and applications table
4. Phase 3: Pipeline board
5. Phase 4: Follow-up queue / daily command center
6. Phase 5: Resume versions
7. Phase 6: Red-flag system
8. Phase 7: Dashboard metrics and insights
9. Phase 8: Testing, CI, demo data, screenshots, and polish

## Screenshots

Screenshots will be added after the first working frontend prototype is available.

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

Additional setup details are available in [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

## Tests

Backend:

```powershell
cd backend
python -m pytest
```

Frontend:

```powershell
cd frontend
npm run build
```

GitHub Actions CI runs backend pytest and the frontend production build on push and pull request.

## Deployment

Deployment notes will be added when the frontend is ready for GitHub Pages and the backend local-first workflow is documented.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Data Model](docs/DATA_MODEL.md)
- [API Plan](docs/API_PLAN.md)
- [Wireframes](docs/WIREFRAMES.md)
- [Development Guide](docs/DEVELOPMENT.md)
