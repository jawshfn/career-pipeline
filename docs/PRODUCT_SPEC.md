# Product Spec

## Product Vision

Career Pipeline is a job-search command center that helps applicants capture opportunities quickly, track applications consistently, manage follow-ups, and understand which sources and resume strategies are producing progress.

The product should feel like a practical daily workspace, not a data-entry chore. Add Job stays lightweight, while richer details, risk tracking, follow-up actions, and metrics live in focused views.

## Problem Statement

Job seekers often apply across many platforms and conversations at once. Important details get scattered across browser tabs, email, spreadsheets, job boards, recruiter calls, and notes apps. As volume grows, users lose track of application status, follow-up timing, resume variants, next actions, warning signs, and which sources are actually creating momentum.

Career Pipeline centralizes that activity into a simple workflow that supports fast capture first and structured tracking second.

## Target Users

- New graduates applying to a high volume of roles
- Early-career applicants managing multiple job boards and referrals
- Career switchers tailoring resumes for different role types
- Job seekers who need lightweight organization without enterprise recruiting software

## Core User Pain Points

- Capturing a job opportunity takes too long when the user is in the middle of applying.
- Application statuses are hard to remember once there are many opportunities.
- Follow-up dates and next actions are easy to miss.
- Users forget which resume version they submitted.
- Company, recruiter, and role notes are scattered.
- Questionable postings are hard to compare or flag consistently.
- Users lack simple visibility into which sources and resume versions produce interviews, offers, or closed outcomes.

## Product Principles

- Quick-capture first: the main workflow should not start as a giant manual form.
- Capture now, enrich later: users should be able to save partial information and improve it later.
- Action-focused Reminders: daily attention items should be visible and quick to act on.
- Summary-focused Dashboard: metrics should explain activity and progress without becoming heavy analytics.
- Local-first early prototype: the backend should work well as a local development app with SQLite.
- Transparent status tracking: application states should be clear and easy to update.
- Public-repo appropriate: documentation should focus on product, architecture, and development, not private strategy or personal examples.

## Current Implemented Scope

The current prototype includes:

- Static GitHub Pages demo mode with fictional in-memory data that resets on refresh
- Dedicated Add Job page for lightweight opportunity capture
- Add Job modes for Manual Entry, Paste Job Link, and Paste Job Text
- Provider-neutral link-only review for valid public job links that do not support import
- Direct hosted Greenhouse import through the official Greenhouse Job Board API
- Direct canonical Lever import through the public Lever Postings API
- Best-effort custom Greenhouse board discovery using SSRF-protected bounded public HTML verification
- Experimental local click-initiated Greenhouse detection and browser-to-local-app versioned fragment bridge
- Experimental local click-initiated Indeed text capture with one-time in-memory local transfer into Paste Job Text
- Experimental local click-initiated LinkedIn bounded text capture for search-results current-job panels and standalone job pages
- Short-lived consume-once local browser-capture transfers that always open an editable review before explicit save
- Editable imported reviews with no automatic save
- Deterministic Smart Capture helpers that prepare conservative editable suggested fields from pasted job text before save
- Internal Smart Capture parser-format detection for common LinkedIn, Indeed, ZipRecruiter, and generic pasted text while preserving the user's selected Source
- Smart Capture review guardrails that summarize best-match parser, captured fields, and what remains user-controlled before save
- Advisory duplicate and similar-opportunity warnings in Manual Entry and Smart Capture review
- Application create, list, update, detail editing, and archive behavior
- Applications page with Active, Closed, and All views plus search, filters, sorting, opportunity-focused table rows, Notes shortcut, and detail access
- Application Detail tabs for Overview, Follow-up, Job Details, Job Posting, Resume & Prep, Red Flags, and Activity
- Read-only Application Detail Overview command snapshot with contextual helpful next-step shortcuts into focused editing tabs
- Optional Next Action field shown in Application Detail and Reminders cards
- Applied-date behavior that distinguishes saved date from the date the user actually applied
- Responsive grouped Status Board with status filtering, company/role search, and persisted status updates
- Reminders with overdue follow-ups, upcoming follow-ups due within 3 days, secondary Needs check-in items, and follow-up quick actions
- Backend-derived Reminders action-item rules from `/api/applications/action-items`
- Follow-up quick actions for Snooze 3 days, Snooze 1 week, and Clear follow-up
- Activity Timeline entries for manual activity, follow-up quick-action outcomes, and backend-logged status changes
- No-op snooze prevention when a snooze action would not move the follow-up date later
- Resumes page for creating, editing, deactivating, reactivating, and assigning reusable resume variants
- Application-scoped contact and prep notes in Application Detail
- Red-flag checklist and notes in Application Detail, with compact indicators in Applications and Status Board
- Backend-derived Dashboard summary cards plus expandable Application Status, Sources, Red Flags, Source Results, and Resume Results sections
- Sticky responsive app shell with page content centered inside the main content area and no intended page-level horizontal overflow
- Archive behavior that stores `Archived` status while hiding archived records from normal active workflow views

