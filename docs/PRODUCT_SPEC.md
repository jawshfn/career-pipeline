# Product Spec

## Product Vision

Career Pipeline is a job-search command center that helps applicants capture opportunities quickly, track applications consistently, manage follow-ups, and understand which sources and resume strategies are producing progress.

The product should feel like a practical daily workspace, not a data-entry chore. Quick Add stays lightweight, while richer details, risk tracking, follow-up actions, and metrics live in focused views.

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

- Quick-add first: the main workflow should not start as a giant manual form.
- Capture now, enrich later: users should be able to save partial information and improve it later.
- Action-focused Command Center: daily attention items should be visible and quick to act on.
- Summary-focused Dashboard: metrics should explain activity and progress without becoming heavy analytics.
- Local-first early prototype: the backend should work well as a local development app with SQLite.
- Transparent status tracking: pipeline states should be clear and easy to update.
- Public-repo appropriate: documentation should focus on product, architecture, and development, not private strategy or personal examples.

## Current Implemented Scope

The current prototype includes:

- Dedicated Quick Add page for lightweight opportunity capture
- Quick Add modes for Manual Entry and Smart Capture paste-review
- Deterministic Smart Capture helpers that prepare conservative editable suggested fields from pasted job text before save
- Internal Smart Capture parser-format detection for common LinkedIn, Indeed, ZipRecruiter, and generic pasted text while preserving the user's selected Source
- Smart Capture review guardrails that summarize best-match parser, captured fields, and what remains user-controlled before save
- Application create, list, update, detail editing, and archive behavior
- Applications page with Active, Closed, and All views plus search, filters, sorting, opportunity-focused table rows, Notes shortcut, and detail access
- Application Detail tabs for Overview, Status & Follow-up, Job Details, Contact & Prep, Red Flags, and Activity
- Read-only Application Detail Overview command snapshot with contextual Needs attention shortcuts into focused editing tabs
- Optional Next Action field shown in Application Detail and Command Center cards
- Applied-date behavior that distinguishes saved date from the date the user actually applied
- Responsive grouped Pipeline with status filtering and persisted status updates
- Daily Command Center with overdue follow-ups, upcoming follow-ups due within 3 days, stale active applications, and follow-up quick actions
- Backend-derived Command Center action-item rules from `/api/applications/action-items`
- Follow-up quick actions for Snooze 3 days, Snooze 1 week, and Clear follow-up
- Activity Timeline entries for manual activity, follow-up quick-action outcomes, and backend-logged status changes
- No-op snooze prevention when a snooze action would not move the follow-up date later
- Resume Versions page for creating, editing, deactivating, reactivating, and assigning reusable resume variants
- Application-scoped contact and prep notes in Application Detail
- Red-flag checklist and notes in Application Detail, with compact indicators in Applications and Pipeline
- Backend-derived Dashboard summary cards, status breakdown, source breakdown, resume-version usage, red-flag snapshot, Source Effectiveness, and Resume Version Effectiveness
- Sticky responsive app shell with page content centered inside the main content area and no intended page-level horizontal overflow
- Archive behavior that stores `Archived` status while hiding archived records from normal active workflow views

## Non-Goals for Current Prototype

- Browser extensions
- Automated scraping from job boards
- Email inbox integration
- Calendar integration
- Authentication or multi-user accounts
- Cloud-hosted production deployment
- AI-generated resumes, scoring, or recommendations
- Full contact-management CRM
- Import/export workflows
- Private business strategy, monetization plans, or competitor analysis

## Core Workflows

### Quick Add an Application

The user opens Quick Add and either enters the minimum needed manually or pastes job text into Smart Capture.

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

Smart Capture is an additional paste-review workflow. The user pastes a job post, recruiter message, or copied listing text, optionally adds an explicit job link, selects a source, then prepares a review form. Rule-based suggestions prioritize high-confidence fields such as role title, company name, location hint, obvious header-level compensation, employment type, and notes containing the relevant pasted text. The parser can internally recognize common LinkedIn, Indeed, ZipRecruiter, or generic paste formats to improve extraction quality, but it does not change the saved Source. Job link also stays user-controlled and is not guessed from arbitrary pasted URLs. A compact review guardrails panel summarizes the best-match parser, captured-field status, and Source/Job link reminders before saving. Company career pages can still be pasted, but they are best-effort and should be reviewed carefully before saving. AI-assisted extraction is not implemented yet.

