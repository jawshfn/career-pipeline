# Career Pipeline Frontend

This is the React/Vite frontend for Career Pipeline. It provides the user-facing workspace for quick application capture, application management, pipeline review, follow-up actions, dashboard metrics, resume-version management, red-flag tracking, and activity timelines.

## Page Structure

- Command Center: overdue follow-ups, upcoming follow-ups, stale applications, and follow-up quick actions
- Dashboard: job-search summary metrics derived from loaded applications and resume versions
- Quick Add: lightweight application capture workflow
- Applications: Active, Closed, and All views with search, filters, sorting, table previews, and Details access
- Pipeline: responsive grouped application status workflow with status filters
- Resume Versions: create, edit, deactivate, reactivate, and view reusable resume variants

## Main Frontend Features

- Sticky responsive sidebar navigation
- Quick Add success flow with Add another and View applications actions
- Applied-date handling that defaults only when useful and does not overwrite existing dates
- Application Detail editing for richer application context, red flags, and activity timeline entries
- Independent activity timeline add/list/delete behavior inside Application Detail
- Applications table note truncation with hover/title preview for long notes
- Command Center follow-up actions for Snooze 3 days, Snooze 1 week, and Clear follow-up
- Responsive layout polish for normal full-screen and half-screen desktop widths

## Local Backend Requirement

The frontend API layer expects the FastAPI backend to be running locally at:

```text
http://127.0.0.1:8000
```

Start the backend before using the app interactively:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Setup

From the repository root:

```powershell
cd frontend
npm install
```

## Available Scripts

Run the Vite dev server:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

Preview the production build locally:

```powershell
npm run preview
```

The production build does not require the backend server to be running, but interactive API features do.
