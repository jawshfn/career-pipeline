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

Status: complete through Phase 8.3 plus targeted app-shell restoration

- Phase 8.0: add Source Effectiveness metrics to Dashboard
- Phase 8.1: add Resume Version Effectiveness metrics to Dashboard
- Phase 8.2: improve visual status distinction and dashboard accents
- Phase 8.3: polish status visuals, metadata readability, empty states, and pipeline distinction
- Phase 8.4: add application-scoped Contact & Prep details in Application Detail
- Command Center source-of-truth cleanup: use backend action-item rules for overdue, upcoming, and stale sections
- Targeted UI polish: restore app shell layout constraints, sticky sidebar behavior, page centering, and horizontal overflow protections
- Documentation refresh: update docs for recent workflow, dashboard, and UI changes

## Near-Term Future Work

These are realistic polish and presentation steps, not current product claims:

- Demo data and screenshots
- Public presentation pass for README, screenshots, and walkthrough flow
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
