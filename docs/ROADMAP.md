# Roadmap

This roadmap is product-first and conservative. Career Pipeline is built in small increments so the core job-search workflow stays usable before optional integrations are added.

## Phase 0: Documentation and Product Planning

Status: complete

- Define product vision and MVP scope
- Document core workflows
- Draft data model
- Draft REST API plan
- Create text-based wireframes
- Establish development principles and definition of done

## Phase 1: Backend Foundation

Status: complete

- Create FastAPI project structure
- Add SQLite database setup
- Add local development configuration
- Add health endpoint
- Add initial pytest setup
- Add basic GitHub Actions test workflow

## Phase 1.5: CI Foundation

Status: complete

- Add GitHub Actions backend test automation
- Add frontend build automation after the React scaffold
- Keep CI focused on backend pytest and frontend production build

## Phase 2: Quick Add and Applications Table

Status: complete

- Implement application create, read, update, list, and archive behavior
- Support lightweight application capture
- Build initial applications table UI
- Add backend tests for application workflows

## Phase 3: Pipeline Board

Status: complete

- Define application statuses
- Build visual pipeline workflow
- Allow status updates through the existing application update API
- Keep status changes persisted and visible across views

## Phase 3.5: Frontend Workflow Polish

Status: complete

- Improve navigation clarity between Applications and Pipeline
- Keep Applications and Pipeline state reasonably consistent
- Improve status update loading and error states
- Add manual QA checklist
- Update documentation for current state

## Phase 4: Follow-Up Queue / Daily Command Center

Status: complete

- Add follow-up date rules
- Build Daily Command Center
- Surface overdue follow-ups and upcoming follow-ups due within 3 days
- Surface stale active applications without adding a separate follow-up status

## Phase 5: Application Detail / Resume Version Workflow

Status: complete

- Phase 5.1: add Application Detail panel from the Applications table
- Phase 5.2: add Resume Versions page for create, edit, deactivate, and reactivate workflows
- Phase 5.3 / 5.3.1: improve Application Detail fields, status select sizing, and form consistency
- Phase 5.4: responsive layout polish for sidebar, Quick Add, detail sections, and tables
- Phase 5.5: redesign Pipeline into a responsive grouped/filter layout
- Phase 5.6: UI consistency and demo polish
- Phase 5.7: sticky responsive sidebar navigation

## Phase 6: Red-Flag System

Status: complete

- Phase 6.1: add red-flag fields to applications
- Add red-flag checklist and notes to Application Detail
- Add compact red-flag indicators in Applications and Pipeline
- Keep red flags user-managed, with no AI scoring

## Phase 7: Dashboard, Search, Follow-Ups, and CRM Polish

Status: complete

- Phase 7.1: Dashboard Metrics Foundation
- Phase 7.2: Applications search, filters, and sorting
- Phase 7.2.1: split Quick Add into its own page
- Phase 7.2.2 / 7.2.3: improve Quick Add success flow and date-saved sorting
- Phase 7.2.4: clarify applied-date behavior
- Phase 7.2.5: polish Quick Add date field layout
- Phase 7.2.6: truncate long Applications table notes
- Phase 7.2.7: scroll Application Detail into view when selecting Details
- Phase 7.3: add Command Center follow-up quick actions
- Phase 7.4: add Active, Closed, and All Applications views
- Phase 7.5: add manual Application Activity Timeline
- Phase 7.6: refresh project documentation
- Phase 7.7: organize Application Detail into tabs
- Phase 7.8: add optional Next Action support
- Phase 7.9: log follow-up quick-action outcomes to Activity Timeline
- Phase 7.9.1: prevent no-op follow-up snoozes

## Phase 8: Dashboard Effectiveness and Visual Polish

Status: complete through Phase 8.9 plus targeted app-shell restoration

- Phase 8.0: add Source Effectiveness metrics to Dashboard
- Phase 8.1: add Resume Version Effectiveness metrics to Dashboard
- Phase 8.2: improve visual status distinction and dashboard accents
- Phase 8.3: polish status visuals, metadata readability, empty states, and pipeline distinction
- Phase 8.4: add application-scoped Contact & Prep details in Application Detail
- Command Center source-of-truth cleanup: use backend action-item rules for overdue, upcoming, and stale sections
- Phase 8.5: add backend Dashboard summary endpoint and render backend-derived dashboard metrics
- Phase 8.6: centralize repeated application domain constants
- Phase 8.7: centralize frontend API client boilerplate
- Phase 8.8: remove stale code and simplify leftover props/helpers after refactors
- Phase 8.9: automatically log application status changes to Activity Timeline
- Targeted UI polish: restore app shell layout constraints, sticky sidebar behavior, page centering, and horizontal overflow protections
- Documentation refresh: update docs for recent workflow, dashboard, and UI changes

