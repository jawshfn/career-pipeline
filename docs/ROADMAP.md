# Roadmap

This roadmap is intentionally product-first and conservative. The goal is to build a usable prototype in small increments without overcommitting to advanced integrations before the core workflow works.

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
- Add application configuration for local development
- Add health endpoint
- Add initial pytest setup
- Add basic GitHub Actions test workflow

## Phase 1.5: CI Foundation

Status: complete

- Add GitHub Actions backend test automation
- Add frontend build automation after the React scaffold exists
- Keep CI focused on backend pytest and frontend production build

## Phase 2: Quick-Add and Applications Table

Status: complete

- Implement application create, read, update, list, and archive behavior
- Support quick-add required fields
- Build applications table UI
- Add filtering by status, source, and follow-up state
- Add basic backend tests for application workflows

## Phase 3: Pipeline Board

Status: complete

- Define status transitions
- Add status update endpoint
- Build visual pipeline board
- Allow moving an application between statuses
- Keep status changes persisted through the existing application update flow

## Phase 3.5: Frontend Workflow Polish

Status: complete

- Improve navigation clarity between Applications and Pipeline
- Keep Applications and Pipeline state reasonably consistent
- Improve status update loading and error states
- Add manual QA checklist
- Update project documentation for current state

## Phase 4: Follow-Up Queue / Daily Command Center

Status: complete

- Add follow-up date filtering
- Build rule-based Daily Command Center
- Surface overdue follow-ups and follow-ups due today
- Surface stale active applications without adding "Follow-up due" as a status

Later follow-up enhancements:

- Add mark-complete and reschedule behavior
- Add richer daily summary metrics after dashboard work begins

## Phase 5: Resume Versions

Status: next

- Add resume version records
- Assign resume versions to applications
- Show resume version on application detail and table views
- Add resume version management page

## Phase 6: Red-Flag System

- Add red flag catalog
- Add application-to-red-flag assignment
- Build checklist UI on application detail
- Add red-flag filtering in table and dashboard

## Phase 7: Dashboard Metrics and Insights

- Add dashboard summary endpoint
- Show counts by status and source
- Show response-oriented metrics
- Show due follow-ups and red-flagged applications
- Keep metrics explanatory and simple

## Phase 8: Testing, CI, Demo Data, Screenshots, and Polish

- Expand pytest coverage for core backend behavior
- Add frontend smoke tests when frontend structure exists
- Maintain GitHub Actions CI
- Add demo data for screenshots and local exploration
- Add screenshots to README
- Review documentation for accuracy against the implemented app

## Later Possible Enhancements

These are possible directions, not committed scope:

- Browser extension for capturing jobs from job boards
- Email or calendar reminders
- Import and export workflows
- Resume file upload and preview
- Company and recruiter contact management
- More advanced analytics
- Optional cloud deployment
- Authentication and multi-device sync
- Job-board-specific capture helpers
