# PursuitHQ Product Specification

## Vision and problem

PursuitHQ is a local-first job-search workspace for people who want to move from a promising posting to a clear next action without losing the details that informed the decision. It replaces scattered notes and one-off spreadsheets with a reviewable workspace that stays under the user's control.

## Target users

- Individual job seekers managing an active search.
- Career changers organizing different role and resume variants.
- Recruiters and portfolio reviewers evaluating a thoughtful local-first product workflow.

## Product principles

- Capture first, then review before saving.
- Keep personal job-search data local by default.
- Make status, next actions, follow-ups, and activity easy to inspect.
- Preserve the employer posting separately from personal notes.
- Treat red flags and AI output as user-reviewed context, not automated decisions.

## Core workflows

1. **Capture a job.** Add it manually, import a supported Greenhouse or Lever link, use deterministic Paste Job Text, or begin a bounded Browser Capture handoff.
2. **Review and save.** Correct the editable draft, choose source and job link, then explicitly save it as an application.
3. **Manage the application.** Update status, dates, contact details, next action, and notes in Application Detail.
4. **Keep the posting.** Store and review a Job Posting Snapshot separately from Personal Notes.
5. **Generate an AI Brief.** From Application Detail, explicitly analyze the current approved company, role, optional job details, and snapshot. Local mode saves the latest brief; demo mode keeps it in memory until reload.
6. **Follow through.** Manage reminders with Complete, Complete and schedule next, Reschedule, or Clear; review the resulting activity history.
7. **Prepare and assess.** Assign a resume variant, add preparation notes, and record red flags.
8. **Review progress.** Use Dashboard and Status Board to inspect the current workspace.
9. **Protect the workspace.** Export JSON backups and CSV/XLSX review exports; validate and explicitly replace a local workspace from a compatible JSON backup.

## Application Detail

Application Detail is organized into **Overview**, **Follow-up**, **Job Details**, **Job Posting**, **AI Brief**, **Resume & Prep**, **Red Flags**, and **Activity**. The AI Brief is distinct from capture: it does not create or silently overwrite application fields, and reopening it does not call Google.

## Boundaries and non-goals

PursuitHQ does not provide authentication, multi-user collaboration, production backend hosting, automatic application submission, generic scraping, AI resume generation, automated candidate scoring, email/calendar integration, merge-style restore, or arbitrary spreadsheet import. The browser companion is not a generic page or selected-text collector.

## Success criteria

- A user can capture, review, and save an opportunity without an automatic write.
- A user can see what to do next and record follow-through.
- Stored posting context, resume choices, concerns, and activity remain connected to an application.
- Data remains portable through clear exports and a review-first restore flow.
- Privacy boundaries and current limitations are understandable before use.
