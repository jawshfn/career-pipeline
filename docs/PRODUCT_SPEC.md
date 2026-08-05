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
4. **Manage resume versions.** Create a version, attach one PDF, preview, download, replace, or remove it, then assign that version to applications. Complete backups preserve attached PDFs through local restore.
5. **Keep the posting.** Store and review a Job Posting Snapshot separately from Personal Notes.
6. **Generate an AI Brief.** From Application Detail, explicitly analyze the current approved company, role, optional job details, and snapshot. Local mode saves the latest brief; demo mode keeps it in memory until reload.
7. **Follow through.** Manage reminders with Complete, Complete and schedule next, Reschedule, or Clear; review the resulting activity history.
8. **Prepare and assess.** Assign a resume variant, add preparation notes, and record red flags.
9. **Review progress.** Use Dashboard and Status Board for current workspace status, then use Outcome Insights to compare confirmed progression by source and resume version and inspect contributing applications.
10. **Protect the workspace.** Import reviewed CSV/XLSX application trackers locally, export JSON backups and CSV/XLSX review exports, and validate and explicitly replace a local workspace from a compatible JSON backup.

## Resume Library and files

Each resume version can have one optional PDF (PDF-only, 5 MiB maximum). The local app stores file content in SQLite while ordinary resume reads expose only metadata. Replacing a PDF keeps its application assignments connected; material changes should normally use a new resume version. Public-demo files are fictional and session-only. Current V2 complete backups are portable and include PDFs; legacy backups contain no files.

Non-goals include DOCX conversion, resume editing, OCR, text extraction, AI critique or tailoring, multiple files per version, revision history, and public sharing links.

## Data workspace

The **Data & Import** page has four sections: **Import applications**, **Templates**, **Export & backup**, and **Restore workspace**. Import is a five-step, review-first workflow: upload a CSV or XLSX file; choose an XLSX worksheet and table structure (including headerless data); map columns; review rows; and import approved rows.

Company and Role are required. Suggested mappings always require confirmation, and repeated unknown values (including categories, dates, or resume names) are resolved once for the affected included rows. Users review and may edit each row before creation. Exact duplicates are skipped by default but can be explicitly imported as new; possible duplicates require an explicit Keep or Exclude decision. The resulting backend batch creates new applications transactionally, and demo mode provides the same temporary in-memory import behavior.

The raw spreadsheet remains in the browser. Only normalized, approved application rows are sent to the backend. PursuitHQ does not automatically scrape sites. Google Sheets are supported only through CSV or XLSX export.

### Import non-goals

Import does not update or merge existing applications, connect directly to Google Sheets, run background synchronization, keep persistent import history, or store raw spreadsheet files.

### Import limits and mapping

| Limit | Value |
| --- | ---: |
| File size | 10 MiB |
| Application data rows | 1,000 |
| Meaningful columns | 80 |
| Cell text | 10,000 characters |
| Job Link | 2,048 characters |
| Preview rows | 15 populated rows |

Raw parser safeguards can be higher than the application import limit. Blank and formatting-only rows do not count; the selected header determines which populated rows are application data.

Supported destinations are **Company**, **Role**, **Status**, **Source**, **Job Link**, **Location**, **Compensation**, **Employment Type**, **Date Saved**, **Date Applied**, **Follow-up Date**, **Next Action**, **Resume Version**, **Contact Name**, **Contact Information**, **Preparation Notes**, **Personal Notes**, **Job Description**, **Red-Flag Notes**, and **Highest Stage Reached**. **Append to Personal Notes** can be selected for more than one source column; **Ignore this column** omits it. Each normal destination can be mapped once. Ambiguous headings may require manual mapping, and suggestions never bypass confirmation.

Imported dates are not changed to today, and Date Applied may be blank. Saved rows cannot retain Date Applied. Rejected and Withdrawn rows without sufficient historical context require an explicit review decision; Highest Stage Reached supplies that context. Ambiguous slash dates require the user to choose the date order.

## First-run guidance and demo evaluation

New local workspaces present workflow guidance rather than an account setup wizard: users can add one opportunity or import an existing tracker. With one untouched application, the guide briefly prompts follow-through; it disappears automatically once the workspace is established through additional applications, a next action, follow-up, resume assignment, or archived history. Dismissal is versioned and browser-local, can be restored, and does not add backend state.

The public demo is a separately guided, already-populated fictional workspace. Its evaluator guide is mode-driven, never based on application count, and leads to seeded reminders, the featured application, Status Board, Outcome Insights, Help, and Data & Import. Demo changes reset on reload; persistent real use requires the local FastAPI and SQLite application.

## Workspace navigation

Desktop destinations are grouped into **Overview**, **Job search**, **Resources**, and **Support**. Desktop users can use either the expanded sidebar or compact rail; that compact choice is a browser-local presentation preference, not workspace data. Mobile uses a compact header and Menu disclosure. Successful top-level navigation opens the destination at the top, while guarded navigation retains drafts and does not move pages until confirmed. The same shell is used in local and demo modes.

An exact duplicate has the same normalized Job Link or the same Company, Role, and Date Applied, and is skipped by default. **Import as new** explicitly creates an additional application. A possible duplicate has the same Company and Role and must be kept or excluded explicitly. The same comparisons are made among spreadsheet rows; exclusions can also result from unresolved or invalid values, not only duplicates.

## Application Detail

Application Detail is organized into **Overview**, **Follow-up**, **Job Details**, **Job Posting**, **AI Brief**, **Resume & Prep**, **Red Flags**, and **Activity**. The AI Brief is distinct from capture: it does not create or silently overwrite application fields, and reopening it does not call Google.

## Outcome reporting

Each application keeps a highest confirmed stage separate from its current status. **Saved** means not submitted. Rejected and Withdrawn applications retain confirmed reach while closed; changing an active application backward corrects its confirmed history, and a separate correction action can repair historical reach without changing current status. Outcome Insights excludes archived records, counts confirmed progression only, and presents source and resume comparisons with contributor transparency and small-sample context.

## Boundaries and non-goals

PursuitHQ does not provide authentication, multi-user collaboration, production backend hosting, automatic application submission, generic scraping, AI resume generation, automated candidate scoring, email/calendar integration, merge-style restore, or unreviewed arbitrary spreadsheet ingestion. The browser companion is not a generic page or selected-text collector.

## Success criteria

- A user can capture, review, and save an opportunity without an automatic write.
- A user can see what to do next and record follow-through.
- Stored posting context, resume choices, concerns, and activity remain connected to an application.
- Data remains portable through clear exports and a review-first restore flow.
- Privacy boundaries and current limitations are understandable before use.
