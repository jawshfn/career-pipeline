# Roadmap

PursuitHQ is built in small, product-first increments. The roadmap below records completed work and keeps future work realistic for the current local-first prototype.

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

Status: complete through Phase 13.3

- Phase 13.0 — Add safe local-only fictional demo data seeding.
- Phase 13.1a — Simplify Manual Entry in Add Job.
- Phase 13.1b — Simplify Smart Capture Review.
- Phase 13.1c — Simplify Applications filters.
- Phase 13.1d — Simplify sidebar navigation labels.
- Phase 13.1e — Simplify Application Detail tabs and summary-strip layout.
- Phase 13.1f — Simplify Reminders cards and exclude closed outcomes from follow-up reminders.
- Phase 13.1g — Polish Dashboard layout and public documentation wording.
- Phase 13.1h — Reframe Status Board with search, clearer filters, and adaptive compact tiles.

- Phase 13.2 — Add a static GitHub Pages demo mode with fictional frontend data while preserving the local FastAPI/SQLite app.
- Phase 13.3 — Add Smart Capture help documentation for Paste Job Text usage.

## Phase 14 — Presentation Polish

Status: complete through Phase 14.3

- Phase 14.1 — Clarify Applications table dates and edit actions.
- Phase 14.2 — Refresh Dashboard summary metrics and add a Status Board CTA.
- Phase 14.3 — Clarify red flag checklist labels and add Support page for Smart Capture reports.

## Phase 15 — Capture Engine And Greenhouse Capture

Status: complete through Phase 15.4b

- Phase 15.0 — Add the shared Capture Engine contract and adapter foundation.
- Phase 15.1 — Add and refine deterministic Google Jobs capture integration.
- Phase 15.2 — Add direct hosted Greenhouse job import and correct compensation mapping.
- Phase 15.3a — Add provider-neutral job-link fallback and bounded safe-public-HTML foundations.
- Phase 15.3b — Add best-effort custom Greenhouse board discovery.
- Phase 15.3c — Simplify custom discovery to strong structural evidence.
- Phase 15.3d — Align frontend and backend Greenhouse hostname routing.
- Phase 15.4a — Add and validate the click-initiated Greenhouse browser-detection prototype.
- Phase 15.4b — Add the local browser-to-PursuitHQ capture bridge.

## Phase 16 - Additional Structured Job Providers

Status: complete through Phase 16.0

- Phase 16.0 - Add automatic global and EU Lever job-link import through the public Postings API.

## Phase 17 - Browser-Assisted Capture

Status: complete through Phase 17.2

- Phase 17.0 - Add user-initiated Indeed job extraction and one-time local transfer into an editable Paste Job Text review.
- Phase 17.1 - Add and stabilize bounded LinkedIn capture for search-results current-job panels and standalone job pages.
- Phase 17.2 - Reposition Browser Capture as the preferred local workflow and transform Support into a broader Help & Feedback experience.

## Phase 18 — Job Posting Snapshot

Status: complete through Phase 18.1

- Phase 18.0 — Separate captured posting content from Personal Notes with a dedicated editable Job Posting tab and end-to-end capture integration.
- Phase 18.1 — Simplify application compensation tracking to one flexible compensation field and retire redundant numeric salary minimum/maximum fields.

## Phase 19 — ZipRecruiter Browser Capture

Status: complete through Phase 19.0

- Phase 19.0 — Add and stabilize bounded signed-in ZipRecruiter selected-job capture with editable review, compensation and employment metadata, rated posting support, and advertised-title preservation.

## Phase 20 — Product Identity

Status: complete through Phase 20.9b

- Phase 20.0 — Adopt PursuitHQ across public-facing product surfaces while preserving current repository and deployment paths.
- Phase 20.1 — Establish the PursuitHQ visual system across shared colors, surfaces, navigation, controls, and typography.
- Phase 20.2 — Polish the Add Job experience across Manual Entry, Paste Job Link, and Paste Job Text, and prevent discarded browser captures from reappearing after mode changes.
- Phase 20.3 — Refine the Reminders page with independently sized follow-up sections, clearer urgency hierarchy, and polished reminder actions.
- Phase 20.4 — Refine Dashboard metric layouts, workflow guidance, breakdown panels, and source/resume results across desktop and mobile.
- Phase 20.5 — Refine the Applications list, filters, table hierarchy, and responsive application cards.
- Phase 20.6a — Refine the Application Detail identity, tab selector, current state summary, and Overview hierarchy.
- Phase 20.6b — Refine the Application Detail Follow-up date layout and multiline next-action workflow.
- Phase 20.6c — Refine Job Details grouping and compact auto-growing Personal Notes.
- Phase 20.6d — Replace the inline Job Posting editor with a compact preview and draft-based modal workflow.
- Phase 20.6e — Refine Resume & Prep with compact auto-growing preparation notes.
- Phase 20.6f — Refine the Red Flags checklist layout, selected states, and compact auto-growing notes.
- Phase 20.6g — Refine the Activity composer responsiveness, auto-growing note, and timeline date presentation.
- Phase 20.6h — Complete Application Detail consistency with an auto-growing Next Action field and unified tab-panel surfaces.
- Phase 20.7a — Status Board card actions and visual consistency
- Phase 20.7b — Status Board workflow filters
- Phase 20.8a — Refine the Resume Library layout, creation and editing workflows, and friendly update dates.
- Phase 20.8b — Add resume duplication, assignment usage context, and protected resume-workflow switching.
- Phase 20.8c — Add safe permanent resume deletion, assignment-impact protection, and recency-based Resume Library ordering.
- Phase 20.9a — Establish a runtime-aware Help Center with common-task navigation, in-page guidance, back-to-top access, and generalized issue reporting.
- Phase 20.9b — Refine runtime-aware capture guidance, troubleshooting disclosures, privacy presentation, and responsive capture-method layouts.

## Phase 21 — Browser Capture Reliability and Coverage

Status: complete through Phase 21.2a

- Phase 21.1a — Refresh Browser Capture with PursuitHQ identity, clearer captured-job hierarchy, consistent popup states, and source-neutral fallback guidance.
- Phase 21.1b — Preserve LinkedIn role titles that resemble location values by using source-specific header context.
- Phase 21.1c — Support selected ZipRecruiter jobs across paginated search-result URLs.
- Phase 21.2a — Add bounded standalone Handshake job capture with deterministic metadata extraction and safe expansion of truncated descriptions.

## Later Optional Enhancements

- Public demo deployment improvements
- Import/export workflows
- Email or calendar reminders
- Resume file upload and preview
- Authentication and multi-device sync
- AI-assisted summaries or suggestions
- Other documented ATS integrations
- Production distribution of the browser companion only if the product reaches that stage
- Configurable browser-helper target after a hosted backend exists
