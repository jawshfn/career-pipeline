# Career Pipeline Frontend

React/Vite frontend for the Career Pipeline local job-search workspace. Normal local mode talks to the FastAPI backend; demo mode uses bundled fictional in-memory data for GitHub Pages.

## Pages

- Reminders: overdue follow-ups, upcoming follow-ups, Needs check-in items, and follow-up quick actions
- Dashboard: summary cards plus expandable Application Status, Sources, Red Flags, Source Results, and Resume Results sections
- Add Job: Manual Entry and Smart Capture paste-review workflows
- Applications: Active, Closed, and All views with search, filters, sorting, table actions, and Application Detail
- Status Board: grouped status board with search, status filters, adaptive tiles, and quick status updates
- Resumes: create, edit, deactivate, reactivate, and view reusable resume variants

## Local Backend

Interactive frontend features expect the FastAPI backend at:

```text
http://127.0.0.1:8000
```

Start the backend from the repository root:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Setup

```powershell
cd frontend
npm install
```

## Scripts

Run the dev server:

```powershell
npm run dev
```

Run frontend tests:

```powershell
npm test
```

Build for production:

```powershell
npm run build
```

Preview the production build:

```powershell
npm run preview
```

The production build can complete without the backend running, but API-driven pages need the backend for interactive use.

## Static Demo Mode

Demo mode is enabled only when `VITE_APP_MODE=demo`. It uses fictional frontend data and resets on page refresh.

Build for GitHub Pages:

```powershell
$env:VITE_APP_MODE="demo"
$env:VITE_BASE_PATH="/career-pipeline/"
npm run build
```

Preview the built demo locally:

```powershell
npm run preview
```

The GitHub Pages workflow runs frontend tests, builds with `VITE_APP_MODE=demo`, and publishes `frontend/dist`.