## Non-Goals for Current Prototype

- Chrome Web Store distribution or production browser-companion deployment
- Generic browsing monitoring or generic job-board scraping
- Automatic application submission
- Support for every ATS provider
- Email inbox integration
- Calendar integration
- Authentication or multi-user accounts
- Cloud-hosted production deployment
- AI-generated resumes, scoring, or recommendations
- Full contact-management CRM
- Import/export workflows
- Private business strategy, monetization plans, or competitor analysis

## Core Workflows

### Add a Job

The user can choose the capture method that fits the moment:

1. Use Browser Capture when already viewing a supported Greenhouse, Indeed, or LinkedIn job in the local app workflow.
2. Use Paste Job Link for supported structured links or an editable link-only review.
3. Use Paste Job Text as the broad deterministic fallback for copied text and unsupported layouts.
4. Use Manual Entry for lightweight basic capture.

Browser Capture is a transport into the existing editable review, not a new persistence model. It remains unavailable in the reset-on-refresh GitHub Pages demo.

Manual Entry fields include:

- Company
- Role title
- Job link
- Source
- Current status
- Resume version, optional
- Applied date, optional
- Follow-up date, optional
- Notes, optional

Follow-up presets help schedule common dates quickly. If the user selects Applied or a later status and Applied Date is empty, the frontend can default Applied Date to today. Existing manually entered applied dates are not overwritten.

Paste Job Link provides a provider-neutral review path for valid public links. Supported hosted Greenhouse links import structured job data directly through the official Greenhouse Job Board API. Canonical hosted Lever links import one posting through Lever's public Postings API, while retaining the user's original Job Link and selected Source; Company stays editable and requires review because the provider does not expose a dependable display name. Custom employer career links with one explicit `gh_jid` can use best-effort server-side board discovery from strong structural evidence; failed or unsupported links retain link-only and Paste Job Text fallbacks. The optional local browser helper can hand a verified Greenhouse board and job ID from a clicked employer page to this mode. Every path opens an editable review before save.

Paste Job Text is the deterministic paste-review fallback. The user pastes a job post, recruiter message, or copied listing text, optionally adds an explicit job link, selects a source, then prepares a review form. Rule-based suggestions prioritize high-confidence fields such as role title, company name, location hint, obvious header-level compensation, employment type, and an editable Job Posting Snapshot containing the relevant pasted text. Personal Notes remain separate and user-authored. The parser can internally recognize common LinkedIn, Indeed, ZipRecruiter, or generic paste formats to improve extraction quality, but it does not change the saved Source. Job link also stays user-controlled and is not guessed from arbitrary pasted URLs. Explicit user-entered bare domains can be normalized to `https://` for safe opening. Company career pages can still be pasted, but they are best-effort and should be reviewed carefully before saving. AI-assisted extraction is not implemented.

Add Job and Smart Capture Review can show advisory duplicate warnings before saving. These warnings are deterministic and do not block save. Same normalized job links are treated as likely duplicates. Same or similar company, role, and location are also likely duplicates. Same or similar company and role with missing or different location are shown as similar opportunities. Archived applications are ignored for these warnings.

After saving, the application appears in Applications, Status Board, Dashboard metrics, and other relevant views. The user can open Application Detail later to add richer information.

### Manage Applications

The Applications page is focused on finding and managing existing opportunities.

Current controls include:

- Active, Closed, and All view filters
- Search across company, role, source, location, and full notes text
- Filters for status, source, resume version, and red-flag state
- Sorting by recently updated, saved date, follow-up date, company, and status
- Opportunity-focused table columns for opportunity, status, follow-up urgency, resume assignment, red flags, Notes shortcut, and actions

The table avoids showing raw pasted notes as long previews. Applications with notes show a compact Notes badge that opens the Job Details tab, while full notes remain readable and editable in Application Detail.

### Edit Application Detail

Application Detail is a tabbed panel opened from Applications.

Current tabs:

- Overview
- Follow-up
- Job Details
- Job Posting
- Resume & Prep
- Red Flags
- Activity

Overview is a read-only command snapshot with compact opportunity context, read-only Added to tracker metadata, and contextual helpful next-step shortcuts into the focused editing tabs. When nothing needs attention, it shows a calm organized state instead of duplicating the main tab navigation. The compact summary strip appears below the tab buttons on non-Overview Application Detail tabs so navigation stays stable.

