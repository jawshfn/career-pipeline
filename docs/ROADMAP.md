# PursuitHQ Roadmap

## Current status

PursuitHQ is a mature local-first prototype with capture workflows, application management, reminders, Status Board, Dashboard, Resume Library, data portability, Browser Capture, AI Job Intelligence, and a public demo.

## Completed capability areas

### Product and architecture foundation

- React/Vite, FastAPI/SQLAlchemy, and local SQLite workspace.
- Accessible product identity, focused pages, and GitHub Actions coverage.

### Application capture and management

- Manual entry, deterministic Paste Job Text, structured Greenhouse and Lever imports, and editable review before save.
- Application Detail, Job Posting Snapshots, status management, and permanent deletion.

### Follow-ups and daily workflow

- Reminder action items, atomic follow-up actions, next actions, and activity history.
- Status Board and Dashboard views for current work.

### Resume and preparation workflows

- Resume variants, preparation notes, red-flag review, and related dashboard views.

### Capture integrations and data portability

- Locally loaded Browser Capture for documented supported layouts.
- JSON backup including persisted AI briefs, validation, transactional replace restore, CSV export, and frontend-generated XLSX export.

### AI Job Intelligence and public demo

- User-initiated Job Intelligence Briefs through the Cloudflare Worker gateway, persisted locally per application after successful generation.
- A static public demo with fictional in-memory data and AI-ready examples.

## Next planned area: Outcome Insights

Outcome Insights would add transparent response definitions, furthest-stage logic, resume-version and source performance, and funnel/progression views. It should include sample-size cautions and avoid misleading “best” claims from tiny datasets.

## Later possibilities

- Email and calendar integrations.
- Resume file preview.
- Authentication and synchronization.
- Additional documented ATS adapters.
- Production distribution for the browser companion.
- Hosted backend only if the product reaches that stage.
- Merge-style import with conflict resolution.
