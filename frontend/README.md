# Career Pipeline Frontend

This is the React/Vite frontend for Career Pipeline. It includes the Daily Command Center, Dashboard, dedicated Quick Add page, Applications page, applications table, application detail panel, Pipeline page for viewing applications by status and updating status, and Resume Versions page for managing reusable resume variants.

The quick-add flow supports an optional follow-up date with common presets so users can capture next-step timing without opening a larger form. The application detail panel supports richer edits such as notes, dates, salary range, location, status, resume-version assignment, and red-flag tracking. The Resume Versions page supports creating, editing, deactivating, and reactivating resume versions. The Daily Command Center surfaces overdue follow-ups, upcoming follow-ups due within 3 days, and stale active applications using backend rules. The Dashboard summarizes active applications by status, source, resume version, follow-up timing, and red flags. Authentication, deployment, and browser extension features are not part of this phase yet.

## Setup

From the repository root:

```powershell
cd frontend
npm install
```

## Run the Dev Server

Start the FastAPI backend first:

```powershell
cd backend
python -m uvicorn app.main:app --reload
```

Then start the frontend:

```powershell
cd frontend
npm run dev
```

The frontend API layer expects the backend at:

```text
http://127.0.0.1:8000
```

## Build

```powershell
cd frontend
npm run build
```

The build does not require the backend server to be running.
