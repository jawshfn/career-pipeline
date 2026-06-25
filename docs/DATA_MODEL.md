# Data Model

The planned database for the initial prototype is SQLite. The model should support quick capture first, with optional enrichment through notes, resume versions, red flags, and timeline events.

## applications

### Purpose

Stores the main record for each job opportunity or application.

### Fields

- id: primary key
- company_name: company or organization name
- role_title: job title or opportunity name
- source: where the opportunity came from, such as LinkedIn, Indeed, referral, recruiter, company site, or other
- job_url: optional link to the posting
- status: current application status, such as Saved, Applied, Assessment, Recruiter Screen, Interview, Offer, Rejected, Withdrawn, or Archived
- location: optional job location or remote label
- compensation_text: optional compensation note as written by the user
- follow_up_date: optional date for next follow-up
- resume_version_id: optional foreign key to resume_versions
- notes: general user notes
- is_archived: boolean for hiding inactive records without deleting them
- created_at: creation timestamp
- updated_at: last update timestamp
- applied_at: optional date the user applied

Follow-up due should not be stored as a status. It should be computed from follow_up_date when listing follow-up queues, dashboard actions, and table filters.

Archived is stored for archived records, but it is not an active pipeline stage. Active workflow views should hide records where is_archived is true.

### Important Relationships

- applications.resume_version_id references resume_versions.id
- applications can have many red_flags through application_red_flags
- applications can have many application_events

### MVP Priority

Required for v0.1. This is the core table.

## resume_versions

### Purpose

Stores named resume variants so users can remember which resume they used for each application.

### Fields

- id: primary key
- name: user-facing resume version name
- target_role: optional role family or target
- notes: optional description of positioning or changes
- file_reference: optional local filename, URL, or plain text reference
- created_at: creation timestamp
- updated_at: last update timestamp

### Important Relationships

- One resume version can be assigned to many applications.

### MVP Priority

Included in v0.1 after the core applications workflow is working.

## red_flags

### Purpose

Stores reusable red-flag tags that help users identify questionable, suspicious, or low-quality postings.

### Fields

- id: primary key
- label: short red-flag name
- description: optional explanation
- severity: optional user-facing level, such as low, medium, or high
- is_active: boolean for hiding deprecated tags
- created_at: creation timestamp
- updated_at: last update timestamp

### Important Relationships

- red_flags can be assigned to many applications through application_red_flags.

### MVP Priority

Included in v0.1 after resume versions or alongside the application detail page.

## application_red_flags

### Purpose

Join table connecting applications to selected red flags.

### Fields

- id: primary key
- application_id: foreign key to applications
- red_flag_id: foreign key to red_flags
- note: optional user note explaining why the flag was applied
- created_at: creation timestamp

### Important Relationships

- application_red_flags.application_id references applications.id
- application_red_flags.red_flag_id references red_flags.id
- A unique constraint should prevent duplicate red-flag assignments for the same application and red_flag pair.

### MVP Priority

Included in v0.1 as part of the red-flag system.

## application_events

### Purpose

Stores a timeline of meaningful actions and changes for an application.

### Fields

- id: primary key
- application_id: foreign key to applications
- event_type: type of event, such as created, status_changed, follow_up_completed, note_added, resume_assigned, or red_flag_added
- event_date: event timestamp or user-specified date
- previous_value: optional prior value for change events
- new_value: optional new value for change events
- note: optional event note
- created_at: creation timestamp

### Important Relationships

- application_events.application_id references applications.id
- One application can have many events.

### MVP Priority

Useful for v0.1 status history and detail pages. If implementation time is tight, start with created and status_changed events.

## company_notes

### Purpose

Possible later table for company-level notes shared across multiple applications at the same organization.

### Fields

- id: primary key
- company_name: company name used to associate notes
- note: company-level note
- sentiment: optional lightweight label, such as positive, neutral, or caution
- created_at: creation timestamp
- updated_at: last update timestamp

### Important Relationships

- Could relate to applications by company_name initially.
- A later normalized companies table could replace company_name matching if needed.

### MVP Priority

Later. Not required for v0.1 unless company-level notes become necessary during prototyping.