After saving, the application appears in Applications, Pipeline, Dashboard metrics, and other relevant views. The user can open Application Detail later to add richer information.

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
- Status & Follow-up
- Job Details
- Contact & Prep
- Red Flags
- Activity

Overview is a read-only command snapshot with compact opportunity context and contextual Needs attention shortcuts into the focused editing tabs. When nothing needs attention, it shows a calm organized state instead of duplicating the main tab navigation.

Editable areas include company name, role title, job link, source, status, resume version, saved date, applied date, follow-up date, next action, contact name, contact info, prep notes, location, compensation, salary range, employment type, notes, red flags, and red-flag notes.

Status, applied date, follow-up date, and next action live in Status & Follow-up. Company, role, source, job link, location, compensation, employment type, and notes live in Job Details. Resume version lives in Contact & Prep with contact and preparation context.

`date_saved` means the date the job was added to Career Pipeline. `date_applied` means the date the user actually submitted the application. Changing status to Applied or later can default an empty Applied Date, but existing Applied Date values are not automatically overwritten or cleared.

The Contact & Prep tab stores application-scoped contact context and preparation notes. It is intentionally not a shared contacts table or full CRM.

The Activity tab supports dated activity entries with activity type and note. Activity entries are saved independently from the main detail form. Meaningful status changes are also logged by the backend as `Status Change` activity entries.

### Track an Application Through the Pipeline

The user updates status as an opportunity moves through the process.

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

Archived is stored for archived records but is not an active pipeline stage. Active pipeline views show non-archived applications and preserve Rejected and Withdrawn as closed outcomes.

Follow-up due is not a pipeline status. It is a computed action state based on `follow_up_date`, such as overdue, upcoming, or not scheduled.

### Review Follow-Ups Due

The Command Center answers "what needs my attention today?"

It shows:

- Overdue follow-ups
- Upcoming follow-ups due today through the next 3 days
- Stale active applications without a follow-up and without a recent update

These action-item sections come from the backend `/api/applications/action-items` endpoint so follow-up and stale-application rules stay consistent across the app.

Cards show enough context to act quickly, including company, role, source, status, follow-up date, and Next Action when present.

Follow-up quick actions:

- Snooze 3 days
- Snooze 1 week
- Clear follow-up

Snooze actions only appear or run when they would move the follow-up date later than the current follow-up date. Valid quick actions update the application and log an Activity Timeline entry. Clear follow-up remains available whenever a follow-up date exists.

### Manage Resume Versions

Resume Versions supports reusable resume variants for different roles or application strategies.

Users can:

- Create a resume version
- Edit name, target role, description, and active state
- Deactivate and reactivate versions
- Include inactive versions in the list
- Assign active resume versions from Quick Add and Application Detail

Dashboard usage and effectiveness sections help show how assigned resume versions connect to application progress.

### Flag Questionable Postings

Red flags are user-managed caution tags, not automated scoring.

Current red-flag fields include:

- Vague job description
- Unrealistic salary
- Asks for payment
- Suspicious contact
- Company mismatch
- Too good to be true
- Red-flag notes

Applications and Pipeline show compact indicators when flags exist. Normal applications without flags remain visually quiet.

### Review Dashboard Insights

The Dashboard provides summary-focused metrics from the backend `/api/dashboard/summary` endpoint.

Current sections include:

- Summary metric cards for active applications, follow-ups, red-flagged applications, interviews, and offers
- Status breakdown
- Source breakdown
- Resume-version usage
- Red flag snapshot
- Source Effectiveness, showing applications, active count, interviews, offers, and closed count by source
- Resume Version Effectiveness, showing applications, active count, interviews, offers, and closed count by resume version

Archived applications are excluded from normal dashboard metrics.

## Success Criteria for Current Prototype

- A user can add a job opportunity in under a minute.
- A user can track at least 25 applications without losing important context.
- A user can distinguish active opportunities from closed outcomes.
- A user can identify overdue follow-ups and upcoming follow-ups due within 3 days.
- A user can snooze or clear follow-ups directly from Command Center without creating no-op activity logs.
- A user can record next actions and activity timeline entries.
- A user can assign resume versions and review usage/effectiveness patterns.
- A user can flag suspicious or concerning postings without automated scoring.
- The app remains readable at normal full-screen and half-screen desktop widths.
