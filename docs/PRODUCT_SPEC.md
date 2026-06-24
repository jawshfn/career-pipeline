# Product Spec

## Product Vision

Career Pipeline is a job-search command center that helps applicants capture opportunities quickly, track applications consistently, manage follow-ups, and understand which sources and actions are producing responses.

The product should feel like a practical daily workspace, not a data-entry chore. The first experience should be quick-add oriented, with richer organization available after an opportunity has been captured.

## Problem Statement

Job seekers often apply across many platforms and conversations at once. Important details get scattered across browser tabs, email, spreadsheets, job boards, recruiter calls, and notes apps. As volume grows, users lose track of application status, follow-up timing, resume variants, recruiter details, and warning signs in questionable postings.

Career Pipeline aims to centralize that activity into a simple, trustworthy workflow that supports fast capture first and structured tracking second.

## Target Users

- New graduates applying to a high volume of roles
- Early-career applicants managing multiple job boards and referrals
- Career switchers tailoring resumes for different role types
- Job seekers who need lightweight organization without enterprise recruiting software

## Core User Pain Points

- Capturing a job opportunity takes too long when the user is in the middle of applying.
- Application statuses are hard to remember once there are many active opportunities.
- Follow-up dates are easy to miss.
- Users forget which resume version they submitted.
- Company, recruiter, and role notes are scattered.
- Questionable postings are hard to compare or flag consistently.
- Users lack simple visibility into which sources produce replies.

## Product Principles

- Quick-add first: the main workflow should not start as a giant manual form.
- Capture now, enrich later: users should be able to save partial information and improve it later.
- Local-first early prototype: the initial backend should work well as a local development app with SQLite.
- Transparent status tracking: pipeline states should be clear and easy to update.
- Practical over comprehensive: v0.1 should support a real job-search workflow without trying to cover every recruiting edge case.
- Public-repo appropriate: documentation should focus on product, architecture, and development, not private strategy or personal examples.

## MVP Scope

The v0.1 MVP should include:

- Create, view, update, and archive job applications
- Quick-add form with only essential fields
- Applications table with basic filtering and sorting
- Pipeline statuses for tracking progress
- Follow-up dates and a due follow-up queue based on computed follow-up state
- Resume version records and assignment to applications
- Red-flag tags assignable to applications
- Application event history for meaningful changes
- Basic dashboard summary by status, source, and follow-up state

## Non-Goals for v0.1

- Browser extensions
- Automated scraping from job boards
- Email inbox integration
- Calendar integration
- Authentication or multi-user accounts
- Cloud-hosted backend
- AI-generated resumes or cover letters
- Private business strategy, monetization plans, or competitor analysis
- Highly customized workflow automation

## Core Workflows

### Quick Add an Application

The user sees a compact quick-add form and enters the minimum needed to avoid losing the opportunity.

Minimum useful fields:

- Company
- Role title
- Source
- Job URL
- Current status
- Follow-up date, optional
- Notes, optional

After saving, the application appears in the applications table and pipeline board. The user can open the detail page later to add resume version, red flags, recruiter notes, or timeline details.

### Track an Application Through the Pipeline

The user updates the status as an opportunity moves through the process.

Planned statuses:

- Saved
- Applied
- Assessment
- Recruiter Screen
- Interview
- Offer
- Rejected
- Withdrawn
- Archived

Each status update should create an application event so the timeline remains useful.

Follow-up due is not a pipeline status. It is a computed action state based on follow_up_date, such as due today, overdue, upcoming, or not scheduled.

### Review Follow-Ups Due

The user opens the daily command center and sees applications with follow-ups due today or overdue. Each item should show enough context to act quickly: company, role, source, status, due date, and latest note.

The user can mark a follow-up complete, reschedule it, or open the application detail page.

### Assign Resume Versions

The user creates named resume versions and assigns one to an application. This helps answer: "Which resume did I send for this role?"

Resume versions should be simple in v0.1: name, target role or focus, notes, and optional file reference.

### Flag Questionable Postings

The user can apply red-flag tags to applications when something looks suspicious or low quality.

Example red flags:

- Vague company details
- Unclear compensation
- Suspicious contact method
- Requires payment or equipment purchase
- Inconsistent job description
- Too-good-to-be-true offer language

Red flags should help the user notice risk patterns without making automated claims about legitimacy.

### Review Dashboard Insights

The dashboard should answer practical questions:

- How many applications are active?
- Which follow-ups are due or overdue?
- Which sources are generating responses?
- How many applications are in each status?
- Which applications have red flags?

## Success Criteria for v0.1

- A user can add a job opportunity in under a minute.
- A user can track at least 25 applications without losing important context.
- A user can identify follow-ups due today or overdue.
- A user can assign a resume version to each application.
- A user can flag suspicious or questionable postings.
- A user can see basic response and source insights.
- The app remains simple enough that quick capture is still the primary workflow.
