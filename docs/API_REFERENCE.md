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
| GET, PATCH, DELETE | `/api/applications/{id}` | Read, update, or permanently delete | Status changes log activity; deletion removes related activities and any saved AI brief. |
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
| GET | `/api/resume-versions/{id}/delete-impact` | Inspect deletion impact | Shows assignments that block deletion. |
| DELETE | `/api/resume-versions/{id}` | Delete a version | Protected while applications still reference it. |

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
| GET | `/api/exports/workspace` | Download versioned JSON backup | Read-only complete workspace backup. |
| GET | `/api/exports/applications.csv` | Download review CSV | Read-only human-review export; legacy archived records excluded. |
| POST | `/api/imports/workspace/validate` | Validate a backup | Read-only validation and short-lived restore authorization. |
| POST | `/api/imports/workspace/restore` | Replace a workspace | Requires authorization; transactional replace restore preserves compatible legacy archives. |

The frontend generates XLSX directly; it is not a backend endpoint.
