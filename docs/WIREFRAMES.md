# Wireframes

These text-based wireframes describe the product direction. Some screens are implemented in the current prototype, while others are planned future UI. They are intentionally simple and should guide layout and workflow decisions without locking in final visual design.

## Daily Command Center

Status: implemented. The current UI shows overdue follow-ups, upcoming follow-ups due within 3 days, stale active applications, Next Action context, and follow-up quick actions.

```text
Career Pipeline
----------------------------------------------------------------
Today
----------------------------------------------------------------
Overdue Follow-ups      Upcoming Follow-ups      Stale Applications
----------------------------------------------------------------
Company          Role                 Due        Status      Action
Example Co       Software Developer   Today      Applied     [Snooze 3 days] [Clear]
```

## Quick Add Form

Status: implemented as a dedicated page. The current form includes resume version selection, applied date, follow-up date, and follow-up date preset buttons.

```text
Quick Add Application
----------------------------------------------------------------
Company name      [                                 ]
Role title        [                                 ]
Job URL           [                                 ]
Source            [ LinkedIn v ]
Status            [ Saved v ]
Resume version    [ General v ]
Applied date      [ mm/dd/yyyy ]
Follow-up date    [ mm/dd/yyyy ] [Tomorrow] [In 3 days] [In 1 week]
Notes             [                                 ]

[ Add application ]
```

Quick Add should stay compact. Red flags, activity timeline edits, next action, and richer job details live in Application Detail after the initial save.

## Dashboard

Status: implemented. The current UI shows summary cards, status/source/resume breakdowns, red-flag snapshot, Source Effectiveness, and Resume Version Effectiveness.

```text
Dashboard
----------------------------------------------------------------
[ Active Applications ] [ Overdue ] [ Upcoming ] [ Red Flags ] [ Interviews ] [ Offers ]

Status Breakdown          Source Breakdown          Resume Usage
----------------------------------------------------------------
Saved        4            LinkedIn      10          General Resume      8
Applied     12           Referral      4           Software Resume     3
Interview   2            Unspecified   1           Unassigned          5

Source Effectiveness
----------------------------------------------------------------
Source       Applications      Active      Interviews      Offers      Closed
LinkedIn     10                8           2               1           2

Resume Version Effectiveness
----------------------------------------------------------------
Resume       Applications      Active      Interviews      Offers      Closed
General      8                 7           1               0           1
```

## Applications Table

Status: implemented with Active, Closed, and All views.

```text
Applications
----------------------------------------------------------------
[Active] [Closed] [All]
[ Search applications ]  Status [ All v ] Source [ All v ] Resume [ All v ] Flags [ All v ] Sort [ Updated v ]

Company       Role              Source     Status      Saved      Applied     Follow-up  Resume
Example Co    Developer         LinkedIn   Applied     Jul 1      API Resume
Northwind     QA Analyst        Indeed     Saved       -          -
Contoso       Support Engineer  Referral   Interview   Jun 28     General

Row actions: [Details]
```

The table should support scanning, filtering, sorting, and opening the detail panel without forcing users through Quick Add first.

## Pipeline Board

Status: implemented without drag-and-drop. The current layout is grouped vertically with status filters rather than a wide horizontally scrolling board.

```text
Pipeline
----------------------------------------------------------------
[All] [Saved] [Applied] [Assessment] [Recruiter Screen] [Interview] [Offer] [Rejected] [Withdrawn]

Applied (12)
----------------------------------------------------------------
Example Co      Developer       Source: LinkedIn      Status [ Applied v ]

Archived applications are hidden from active workflow views. Rejected and withdrawn remain visible as active workflow statuses unless archived.
```

The board should make application flow visible. Drag-and-drop can come later; button or menu status changes are enough for the first prototype.

## Application Detail Panel

Status: implemented as a tabbed panel on the Applications page.

```text
Application Detail
----------------------------------------------------------------
Example Company
Junior Software Developer

[Overview] [Status & Follow-up] [Job Details] [Contact & Prep] [Red Flags] [Activity]

Overview
----------------------------------------------------------------
Read-only snapshot:
Company / role     Status     Applied     Follow-up     Resume     Source

Needs attention:
[ Edit status & follow-up ] [ Edit job details ] [ Add contact/prep notes ]

Status & Follow-up
----------------------------------------------------------------
Status [ Applied v ]     Saved Date [ Jun 24 ]     Applied Date [ Jun 24 ]
Follow-up Date [ Jul 1 ]     Next Action [ Send recruiter follow-up ]

Job Details
----------------------------------------------------------------
Company [ Example Company ]     Role [ Junior Software Developer ]
Source [ LinkedIn v ]           Job Link [ https://... ]
[ Notes text area                                      ]

Contact & Prep
----------------------------------------------------------------
Resume Version [ Backend API Resume v ]
Contact [ Alex Recruiter ]      Prep notes [ ... ]

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

Status: implemented.

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
Description     [ Emphasizes Python, APIs, and databases. ]
Active          [x]

[ Save ]
```

## Red-Flag Checklist Section

Status: implemented inside Application Detail.

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
