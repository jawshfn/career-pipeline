# PursuitHQ API Reference

FastAPI serves the local JSON API under `/api`; generated interactive schemas are available at `/docs`. This is a readable endpoint overview, not a replacement for those schemas. The separate AI gateway API is documented in [the AI gateway guide](../ai-gateway/README.md).

## Health

| Method | Path | Purpose | Important behavior |
| --- | --- | --- | --- |
| GET | `/api/health` | Check backend health | Returns service status. |

## Applications and follow-ups

| Method | Path | Purpose | Important behavior |
| --- | --- | --- | --- |
| GET, POST | `/api/applications` | List or create applications | List can filter; new records are not archived. |
| POST | `/api/applications/import-batch` | Atomically create reviewed, normalized application rows | Up to 1,000 rows; validates histories, resumes, URLs, and high-confidence duplicates before one final commit. |
| GET, PATCH, DELETE | `/api/applications/{id}` | Read, update, or permanently delete | Compatibility PATCH delegates status changes to the protected transition logic; deletion removes related activities and any saved AI brief. |
| POST | `/api/applications/{id}/status-transition` | Change current status | Requires expected status and furthest stage; handles first-time terminal closure and backward-stage confirmation explicitly, updates historical evidence safely, and logs one status-change activity. |
| POST | `/api/applications/{id}/outcome-history-correction` | Correct confirmed historical reach | Requires expected furthest stage; never changes current status, rejects archived records and invalid active-stage combinations, and logs one correction activity. |
| GET, PUT, DELETE | `/api/applications/{id}/ai-brief` | Read, save, or remove the latest persisted AI brief | GET returns `null` when absent; PUT rejects briefs whose saved source no longer matches the application. |
| PATCH | `/api/applications/{id}/follow-up` | Apply a reviewed follow-up action | `complete`, `complete_and_schedule`, `reschedule`, and `clear` are atomic and use expected-date conflict protection. |
| GET | `/api/applications/action-items` | Read reminder action items | Read-only overdue, upcoming, and needs-check-in groups. |

## Activities and resumes

| Method | Path | Purpose | Important behavior |
| --- | --- | --- | --- |
| GET, POST | `/api/applications/{id}/activities` | List or create activities | Activity belongs to the selected application. |
| PATCH, DELETE | `/api/applications/{id}/activities/{activity_id}` | Update or delete an activity | Cross-record access is rejected. |
| GET, POST | `/api/resume-versions` | List or create resume versions | Listing defaults to active versions. |
| GET, PATCH | `/api/resume-versions/{id}` | Read or update a version | Supports active/inactive metadata. |
| GET | `/api/resume-versions/{id}/delete-impact` | Inspect deletion impact | Reports active state and current assignment count for reviewed permanent deletion. |
| DELETE | `/api/resume-versions/{id}` | Delete a version | Requires an inactive version and `expected_assignment_count`; stale counts conflict, matching applications are unassigned, and any attached PDF is removed. |
| PUT | `/api/resume-versions/{id}/file` | Attach or replace a Resume PDF | Multipart field `file`; PDF-only and 5 MiB maximum. |
| GET | `/api/resume-versions/{id}/file/content` | Read PDF content | Returns inline PDF bytes for browser preview or download. |
| DELETE | `/api/resume-versions/{id}/file` | Remove a Resume PDF | Leaves the resume version and its assignments intact. |

## Dashboard and capture

| Method | Path | Purpose | Important behavior |
| --- | --- | --- | --- |
| GET | `/api/dashboard/summary` | Read dashboard metrics | Uses backend-derived workspace summaries. |
| POST | `/api/job-imports/greenhouse` | Import a hosted Greenhouse posting | Bounded official-provider import. |
| POST | `/api/job-imports/greenhouse/custom` | Discover and import a custom Greenhouse link | Best-effort, public HTTPS, structural evidence required. |
| POST | `/api/job-imports/lever` | Import a canonical global/EU Lever posting | Bounded documented provider import. |
| POST | `/api/browser-text-captures` | Create one browser-text handoff | User-initiated, in-memory, short-lived; never creates an application. |
| POST | `/api/browser-text-captures/consume` | Consume a handoff once | Returns then removes the captured text. |

## Export and restore

| Method | Path | Purpose | Important behavior |
| --- | --- | --- | --- |
| GET | `/api/exports/workspace` | Download JSON backup | Read-only V2 complete workspace backup, including attached PDFs. |
| GET | `/api/exports/applications.csv` | Download review CSV | Read-only human-review export; legacy archived records excluded. |
| POST | `/api/imports/workspace/validate` | Validate a backup | Read-only validation and short-lived restore authorization. |
| POST | `/api/imports/workspace/restore` | Replace a workspace | Requires authorization; transactional reviewed restore supports legacy backups and preserves V2 PDFs. |

The frontend generates XLSX directly; it is not a backend endpoint.

Spreadsheet import sends reviewed, normalized rows rather than raw files. Each row has a unique positive `source_row_number`; a successful request returns `created_count` and source-row provenance. A failed validation or duplicate check creates no rows, and imports create no activity records.

### Batch import request and response

`POST /api/applications/import-batch` accepts `{ "rows": [...] }`, with 1–1,000 rows. Each row uses these JSON names: required `source_row_number`, `company_name`, and `role_title`; `status`, `source`, `employment_type`, `job_link`, `location`, `compensation`; `date_saved`, `date_applied`, `follow_up_date`; `next_action`; `resume_version_id`; `contact_name`, `contact_info`, `prep_notes`, `notes`, `job_description`, `red_flags_notes`; `highest_confirmed_stage`; and strict Boolean `allow_duplicate`. Dates, when supplied, are `YYYY-MM-DD` strings. `source_row_number` preserves the original spreadsheet row and is not application data.

```json
{"rows":[{"source_row_number":2,"company_name":"Example Labs","role_title":"Platform Engineer","status":"Applied","source":"Other","job_link":"https://example.com/jobs/platform","date_saved":"2026-08-01","date_applied":"2026-08-01","allow_duplicate":false}]}
```

On success the endpoint returns `201` with only `created_count` and `created`; each created item contains `source_row_number` and the normal `application` representation. The example abbreviates unrelated `ApplicationRead` fields.

```json
{"created_count":1,"created":[{"source_row_number":2,"application":{"id":42,"company_name":"Example Labs","role_title":"Platform Engineer","status":"Applied","furthest_stage":"Applied","date_saved":"2026-08-01","date_applied":"2026-08-01"}}]}
```

The endpoint validates the complete request before persistence and rolls the complete batch back on failure. It rejects unsupported status, source, and employment-type values; missing resumes; invalid or overlong Job Links (maximum 2,048 characters); non-`YYYY-MM-DD` dates; non-Boolean duplicate overrides; invalid terminal history; and high-confidence existing or in-batch duplicates unless `allow_duplicate` is explicitly true. Controlled validation and duplicate conflicts return an error without creating rows. Frontend-only excluded/skipped counts are not response fields.

## Outcome Insights

| Method | Path | Purpose | Important behavior |
| --- | --- | --- | --- |
| GET | `/api/insights/outcomes` | Read confirmed historical outcomes | Excludes archived and unconfirmed records, returns scope counts, outcome metrics, source/resume groups, and current-versus-historical context. Assessment is optional; `progressed_beyond_applied` means any confirmed stage beyond Applied. |
| GET | `/api/insights/outcomes/contributors` | Inspect applications behind one outcome cell | Filters by metric and optional source/resume group; returns deterministic application identity, current status, confirmed stage, source, and resume identity. |