Editable areas include company name, role title, job link, source, status, resume version, applied date, follow-up date, next action, prep notes, location, compensation, employment type, Job Posting Snapshot, Personal Notes, red flags, and red-flag notes.

Status appears in the compact summary strip on focused edit tabs. Applied date, follow-up date, and next action live in Follow-up. Saved date is read-only Added to tracker metadata in Overview. Company, role, source, job link, location, compensation, employment type, and Personal Notes live in Job Details. Job Posting is a reading-first editable snapshot that remains optional and may be added later. Resume version and prep notes live in Resume & Prep. Existing notes are not automatically migrated into Job Posting Snapshot.

`date_saved` means the date the job was added to Career Pipeline. `date_applied` means the date the user actually submitted the application. Changing status to Applied or later can default an empty Applied Date, but existing Applied Date values are not automatically overwritten or cleared.

The Resume & Prep tab stores resume assignment and preparation notes. Prep notes can include recruiter context, assessment details, talking points, or questions to ask without becoming a shared contacts table or full CRM.

The Activity tab supports dated activity entries with activity type and note. Activity entries are saved independently from the main detail form. Meaningful status changes are also logged by the backend as `Status Change` activity entries.

### Track an Application Through the Status Board

The user updates status as an opportunity moves through the process. Status Board is the fastest place to review grouped opportunities and move them between stages.

Stored statuses:

- Saved
- Applied
- Assessment
- Recruiter Screen
- Interview
- Offer
- Rejected
- Withdrawn
- Archived

Archived is stored for archived records but is not an active status-board stage. Active Status Board views show non-archived applications and preserve Rejected and Withdrawn as closed outcomes.

Follow-up due is not a status-board status. It is a computed action state based on `follow_up_date`, such as overdue, upcoming, or not scheduled.

### Review Reminders

Reminders answers "what needs my attention today?"

It shows:

- Overdue follow-ups
- Upcoming follow-ups due today through the next 3 days
- Needs check-in items for active applications without a follow-up and without a recent update

These action-item sections come from the backend `/api/applications/action-items` endpoint so follow-up and Needs check-in rules stay consistent across the app.

Cards show enough context to act quickly, including company, role, status, follow-up date, and Next Action when present.

Follow-up quick actions:

- Snooze 3 days
- Snooze 1 week
- Clear follow-up

Snooze actions only appear or run when they would move the follow-up date later than the current follow-up date. Valid quick actions update the application and log an Activity Timeline entry. Clear follow-up remains available whenever a follow-up date exists.

### Manage Resumes

Resumes supports reusable resume variants for different roles or application strategies.

Users can:

- Create a resume version
- Edit name, target role, description, and active state
- Deactivate and reactivate versions
- Include inactive versions in the list
- Assign active resume versions from Add Job and Application Detail

Dashboard usage and effectiveness sections help show how assigned resume versions connect to application progress.

### Flag Questionable Postings

Red flags are user-managed caution tags, not automated scoring.

Current red-flag fields include:

- Vague job description
- Unrealistic pay or benefits
- Payment or check/deposit request
- Suspicious contact method
- Company identity mismatch
- Too-good-to-be-true claims
- Red-flag notes

Applications and Status Board show compact indicators when flags exist. Normal applications without flags remain visually quiet.

### Review Dashboard Insights

The Dashboard provides summary-focused metrics from the backend `/api/dashboard/summary` endpoint. Summary metric cards stay visible, while detailed breakdowns and results live in expandable sections for cleaner scanning.

Current sections include:

- Summary metric cards for total, active, closed, follow-ups, and red-flagged applications
- Application Status
- Sources
- Red Flags
- Source Results, showing applications, active count, interviews, offers, and closed count by source
- Resume Results, showing applications, active count, interviews, offers, closed count, and assignment coverage by resume version

Archived applications are excluded from normal dashboard metrics.

## Success Criteria for Current Prototype

- A user can add a job opportunity in under a minute.
- A supported Greenhouse opportunity can reach an editable review without retyping its structured job details.
- A supported Greenhouse, Indeed, or LinkedIn job can reach an editable review without manually retyping its core posting details.
- A user can track at least 25 applications without losing important context.
- A user can distinguish active opportunities from closed outcomes.
- A user can identify overdue follow-ups and upcoming follow-ups due within 3 days.
- A user can snooze or clear follow-ups directly from Reminders without creating no-op activity logs.
- A user can record next actions and activity timeline entries.
- A user can assign resume versions and review usage/effectiveness patterns.
- A user can flag suspicious or concerning postings without automated scoring.
- The app remains readable at normal full-screen and half-screen desktop widths.
