# PursuitHQ Roadmap

This roadmap summarizes PursuitHQ's completed product evolution, its current status, the next planned engineering work, and longer-term possibilities. It is a development roadmap rather than a release changelog.

## Current product status

PursuitHQ is a mature local-first product prototype: a React/Vite frontend, FastAPI/SQLAlchemy backend, and SQLite workspace. It includes a public fictional-data demo, optional Browser Capture companion, JSON backup with replace restore, CSV and XLSX exports, persisted Job Intelligence Briefs, and a Cloudflare Worker AI gateway. Outcome Insights now reports confirmed historical progression by source and resume version.

It is not a production SaaS platform: workspace data remains local, there is no authentication or synchronization, and Browser Capture supports only documented layouts.

## Development journey overview

| Phase range | Focus                                               | Result                                                                                                                                             |
| ----------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–4        | Product foundation and MVP                          | A local-first job-search workspace with a usable application pipeline.                                                                             |
| 5–9        | Daily workflow and application detail               | Follow-ups, resumes, red-flag review, dashboarding, and capture review became connected workflows.                                                 |
| 10–15      | Capture, demo, and reliability                      | Detail refinement, demo readiness, capture quality, and structured Greenhouse support strengthened everyday use.                                   |
| 16–20      | Product identity and interface completion           | More capture providers, Browser Capture, posting context, and the PursuitHQ identity clarified the product.                                        |
| 21–24      | Browser Capture, record management, and portability | Bounded capture coverage, safer record management, exports, backup/restore, and reminders matured.                                                 |
| 25–26      | AI Job Intelligence and persistence                 | A privacy-bounded, user-initiated Brief moved from gateway integration to a persisted local lifecycle.                                             |
| 27          | Trusted Outcome Insights                            | Confirmed-history reporting added transparent, drill-down outcome comparisons.                                                                     |
| 28          | Repository audit and maintainability cleanup        | Removed verified remnants and consolidated active domain, demo read-model, and cached-resource responsibilities without changing product behavior. |
| 30          | First-run onboarding and guided setup               | Added local starting guidance, actionable recovery states, a seeded-demo evaluation path, and accessible reversible guidance. |
| 29          | Flexible spreadsheet import and Data workspace      | Completed reviewed CSV/XLSX import, templates, duplicate integrity, long Job Links, and stabilization.                                             |

## Phase 0 — Product Planning

Defined the product specification, roadmap, local-first data model, API direction, wireframes, and development workflow for a job-search workspace.

## Phase 1 — Backend And CI Foundation

Established the FastAPI, SQLAlchemy, and SQLite foundation alongside the first API tests and build verification.

## Phase 2 — Application Capture And List

Implemented application CRUD and the initial React/Vite application list so opportunities could be captured and reviewed in one workspace.

## Phase 3 — Status Workflow

Added the pipeline/status workflow and early status-board behavior for moving applications through an active search.

## Phase 4 — Reminders Foundation

Introduced daily action items and upcoming follow-up visibility so the workspace could surface the next piece of work.

## Phase 5 — Application Detail, Resumes, And Layout Polish

Added Application Detail, reusable resume-version management, and shared layout refinement for application-specific preparation.

## Phase 6 — Red Flags

Added a structured red-flag review workflow, keeping concerns visible alongside each opportunity rather than in disconnected notes.

## Phase 7 — Dashboard, Search, Follow-Ups, And Activity

- Added dashboard summaries, search and filtering, and a current-status view of the workspace.
- Added next actions, follow-up quick actions, and an application activity timeline.
- Connected resume assignment and effectiveness-oriented workspace reporting.

## Phase 8 — Backend Source Of Truth And Visual Polish

Centralized application-domain behavior and API access, then refined the frontend around backend-derived data, status-change activity, and clearer workflow states.

## Phase 9 — Smart Capture

Introduced deterministic Paste Job Text: copied posting text becomes an editable review draft without scraping or AI extraction.

## Phase 10 — Detail And Applications Table Polish

Refined the applications table and detail workflow with duplicate warnings, job-link normalization, and clearer review states.

## Phase 11 — Application Detail Reorganization

Reorganized Application Detail into focused sections while preserving unsaved drafts and making common actions easier to find.

## Phase 12 — Capture Quality And Refactors

Hardened the capture review path with parser tests, payload normalization, explicit review guardrails, and frontend utility coverage.

## Phase 13 — Demo Readiness

Added fictional seed data and a static GitHub Pages demo mode, keeping the public experience separate from a local workspace.

## Phase 14 — Presentation Polish

Refined navigation, reminders, dashboard, Status Board, applications, and capture views through QA-driven responsive and accessibility improvements.

## Phase 15 — Capture Engine And Greenhouse Capture

Built the bounded capture engine and supported Greenhouse imports, including custom board discovery only where public structural evidence supports an import.

## Phase 16 — Additional Structured Job Providers

Added canonical Lever imports and refined Greenhouse support while retaining editable review before every save.

## Phase 17 — Browser-Assisted Capture

Added the optional locally loaded Browser Capture companion for bounded Greenhouse, Indeed, and LinkedIn handoffs; unsupported or ambiguous layouts stop rather than scrape broadly.

## Phase 18 — Job Posting Snapshot

