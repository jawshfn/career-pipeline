# Wireframes

These text-based wireframes describe the planned product structure before frontend implementation. They are intentionally simple and should guide layout and workflow decisions without locking in final visual design.

## Daily Command Center / Dashboard

```text
Career Pipeline
----------------------------------------------------------------
Quick Add: [ Company ] [ Role ] [ Source v ] [ Save ]

Today
----------------------------------------------------------------
Follow-ups Due        Active Applications       Interviews
[ 3 ]                 [ 24 ]                    [ 2 ]

Due / Overdue Follow-Ups
----------------------------------------------------------------
Company          Role                 Due        Status      Action
Example Co       Software Developer   Today      Applied     [Open]
Northwind        QA Analyst           Overdue    Applied     [Open]

Pipeline Snapshot
----------------------------------------------------------------
Saved      Applied      Assessment      Recruiter Screen      Interview      Offer
[ 4 ]      [ 12 ]       [ 2 ]           [ 3 ]                 [ 2 ]          [ 0 ]

Source Insights
----------------------------------------------------------------
LinkedIn: 10 applications, 2 responses
Referral: 4 applications, 2 responses
Company site: 7 applications, 1 response

Flagged Applications
----------------------------------------------------------------
Company          Role                 Flags                    Action
Example Staffing Data Entry Assistant Suspicious contact       [Review]
```

## Quick Add Form

```text
Quick Add Application
----------------------------------------------------------------
Company name      [                                 ]
Role title        [                                 ]
Source            [ LinkedIn v ]
Job URL           [                                 ]
Status            [ Saved v ]
Follow-up date    [ mm/dd/yyyy ]
Notes             [                                 ]

[ Save Application ]  [ Save and Add Another ]
```

Quick-add should stay compact. Resume version, detailed notes, red flags, and timeline edits can be handled after the initial save.

## Applications Table

```text
Applications
----------------------------------------------------------------
[ Search applications ]  Status [ All v ] Source [ All v ] [Filters]

Company       Role              Source     Status      Follow-up  Resume
Example Co    Developer         LinkedIn   Applied     Jul 1      API Resume
Northwind     QA Analyst        Indeed     Saved       -          -
Contoso       Support Engineer  Referral   Interview   Jun 28     General

Row actions: [Open] [Status] [Follow-up]
```

The table should support scanning and quick status updates without requiring the user to open every detail page.

## Pipeline Board

```text
Pipeline
----------------------------------------------------------------
Saved           Applied         Assessment      Recruiter Screen      Interview       Offer
----------------------------------------------------------------
Example Co      Northwind       Contoso         Fabrikam              Initech         -
Role title      Role title      Role title      Role title            Role title
Source          Follow-up       Assessment      Recruiter             Date

Archived, rejected, and withdrawn applications should be hidden by default.
```

The board should make application flow visible. Drag-and-drop can come later; button or menu status changes are enough for the first prototype.

## Application Detail Page

```text
Application Detail
----------------------------------------------------------------
Example Company
Junior Software Developer

Status [ Applied v ]     Source: LinkedIn     Follow-up: Jul 1
Job URL: https://example.com/jobs/123
Resume Version: [ Backend API Resume v ]

Notes
----------------------------------------------------------------
[ Notes text area                                      ]

Red Flags
----------------------------------------------------------------
[ ] Vague company details
[ ] Unclear compensation
[ ] Suspicious contact method
[ ] Requires payment or equipment purchase
[ ] Inconsistent job description

Timeline
----------------------------------------------------------------
Jun 24  Created from quick add
Jun 24  Status changed from Saved to Applied
Jun 25  Follow-up scheduled for Jul 1
```

## Resume Versions Page

```text
Resume Versions
----------------------------------------------------------------
[ Add Resume Version ]

Name                  Target Role          Used In       Updated
Backend API Resume    Backend developer    8 apps        Jun 24
General New Grad      Entry-level roles    12 apps       Jun 23
Support Focus         Support engineer     4 apps        Jun 20

Selected Resume Version
----------------------------------------------------------------
Name            [ Backend API Resume ]
Target role     [ Backend developer ]
File reference  [ resume-backend-api.pdf ]
Notes           [ Emphasizes Python, APIs, and databases. ]

[ Save ]
```

## Red-Flag Checklist Section

```text
Red Flags
----------------------------------------------------------------
[ ] Vague company details
[ ] Unclear compensation
[ ] Suspicious contact method
[ ] Requires payment or equipment purchase
[ ] Inconsistent job description
[ ] Too-good-to-be-true offer language

Flag note
[ Optional context about why this application was flagged. ]

[ Save Flags ]
```

Red flags should be framed as user-applied caution tags. The product should avoid claiming that a posting is fraudulent unless the user records that conclusion themselves.