## Phase 9: Smart Capture

Status: complete through Phase 9.8

- Phase 9.0: add Smart Capture paste-review workflow to Quick Add without AI integration
- Phase 9.1: improve source-aware rule-based extraction for common job-board pasted text
- Phase 9.2: simplify Smart Capture extraction and add flexible compensation capture
- Phase 9.3: improve header-level employment type detection without scanning full descriptions
- Phase 9.4 / 9.4b: improve LinkedIn parsing and clean copied logo/header lines in generic parsing
- Phase 9.5: add Smart Capture guidance copy for supported paste formats and best-effort company pages
- Phase 9.6: align Smart Capture and backend applied-date defaults
- Phase 9.7: improve Indeed-style location precision
- Phase 9.8: parse LinkedIn location metadata and add internal parser-format detection while preserving user-selected Source

## Phase 10: Detail and Applications Table Polish

Status: complete through Phase 10.5

- Phase 10.0: strengthen Application Detail action header, summary context, job-link action, and follow-up presets
- Phase 10.1: improve date display consistency across detail and table surfaces
- Phase 10.2: improve Applications table scanability around next actions and follow-up urgency
- Phase 10.3: simplify the Applications table into an opportunity-focused layout with Notes and Details actions
- Phase 10.3b: make the Notes shortcut open Application Detail on the Job Details tab
- Phase 10.3c: prevent tab shortcuts from reloading application data or discarding unsaved edits
- Phase 10.4: refresh documentation for the current MVP behavior
- Phase 10.5: add Smart Capture review guardrails for best-match parser, captured fields, and user-controlled Source/Job link reminders

## Phase 11: Application Detail Reorganization

Status: complete through Phase 11.0d

- Phase 11.0: reorganize Application Detail so Overview is a read-only command snapshot and editable fields live in focused tabs
- Phase 11.0b: remove repetitive Overview Quick edit shortcuts and keep contextual Needs attention actions
- Phase 11.0c: treat no red flags marked as a neutral Overview state instead of an attention item
- Phase 11.0d: hide the persistent summary strip on Overview and normalize explicit user-entered job links

## Phase 12: Capture Quality Guardrails

Status: complete through Phase 12.6

- Phase 12.0: add advisory duplicate and similar-opportunity warnings to Manual Entry and Smart Capture Review
- Phase 12.1: add Vitest frontend utility tests for job link normalization and duplicate/similar opportunity detection
- Phase 12.2: split Application Detail into focused presentational components while preserving parent orchestration
- Phase 12.2b: preserve Activity tab draft input across Application Detail tab switches
- Phase 12.2c: include unsaved Activity drafts in detail warning and navigation protection
- Phase 12.3: normalize shared frontend application create/edit payload handling
- Phase 12.4: add Smart Capture parser test coverage for deterministic review guardrails
- Phase 12.5: audit backend/frontend application contract handling and add nullable-field contract coverage
- Phase 12.6: tighten README and documentation accuracy for current local-first prototype

## Phase 13: Demo Readiness

Status: complete through Phase 13.1c

- Phase 13.0: add safe local-only fictional demo data seeding workflow for recruiter/demo screenshots
- Phase 13.1a: simplify Manual Quick Add by keeping tracking details behind an optional disclosure
- Phase 13.1b: simplify Smart Capture Review into clearer review sections with optional tracking details
- Phase 13.1c: simplify Applications filters with visible search/sort and collapsed advanced filters

## Near-Term Future Work

These are realistic polish and presentation steps, not current product claims:

- Demo screenshots and walkthrough flow
- Public presentation pass for README, screenshots, and walkthrough flow
- Optional AI-assisted Smart Capture extraction after the deterministic review workflow proves useful
- Optional red-flag polish, such as clearer review summaries or filtering refinements
- Optional richer analytics after the dashboard proves useful
- Optional deployment improvements for a public demo
- Optional import/export workflows
- Optional contact/recruiter organization if the core workflow needs it
- Lightweight frontend smoke tests if the UI stabilizes enough to justify them

## Later Possible Enhancements

These are possible directions and should remain clearly optional:

- Email or calendar reminders
- Resume file upload and preview
- Company and recruiter contact management
- Browser extension or job-board capture helper
- Authentication and multi-device sync
- AI-assisted summaries or suggestions
