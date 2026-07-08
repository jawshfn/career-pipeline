# Career Pipeline Frontend

This is the React/Vite frontend for Career Pipeline. It provides the user-facing workspace for quick application capture, application management, pipeline review, follow-up actions, dashboard metrics, resume-version management, red-flag tracking, and activity timelines.

## Page Structure

- Command Center: backend-derived overdue follow-ups, upcoming follow-ups, stale applications, Next Action display, and follow-up quick actions
- Dashboard: backend-derived job-search summary metrics, source/resume breakdowns, Source Effectiveness, and Resume Version Effectiveness
- Quick Add: lightweight manual capture and Smart Capture paste-review workflow
- Applications: Active, Closed, and All views with search, filters, sorting, opportunity-focused table rows, Notes shortcut, and Details access
- Pipeline: responsive grouped application status workflow with status filters
- Resume Versions: create, edit, deactivate, reactivate, and view reusable resume variants

## Main Frontend Features

- Sticky responsive sidebar navigation
- Quick Add success flow with Add another and View applications actions
- Smart Capture mode that prepares conservative editable suggestions from pasted job text before saving
- Smart Capture parser-format detection for common LinkedIn, Indeed, ZipRecruiter, and generic pasted text while preserving the user-selected Source and explicit Job link input
- Smart Capture review guardrails that summarize best-match parser, captured fields, and user-controlled Source/Job link behavior
- Applied-date handling that defaults only when useful and does not overwrite existing dates
- Tabbed Application Detail with a read-only Overview command snapshot plus focused editing tabs for status/follow-ups, job details, contact/prep notes, red flags, and activity timeline entries
- Optional Next Action support in Application Detail and Command Center cards
- Independent activity timeline add/list/delete behavior inside Application Detail
- Opportunity-focused Applications table with follow-up urgency, red-flag counts, Notes badge shortcut, and Details action
- Command Center follow-up actions for Snooze 3 days, Snooze 1 week, and Clear follow-up, with activity logging and no-op snooze prevention
- Visual readability polish for status colors, dashboard accents, pipeline distinction, and empty states
- Responsive layout polish for normal full-screen and half-screen desktop widths
- App shell constraints that keep desktop navigation sticky, center pages in the main content area, and avoid page-level horizontal overflow

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
