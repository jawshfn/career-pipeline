# Career Pipeline Frontend

React/Vite frontend for the Career Pipeline local job-search workspace. Normal local mode talks to the FastAPI backend; demo mode uses bundled fictional in-memory data for GitHub Pages.

## Pages

- Reminders: overdue follow-ups, upcoming follow-ups, Needs check-in items, and follow-up quick actions
- Dashboard: summary cards plus expandable Application Status, Sources, Red Flags, Source Results, and Resume Results sections
- Add Job: Manual Entry, Paste Job Link, and Paste Job Text workflows
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

## Local Browser Capture

The optional local Greenhouse helper can open Add Job -> Paste Job Link with a validated versioned URL fragment. The frontend clears the fragment immediately, validates it independently, and reuses the existing backend Greenhouse import path. The original employer URL remains Job Link, Source defaults to Company Website and remains editable, and the user still reviews and saves manually.

See the [Browser Extension Guide](../browser-extension/README.md) for local unpacked-extension setup. The static demo does not run browser-assisted live Greenhouse imports.

## Paste Job Link Imports

Paste Job Link automatically recognizes supported hosted Greenhouse and canonical Lever links. Lever supports `jobs.lever.co/{site}/{posting-id}` and `jobs.eu.lever.co/{site}/{posting-id}`, including `/apply` links; the review preserves the entered Job Link and selected Source. The user always reviews and saves manually. The static demo includes fictional Greenhouse and Lever fixtures only.

## Static Demo Mode

Demo mode is enabled only when `VITE_APP_MODE=demo`. It uses fictional in-memory frontend data, resets on page refresh, and does not make browser-assisted live Greenhouse imports.

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
