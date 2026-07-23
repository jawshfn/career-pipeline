# PursuitHQ · [Live Demo](https://jawshfn.github.io/career-pipeline/)

[![CI](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jawshfn/career-pipeline/actions/workflows/ci.yml)

Capture jobs fast. Stay on top of every next step.

PursuitHQ is a local-first job-search workspace for quickly capturing opportunities, organizing applications, managing follow-ups, and understanding what is working.

It is built as a practical product prototype: fast capture when a job looks interesting, richer detail when context matters, and clear daily surfaces for follow-ups, status changes, resumes, red flags, and activity history.

## Static Demo

The hosted demo uses fictional in-memory sample data. It is useful for reviewing the interface, but it does not connect to the FastAPI backend and changes reset when the page reloads.

## Product Highlights

- **Browser Capture:** recommended local workflow for verified Greenhouse identifiers; bounded Indeed, LinkedIn, and authenticated Handshake text capture; and signed-in ZipRecruiter selected-job capture; opens an editable review without manually copying the posting.
- **Add Job:** choose Manual Entry, Paste Job Link, or deterministic Paste Job Text review.
- **Applications:** search, filter, sort, and open detailed records across Active, Closed, and All views.
- **Status Board:** scan opportunities by stage and update statuses quickly.
- **Reminders:** start with a browser-local daily header, review overdue and upcoming follow-ups plus Needs check-in items, take reviewed atomic follow-up actions, and open the related Application Detail directly.
- **Dashboard:** see summary metrics, source results, resume results, and red-flag snapshots.
- **Resumes:** manage reusable resume variants and connect them to applications.
- **Application Detail:** open from Applications, Status Board, or Reminders; edit follow-up, job details, Job Posting Snapshot, resume/prep notes, red flags, activity history, and safely remove incorrect or duplicate records.
- **Data & backup:** download a complete JSON backup, use reviewed local replace restore, or export XLSX and CSV files for human review.

## Browser Capture - Recommended Local Workflow

The experimental, locally loaded PursuitHQ Capture companion is the fastest local workflow when you are already viewing a supported job. It supports verified Greenhouse identifiers, bounded Indeed capture, supported LinkedIn standalone and current-job panel layouts, signed-in ZipRecruiter selected-job capture across supported paginated search URLs, and authenticated Handshake standalone `/jobs/<positive numeric ID>` pages or the currently selected `/job-search/<positive numeric ID>` side-panel job. Handshake side-panel capture validates the selected job and preserves its direct standalone job link. After you confirm a detection, it opens an editable review; nothing is saved automatically.

Browser Capture requires the local frontend and FastAPI backend. It is not Chrome Web Store distributed, and the GitHub Pages demo does not support the helper. The helper reads only the active page after you click it, then transfers only the approved bounded job data to the local app.

See the [Browser Extension Guide](browser-extension/README.md) for local setup and privacy boundaries.

The repository and GitHub Pages URL retain the existing `career-pipeline` path.

## Structured Job Link Import

Paste Job Link automatically recognizes supported hosted Greenhouse and Lever postings, then opens structured details in an editable review. Lever supports canonical global and EU hosted links through its public Postings API; company remains a review field because Lever does not provide a dependable display name. Custom employer career links with one explicit `gh_jid` use best-effort Greenhouse configuration discovery. Unknown links retain link-only and Paste Job Text fallbacks. Nothing is saved automatically.

## Paste Job Text Fallback

Paste Job Text remains the broad deterministic fallback for unsupported sites or layouts, recruiter messages, copied postings, and recovery when Browser Capture cannot confidently identify a job. Paste text, review suggested fields, correct anything that looks wrong, then explicitly save. Source and Job Link remain user-controlled.

Read the [Paste Job Text Guide](docs/SMART_CAPTURE_GUIDE.md) for copy-and-review tips.

## Data & Backup

Export actions are user initiated from Help → Data & backup and download directly to the device.

### Workspace backup — JSON

The JSON export is the complete, lossless backup and restore format. It includes stored workspace data, resume versions, applications, activity history, IDs, and relationships, including active, closed, inactive, and legacy archived records. In the local app, choose a version-1 backup from Help, review its validation results and comparison with the current workspace, then explicitly type `RESTORE` to replace the complete workspace. Restore is replace-only, not a merge; download a fresh current backup first if you may need the current workspace later. The public GitHub Pages demo does not expose restore controls.

### Formatted applications workbook — XLSX

The XLSX workbook is a human-review format for Excel and Google Sheets. It contains concise non-archived application rows with filters, readable dates, clickable job links, status highlighting, red-flag highlighting, and overdue-follow-up highlighting. It omits full job descriptions, complete notes, activity rows, and internal IDs. The workbook is generated in the frontend for both local and demo modes.

### Applications CSV

The CSV is a portable human-review fallback using the same 19-column review contract as XLSX. It includes active and historical closed applications, excludes legacy archived applications, and contains concise previews rather than full long-form content.

## Tech Stack

- Frontend: React, Vite, JavaScript, CSS, ExcelJS
- Backend: FastAPI, Python, SQLAlchemy
- Database: SQLite
- Testing: pytest, Vitest
- CI: GitHub Actions

## Run Locally

The full local app uses the React frontend, FastAPI backend, and SQLite database.

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

The frontend expects the backend at `http://127.0.0.1:8000`.

## Verification

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Frontend:

```powershell
cd frontend
npm test
npm run build
```

Browser extension:

```powershell
node --test browser-extension/*.test.mjs
```

## Optional Demo Data

For local screenshots or demos, seed fictional data from the backend directory:

```powershell
.\.venv\Scripts\python.exe -m app.seed_demo_data
```

The seed command refuses to run if local application data already exists. Use `--reset` only when you intentionally want to clear local demo tables before reseeding.

## Static Demo Build

To build the frontend in GitHub Pages demo mode:

```powershell
cd frontend
$env:VITE_APP_MODE="demo"
$env:VITE_BASE_PATH="/career-pipeline/"
npm run build
```

## Project Status

PursuitHQ is a working local-first prototype, not a production SaaS app. The GitHub Pages site is a static portfolio demo with reset-on-refresh sample data.

Implemented: Greenhouse and Lever structured link imports, best-effort custom Greenhouse discovery, experimental locally loaded Greenhouse browser identifier capture, bounded Indeed capture, supported LinkedIn standalone and current-job panel capture, signed-in ZipRecruiter selected-job capture across supported paginated search URLs, authenticated Handshake standalone and selected side-panel capture, one-time local transfer, editable review with no autosave, browser-local Reminders daily context, reviewed atomic follow-up actions, direct Reminder-to-Application Detail navigation, JSON validation preview, authorized transactional JSON replace restore in the local app, and JSON, CSV, and XLSX workspace exports.

Not implemented: Chrome Web Store distribution, production backend/SaaS deployment, generic job-board scraping, authentication, multi-user synchronization, AI extraction, merge-style workspace import or conflict resolution, arbitrary third-party import formats, or email/calendar integrations.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Paste Job Text Guide](docs/SMART_CAPTURE_GUIDE.md)
- [Capture Engine](docs/CAPTURE_ENGINE.md)
- [Browser Extension Guide](browser-extension/README.md)
- [Data Model](docs/DATA_MODEL.md)
- [API Plan](docs/API_PLAN.md)
- [Development Guide](docs/DEVELOPMENT.md)
