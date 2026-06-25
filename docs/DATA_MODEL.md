# Data Model

The implemented backend uses SQLite with SQLAlchemy. The model supports quick capture, application tracking, resume-version assignment, follow-up action items, and archive behavior.

## Implemented Tables

## applications

### Purpose

Stores the main record for each job opportunity or application.

### Fields

- id: primary key
- company_name: company or organization name
- role_title: job title or opportunity name
- job_link: optional link to the posting
- source: where the opportunity came from, such as LinkedIn, Indeed, referral, recruiter, company site, or other
- status: current application status
- location: optional job location or remote label
- salary_min: optional numeric lower salary value
- salary_max: optional numeric upper salary value
- employment_type: optional employment type label
- date_saved: date the opportunity was saved
- date_applied: optional date the user applied
- follow_up_date: optional date for next follow-up
- resume_version_id: optional foreign key to resume_versions
- notes: general user notes
- is_archived: boolean for hiding inactive records from active workflow views
- created_at: creation timestamp
- updated_at: last update timestamp

### Status Values

Allowed stored statuses:

- Saved
- Applied
- Assessment
- Recruiter Screen
- Interview
- Offer
- Rejected
- Withdrawn
- Archived

`Archived` is stored for archived records, but it is not an active pipeline stage. Active Applications and Pipeline views filter out records where `is_archived` is true.

`Follow-up due` is not stored as a status. Follow-up action states are computed from `follow_up_date`.

### Important Relationships

- applications.resume_version_id references resume_versions.id

### Implementation Notes

- Creating an application without status defaults to `Saved`.
- Creating a normal application with `Archived` status is rejected.
- Archiving through DELETE sets `status` to `Archived` and `is_archived` to true.
- Updating status to `Archived` also sets `is_archived` to true.
- Restoring archived records is intentionally not implemented yet.

## resume_versions

### Purpose

Stores named resume variants so users can remember which resume they used for each application.

### Fields

- id: primary key
- name: user-facing resume version name
- target_role: optional role family or target
- description: optional description of positioning or changes
- is_active: boolean for hiding inactive resume versions
- created_at: creation timestamp
- updated_at: last update timestamp

### Important Relationships

- One resume version can be assigned to many applications.

## Planned Future Tables

The following tables are still planned and are not implemented yet.

## red_flags

Purpose: reusable red-flag tags for questionable, suspicious, or low-quality postings.

Potential fields:

- id
- label
- description
- severity
- is_active
- created_at
- updated_at

## application_red_flags

Purpose: join table connecting applications to selected red flags.

Potential fields:

- id
- application_id
- red_flag_id
- note
- created_at

## application_events

Purpose: timeline of meaningful actions and changes for an application.

Potential fields:

- id
- application_id
- event_type
- event_date
- previous_value
- new_value
- note
- created_at

## company_notes

Purpose: possible later table for company-level notes shared across multiple applications at the same organization.

Potential fields:

- id
- company_name
- note
- sentiment
- created_at
- updated_at
