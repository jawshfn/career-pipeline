# Data Model

The implemented backend uses SQLite with SQLAlchemy. The model supports quick capture, application tracking, resume-version assignment, follow-up action items, next actions, application-scoped contact/prep details, red-flag fields, activity timeline entries, and archive behavior.

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
- compensation: optional flexible compensation text, such as "$29/hr" or "Competitive salary"
- salary_min: optional numeric lower salary value
- salary_max: optional numeric upper salary value
- employment_type: optional employment type label
- date_saved: date the opportunity was saved
- date_applied: optional date the user applied
- follow_up_date: optional date for next follow-up
- next_action: optional short user-entered next step
- contact_name: optional application-scoped contact name
- contact_info: optional flexible contact detail, such as email, profile link, phone, or recruiter profile
- prep_notes: optional preparation notes for interviews, assessments, talking points, or questions
- resume_version_id: optional foreign key to resume_versions
- notes: general user notes
- vague_job_description: boolean red-flag field
- unrealistic_salary: boolean red-flag field
- asks_for_payment: boolean red-flag field
- suspicious_contact: boolean red-flag field
- company_mismatch: boolean red-flag field
- too_good_to_be_true: boolean red-flag field
- red_flags_notes: optional notes about user-managed red flags
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

`Archived` is stored for archived records, but it is not an active Status Board stage. Active Applications and Status Board views filter out records where `is_archived` is true.

`Follow-up due` is not stored as a status. Follow-up action states are computed from `follow_up_date`.

### Important Relationships

- applications.resume_version_id references resume_versions.id

### Implementation Notes

- Creating an application without status defaults to `Saved`.
- Creating a normal application with `Archived` status is rejected.
- Archiving through DELETE sets `status` to `Archived` and `is_archived` to true.
- Updating status to `Archived` also sets `is_archived` to true.
- Restoring archived records is intentionally not implemented yet.
- Red flags are stored directly on the application record for the current prototype.

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

## application_activities

### Purpose

Stores dated Activity Timeline entries for an application.

### Fields

- id: primary key
- application_id: foreign key to applications
- activity_date: date the activity occurred
- activity_type: short activity category, such as Follow-up or Interview
- note: user-entered activity note
- created_at: creation timestamp
- updated_at: last update timestamp

### Important Relationships

- application_activities.application_id references applications.id
- Activities are scoped to one application and do not appear on other applications.

### Implementation Notes

- Activity entries are saved independently from the main application detail form.
- Reminders follow-up quick actions can create activity entries for snooze and clear outcomes.
- Application status changes create backend-owned `Status Change` activity entries.

## Planned Future Tables

The following tables are still planned and are not implemented yet.

## application_events

Purpose: possible later audit log of automatic field changes, separate from user-entered activity notes.

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
