# Roadmap

Career Pipeline is built in small, product-first increments. The roadmap below records completed work and keeps future work realistic for the current local-first prototype.

## Phase 0 — Product Planning

Status: complete

- Phase 0.1 — Define product vision, MVP scope, core workflows, data model, REST API plan, and development principles.

## Phase 1 — Backend And CI Foundation

Status: complete

- Phase 1.0 — Create the FastAPI project, SQLite setup, health endpoint, pytest foundation, and backend CI.
- Phase 1.5 — Extend CI to include frontend install/build after the React scaffold.

## Phase 2 — Application Capture And List

Status: complete

- Phase 2.0 — Implement application create, read, update, list, and archive behavior.
- Phase 2.1 — Build lightweight application capture and the initial Applications table.

## Phase 3 — Status Workflow

Status: complete

- Phase 3.0 — Define application statuses and implement persisted status updates.
- Phase 3.5 — Improve navigation clarity and sync between Applications and the status workflow.

## Phase 4 — Reminders Foundation

Status: complete

- Phase 4.0 — Add follow-up date rules and daily action-item views for overdue, upcoming, and Needs check-in opportunities.

## Phase 5 — Application Detail, Resumes, And Layout Polish

Status: complete

- Phase 5.1 — Add Application Detail from the Applications table.
- Phase 5.2 — Add Resumes create, edit, deactivate, and reactivate workflows.
- Phase 5.3 — Improve Application Detail fields, status select sizing, and form consistency.
- Phase 5.4 — Improve responsive layout for navigation, forms, details, and tables.
- Phase 5.5 — Redesign the status workflow into a responsive grouped layout.
- Phase 5.6 — Polish UI consistency, empty states, spacing, and button hierarchy.
- Phase 5.7 — Add sticky responsive sidebar navigation.

## Phase 6 — Red Flags

Status: complete

- Phase 6.1 — Add user-managed red-flag fields, checklist UI, notes, and compact indicators.

## Phase 7 — Dashboard, Search, Follow-Ups, And Activity

Status: complete

- Phase 7.1 — Add Dashboard metric cards and breakdowns.
- Phase 7.2 — Add Applications search, filters, sorting, Active/Closed/All views, and table polish.
- Phase 7.3 — Add Reminders follow-up quick actions.
- Phase 7.4 — Add manual Application Activity Timeline.
- Phase 7.5 — Refresh documentation for the current workflow.
- Phase 7.6 — Organize Application Detail into focused tabs.
- Phase 7.7 — Add optional Next Action support.
- Phase 7.8 — Log follow-up quick-action outcomes to Activity Timeline.
- Phase 7.9 — Prevent no-op follow-up snoozes.

## Phase 8 — Backend Source Of Truth And Visual Polish

Status: complete

- Phase 8.0 — Add Source Results metrics.
- Phase 8.1 — Add Resume Results metrics.
- Phase 8.2 — Improve status colors, dashboard accents, and visual hierarchy.
- Phase 8.3 — Add application-scoped Contact & Prep details.
- Phase 8.4 — Move Reminders action-item rules to the backend.
- Phase 8.5 — Add backend Dashboard summary endpoint.
- Phase 8.6 — Centralize shared application domain constants.
- Phase 8.7 — Centralize frontend API client boilerplate.
- Phase 8.8 — Remove stale code and props after source-of-truth refactors.
- Phase 8.9 — Automatically log meaningful status changes to Activity Timeline.

## Phase 9 — Smart Capture

Status: complete

- Phase 9.0 — Add deterministic Smart Capture paste-review workflow without AI.
- Phase 9.1 — Improve source-aware extraction for common copied job posts.
- Phase 9.2 — Add flexible compensation capture and simplify extraction rules.
- Phase 9.3 — Improve header-level employment type detection.
- Phase 9.4 — Improve LinkedIn parsing and copied logo/header cleanup.
- Phase 9.5 — Add Smart Capture guidance copy for best-fit paste sources.
- Phase 9.6 — Align Smart Capture and backend applied-date defaults.
- Phase 9.7 — Improve Indeed-style location precision.
- Phase 9.8 — Add LinkedIn location metadata parsing and internal parser-format detection.

## Phase 10 — Detail And Applications Table Polish

Status: complete

- Phase 10.0 — Strengthen Application Detail action header, summary context, job-link action, and follow-up presets.
- Phase 10.1 — Improve date display consistency.
- Phase 10.2 — Improve Applications table next-action and follow-up scanability.
- Phase 10.3 — Simplify Applications table into opportunity-focused rows with Notes and Details actions.
- Phase 10.4 — Prevent tab shortcuts from reloading application data or discarding unsaved edits.
- Phase 10.5 — Add Smart Capture review guardrails.

## Phase 11 — Application Detail Reorganization

Status: complete

- Phase 11.0 — Reorganize Application Detail so Overview is read-only and editable fields live in focused tabs.
- Phase 11.0b — Remove repetitive Overview shortcut rows and keep contextual Needs attention actions.
- Phase 11.0c — Treat no red flags marked as a neutral Overview state.
- Phase 11.0d — Hide the persistent summary strip on Overview and normalize explicit user-entered job links.

## Phase 12 — Capture Quality And Refactors

Status: complete

- Phase 12.0 — Add advisory duplicate and similar-opportunity warnings.
- Phase 12.1 — Add Vitest utility tests for job links and duplicate detection.
- Phase 12.2 — Split Application Detail into focused presentational components.
- Phase 12.2b — Preserve Activity draft input across tab switches.
- Phase 12.2c — Include unsaved Activity drafts in detail warnings.
- Phase 12.3 — Normalize shared frontend application create/edit payload handling.
- Phase 12.4 — Add Smart Capture parser test coverage.
- Phase 12.5 — Audit backend/frontend application contract handling.
- Phase 12.6 — Tighten README and documentation accuracy.

## Phase 13 — Demo Readiness

Status: complete through Phase 13.2

- Phase 13.0 — Add safe local-only fictional demo data seeding.
- Phase 13.1a — Simplify Manual Entry in Add Job.
- Phase 13.1b — Simplify Smart Capture Review.
- Phase 13.1c — Simplify Applications filters.
- Phase 13.1d — Simplify sidebar navigation labels.
- Phase 13.1e — Simplify Application Detail tabs and summary-strip layout.
- Phase 13.1f — Simplify Reminders cards and exclude closed outcomes from follow-up reminders.
- Phase 13.1g — Polish Dashboard layout and public documentation wording.
- Phase 13.1h — Reframe Status Board with search, clearer filters, and adaptive compact tiles.

- Phase 13.2 - Add a static GitHub Pages demo mode with fictional frontend data while preserving the local FastAPI/SQLite app.

## Near-Term Future Work

- Demo screenshots and walkthrough flow
- Final recruiter-facing screenshot audit
- Final responsive browser QA pass
- Optional lightweight frontend smoke tests if the UI stabilizes enough to justify them

## Later Optional Enhancements

- Public demo deployment improvements
- Import/export workflows
- Contact or recruiter organization if the core workflow needs it
- Email or calendar reminders
- Resume file upload and preview
- Browser extension or job-board capture helper
- Authentication and multi-device sync
- AI-assisted summaries or suggestions