Persisted the employer posting separately from personal notes, giving application review, capture, backup, and later AI Brief generation a durable shared context.

## Phase 19 — ZipRecruiter Browser Capture

Extended Browser Capture to a documented ZipRecruiter selected-job layout while preserving its local-only, review-before-save boundary.

## Phase 20 — Product Identity

Adopted the PursuitHQ identity and visual system, then refined navigation, Help, Status Board, Dashboard, and Application Detail presentation.

## Phase 21 — Browser Capture Reliability and Coverage

- Expanded documented Browser Capture coverage to Handshake and refined the popup and Help guidance.
- Hardened provider-specific layouts such as LinkedIn titles and paginated ZipRecruiter jobs.
- Kept provider support deliberately bounded, private, and local-only.

## Phase 22 — Application Record Management

Added permanent application deletion with related-data cleanup, custom accessible confirmations, and continued Resume Library refinement.

## Phase 23 — Data Portability And Backup

- Added CSV and frontend-generated XLSX exports for review.
- Added complete JSON workspace backup, validation preview, integrity checks, and transactional replace restore.
- Preserved compatible IDs, relationships, inactive resumes, Job Posting Snapshots, saved AI Briefs, and legacy archived records through backup workflows.

## Phase 24 — Reminder Workflow And Navigation

- Added atomic follow-up actions with conflict protection and Activity logging.
- Added a daily reminders header and reviewed reminder-management actions.
- Connected reminder cards directly to Application Detail.

## Phase 25 — AI Job Intelligence

- Added a read-only, user-initiated Job Intelligence Brief based on the approved Job Posting Snapshot.
- Defined a provider-neutral schema, a Google Gemini adapter, and a Cloudflare Worker gateway with fixed production model, prompt, and schema identifiers.
- Added rate limits, privacy boundaries, and fictional AI-ready demo examples. The gateway returns a result but does not persist workspace data.

## Phase 26 — AI Brief Persistence And Documentation Reset

Persisted each successful local Job Intelligence Brief per application, with stale detection, regeneration, source fingerprinting, and browser-local demo briefs. Refined generated-time presentation and reset the surrounding documentation around the current local-first boundary.

## Phase 27 — Trusted Outcome Insights

Implemented trusted Outcome Insights with a persistent highest confirmed stage and one-time, marker-protected historical reconciliation. Centralized status-transition safeguards distinguish Saved as not submitted, support backward-stage corrections, and preserve confirmed reach for Rejected and Withdrawn while they remain closed; a separate outcome-history correction repairs permanent historical evidence.

Insights excludes archived records and reports applications analyzed, progression beyond Applied, human response, interview stage or later, and offer received. It compares source and resume outcomes with small-sample cautions and contributor drill-downs, explains current status versus confirmed history, refreshes stale reports in the background, and keeps responsive, accessible local and demo behavior aligned. Assessment is an optional stage, not a required milestone, and the duplicate funnel panel was not retained.

## Phase 28 — Repository Audit And Maintainability Cleanup

Audited frontend, backend, static-demo, schema, test, and local/demo-parity boundaries for verified dead, obsolete, duplicated, and overly concentrated code. Removed confirmed Dashboard, Pipeline, Outcome Insights, demo, CSS, response-contract, and stale-resource remnants only when repository-wide caller evidence proved they were unused.

Consolidated active progression, status, follow-up, red-flag, and Outcome Insights definitions; extracted independently testable demo selectors; and shared Dashboard and Insights stale-resource behavior without changing product functionality. Active archive and compatibility behavior, explicit `App.jsx` mutations, language-native backend/frontend definitions, and other boundaries without clear simplification value were deliberately retained. The phase stopped before low-value framework or abstraction work.

## Phase 29 — Flexible Spreadsheet Import And Data Workspace

- Completed browser-local CSV/XLSX intake with worksheet selection, header and headerless tables, drag-and-drop, mapping confirmation, shared-value resolution, and row review.
- Added Minimal, Common, and Custom spreadsheet templates plus integrated Data tabs for import, templates, export/backup, and restore.
- Added transactional new-application batch import with exact/possible and in-batch duplicate decisions, demo parity, and Job Links through 2,048 characters.
- Stabilized parsing, export/re-import compatibility, accessibility, and responsive behavior.

## Phase 30 — First-Run Onboarding And Guided Setup

- Added local empty-workspace Add Job and Import paths plus a brief one-application follow-through guide that disappears once work is established.
- Made guidance dismissal reversible, versioned, browser-local, and separate by local and demo mode; added actionable empty states across key workflow pages.
- Kept the populated fictional demo separate from local onboarding with a seeded evaluation path through Reminders, a featured application, Status Board, Outcome Insights, Help, and Data & Import.
- Stabilized focused keyboard behavior, responsive action layouts, and local/demo persistence messaging.

## Later possibilities

- Email and calendar integrations.
- Resume file preview.
- Authentication and synchronization.
- Additional documented ATS adapters.
- Production distribution for the Browser Capture companion.
- A hosted backend if the product reaches that stage.
- Merge-style import and conflict resolution.
- Direct provider integrations, larger import batches, saved import presets, persistent import history, and more sophisticated duplicate review remain possible future work rather than commitments.
