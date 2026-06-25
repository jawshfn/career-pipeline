# Career Pipeline

Career Pipeline is a full-stack job-search command center prototype for capturing opportunities, tracking applications, managing follow-ups, and understanding job-search progress across multiple sources.

## Product Goal

Help new grads, early-career applicants, career switchers, and active job seekers quickly capture job opportunities, track each application through a clear pipeline, remember which resume version was used, record company and recruiter notes, and manage follow-up work. Planned future capabilities include red-flag tags for questionable postings and response/source insights.

## Target Users

- New graduates managing many entry-level applications
- Early-career applicants applying across several job boards
- Career switchers tracking role fit, resume variants, and outreach
- Job seekers using LinkedIn, Indeed, ZipRecruiter, company sites, referrals, recruiter calls, and direct outreach

## Current Product Flow

- Quick-add workflow for fast application capture, including optional follow-up date presets
- Applications table for active applications
- Pipeline board with persisted status updates
- Daily Command Center for overdue follow-ups, upcoming follow-ups due within 3 days, and stale active applications
- Resume-version backend endpoints and quick-add assignment support
- Archive behavior that hides archived records from active workflow views

## Planned Future Features

- Application detail workflow with richer notes and history
- Red-flag tags for questionable or suspicious postings
- Dashboard metrics for source, status, and response insights
- Follow-up completion and rescheduling workflow
- Deployment, authentication, AI features, and browser extension support are not implemented yet

## Tech Stack

- Frontend: React, JavaScript, HTML/CSS
- Backend: FastAPI, Python
- Database: SQLite
- Testing: pytest
- CI: GitHub Actions
- Deployment: GitHub Pages for the frontend initially; backend local-first at first

## Current Project Status

Career Pipeline currently has a FastAPI backend with SQLite and SQLAlchemy, a React/Vite frontend, backend pytest coverage, and GitHub Actions CI for backend tests and frontend build. The working prototype supports quick-add, application table views, resume-version assignment during quick-add, pipeline status updates, archive behavior, and the Daily Command Center.

The full product is not complete yet. Red flags, dashboard metrics, application detail workflow, follow-up completion/rescheduling, deployment, authentication, AI, and browser extension features are still planned or intentionally out of scope.

## Planned Development Phases

1. Phase 0: Documentation and product planning
2. Phase 1: Backend foundation
3. Phase 2: Quick-add and applications table
4. Phase 3: Pipeline board
5. Phase 4: Follow-up queue / daily command center
6. Phase 5: Application detail / resume version workflow
7. Phase 6: Red-flag system
8. Phase 7: Dashboard metrics and insights
9. Phase 8: Testing, CI, demo data, screenshots, and polish

## Screenshots

Screenshots have not been added yet. They should be captured from the working frontend after the next UI polish pass.

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
