import {
  ACTIVE_APPLICATION_STATUSES,
  CLOSED_APPLICATION_STATUSES,
  DEFAULT_APPLICATION_SOURCE,
  RED_FLAG_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../constants/applicationConstants.js";
import { createDemoState } from "./demoData.js";
import { createCanonicalJobBriefSource, createJobBriefPayload, createJobBriefSourceFingerprint } from "../services/jobBriefService.js";

const FOLLOW_UP_EXCLUDED_STATUSES = new Set(["Rejected", "Withdrawn", "Archived"]);
const STALE_EXCLUDED_STATUSES = new Set(["Offer", "Rejected", "Withdrawn", "Archived"]);
const PROGRESSION_STAGES = ["Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer"];

let demoState = createDemoState();

export function resetDemoState() {
  demoState = createDemoState();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDemoExportSnapshot() {
  return clone({
    resume_versions: demoState.resumeVersions,
    applications: demoState.applications,
    application_activities: demoState.activities,
    application_ai_briefs: demoState.aiBriefs,
  });
}

function nowIso() {
  return new Date().toISOString();
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getTodayValue() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return formatLocalDate(today);
}

function normalizeDateOnly(value) {
  return value || null;
}

function furthestStageFor(application) {
  const storedRank = PROGRESSION_STAGES.indexOf(application.furthest_stage);
  const statusRank = PROGRESSION_STAGES.indexOf(application.status);
  const impliedApplied = application.date_applied || ["Rejected", "Withdrawn"].includes(application.status);
  return PROGRESSION_STAGES[Math.max(storedRank, statusRank, impliedApplied ? 1 : 0)];
}

function isArchived(application) {
  return application.is_archived || application.status === "Archived";
}

function getActiveApplications() {
  return demoState.applications.filter((application) => !isArchived(application));
}

function getRedFlagCount(application) {
  return RED_FLAG_OPTIONS.filter((option) => application[option.name]).length;
}

function getResumeLabel(resumeVersion) {
  return resumeVersion?.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion?.name;
}

function getSourceLabel(source) {
  return String(source || "").trim() || "Unspecified";
}

function sortByUpdatedAt(applications) {
  return [...applications].sort((first, second) =>
    String(second.updated_at || "").localeCompare(String(first.updated_at || "")),
  );
}

function sortResumeVersionsByUpdatedAt(resumeVersions) {
  return [...resumeVersions].sort(
    (first, second) =>
      String(second.updated_at || "").localeCompare(String(first.updated_at || "")) || Number(second.id) - Number(first.id),
  );
}

export function getDemoApplications(options = {}) {
  const applications = options.includeArchived ? demoState.applications : getActiveApplications();
  return clone(sortByUpdatedAt(applications));
}

export function getDemoApplication(applicationId) {
  const application = demoState.applications.find((item) => String(item.id) === String(applicationId));

  if (!application) {
    throw new Error("Application not found.");
  }

  return clone(application);
}

function demoBriefFor(applicationId) {
  return demoState.aiBriefs.find((brief) => String(brief.application_id) === String(applicationId));
}

export function getDemoApplicationAiBrief(applicationId) {
  const application = getDemoApplication(applicationId);
  const record = demoBriefFor(applicationId);
  if (!record) return null;
  return clone({ ...record, is_stale: createCanonicalJobBriefSource(application) !== record.source_snapshot });
}

export async function saveDemoApplicationAiBrief(applicationId, payload) {
  const application = getDemoApplication(applicationId);
  const source = createJobBriefPayload(payload.source);
  const sourceSnapshot = createCanonicalJobBriefSource(source);
  if (sourceSnapshot !== createCanonicalJobBriefSource(application)) {
    throw new Error("This application changed while the AI brief was being generated. Reload the application and try again.");
  }
  const sourceFingerprint = await createJobBriefSourceFingerprint(source);
  if (sourceSnapshot !== createCanonicalJobBriefSource(getDemoApplication(applicationId))) {
    throw new Error("This application changed while the AI brief was being generated. Reload the application and try again.");
  }
  const timestamp = nowIso();
  const existing = demoBriefFor(applicationId);
  const record = {
    id: existing?.id || demoState.nextAiBriefId,
    application_id: Number(applicationId), brief: clone(payload.brief), meta: clone(payload.meta),
    source_snapshot: sourceSnapshot, source_fingerprint: sourceFingerprint, is_stale: false,
    created_at: existing?.created_at || timestamp, updated_at: timestamp,
  };
  demoState = { ...demoState, aiBriefs: [...demoState.aiBriefs.filter((item) => String(item.application_id) !== String(applicationId)), record], nextAiBriefId: existing ? demoState.nextAiBriefId : demoState.nextAiBriefId + 1 };
  return clone(record);
}

export function deleteDemoApplicationAiBrief(applicationId) {
  getDemoApplication(applicationId);
  demoState = { ...demoState, aiBriefs: demoState.aiBriefs.filter((item) => String(item.application_id) !== String(applicationId)) };
  return null;
}

export function createDemoApplication(payload) {
  const timestamp = nowIso();
  const createdApplication = {
    id: demoState.nextApplicationId,
    company_name: payload.company_name,
    role_title: payload.role_title,
    job_link: payload.job_link || "",
    source: payload.source || DEFAULT_APPLICATION_SOURCE,
    status: payload.status || "Saved",
    furthest_stage: furthestStageFor(payload),
    location: payload.location || "",
    compensation: payload.compensation || "",
    employment_type: payload.employment_type || "",
    date_saved: payload.date_saved || getTodayValue(),
    date_applied: normalizeDateOnly(payload.date_applied),
    follow_up_date: normalizeDateOnly(payload.follow_up_date),
    next_action: payload.next_action || "",
    contact_name: payload.contact_name || "",
    contact_info: payload.contact_info || "",
    prep_notes: payload.prep_notes || "",
    resume_version_id: payload.resume_version_id ?? null,
    job_description: payload.job_description || "",
    notes: payload.notes || "",
    vague_job_description: Boolean(payload.vague_job_description),
    unrealistic_salary: Boolean(payload.unrealistic_salary),
    asks_for_payment: Boolean(payload.asks_for_payment),
    suspicious_contact: Boolean(payload.suspicious_contact),
    company_mismatch: Boolean(payload.company_mismatch),
    too_good_to_be_true: Boolean(payload.too_good_to_be_true),
    red_flags_notes: payload.red_flags_notes || "",
    is_archived: false,
    created_at: timestamp,
    updated_at: timestamp,
  };

  demoState = {
    ...demoState,
    applications: [createdApplication, ...demoState.applications],
    nextApplicationId: demoState.nextApplicationId + 1,
  };

  return clone(createdApplication);
}

export function updateDemoApplication(applicationId, payload) {
  let updatedApplication = null;
  let previousStatus = null;
  const timestamp = nowIso();

  demoState = {
    ...demoState,
    applications: demoState.applications.map((application) => {
      if (String(application.id) !== String(applicationId)) {
        return application;
      }

      previousStatus = application.status;
      updatedApplication = {
        ...application,
        ...payload,
        is_archived: payload.status === "Archived" ? true : application.is_archived,
        updated_at: timestamp,
      };
      updatedApplication.furthest_stage = furthestStageFor({
        ...updatedApplication,
        furthest_stage: application.furthest_stage,
      });
      return updatedApplication;
    }),
  };

  if (!updatedApplication) {
    throw new Error("Application not found.");
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "status") &&
    previousStatus &&
    updatedApplication.status !== previousStatus
  ) {
    const statusChangeActivity = {
      id: demoState.nextActivityId,
      application_id: Number(applicationId),
      activity_date: getTodayValue(),
      activity_type: "Status Change",
      note: `Status changed from ${previousStatus} to ${updatedApplication.status}.`,
      created_at: timestamp,
      updated_at: timestamp,
    };

    demoState = {
      ...demoState,
      activities: [statusChangeActivity, ...demoState.activities],
      nextActivityId: demoState.nextActivityId + 1,
    };
  }

  return clone(updatedApplication);
}

export function applyDemoFollowUpAction(applicationId, payload) {
  const application = demoState.applications.find((item) => String(item.id) === String(applicationId));
  if (!application) {
    throw new Error("Application not found.");
  }
  if (
    !application.follow_up_date ||
    application.follow_up_date !== payload.expected_follow_up_date ||
    isArchived(application) ||
    FOLLOW_UP_EXCLUDED_STATUSES.has(application.status)
  ) {
    throw new Error("This follow-up changed after it was loaded. Refresh Reminders and try again.");
  }

  const validActions = new Set(["complete", "complete_and_schedule", "reschedule", "clear"]);
  if (!validActions.has(payload.action)) {
    throw new Error("Invalid follow-up action.");
  }
  const today = getTodayValue();
  const hasTargetDate = payload.follow_up_date !== undefined && payload.follow_up_date !== null;
  if (["complete", "clear"].includes(payload.action) && hasTargetDate) {
    throw new Error(`follow_up_date must be omitted or null for ${payload.action}.`);
  }
  if (payload.action === "reschedule" && (!hasTargetDate || payload.follow_up_date < today || payload.follow_up_date === application.follow_up_date)) {
    throw new Error("A rescheduled follow-up must be a different date that is today or later.");
  }
  if (payload.action === "complete_and_schedule" && (!hasTargetDate || payload.follow_up_date <= today)) {
    throw new Error("A scheduled next follow-up must be later than today.");
  }

  const normalizeOptionalText = (value, field) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must not be blank.`);
    return value.trim();
  };
  const hasNextAction = Object.prototype.hasOwnProperty.call(payload, "next_action");
  const hasActivityNote = Object.prototype.hasOwnProperty.call(payload, "activity_note");
  const nextAction = hasNextAction ? normalizeOptionalText(payload.next_action, "next_action") : application.next_action;
  const activityNote = hasActivityNote ? normalizeOptionalText(payload.activity_note, "activity_note") : undefined;
  const targetDate = ["reschedule", "complete_and_schedule"].includes(payload.action) ? payload.follow_up_date : null;
  let note;
  if (payload.action === "complete") note = "Completed follow-up.";
  else if (payload.action === "complete_and_schedule") note = `Completed follow-up and scheduled the next follow-up for ${targetDate}.`;
  else if (payload.action === "reschedule") note = `Rescheduled follow-up from ${application.follow_up_date} to ${targetDate}.`;
  else note = "Cleared follow-up without marking it complete.";
  if (activityNote !== undefined && activityNote !== null) note += ` Note: ${activityNote}`;
  if (hasNextAction) note += nextAction === null ? " Next action cleared." : ` Next action: ${nextAction}`;

  const timestamp = nowIso();
  const updatedApplication = {
    ...application,
    follow_up_date: targetDate,
    ...(hasNextAction ? { next_action: nextAction } : {}),
    updated_at: timestamp,
  };
  const activity = {
    id: demoState.nextActivityId,
    application_id: application.id,
    activity_date: today,
    activity_type: "Follow-up",
    note,
    created_at: timestamp,
    updated_at: timestamp,
  };
  demoState = {
    ...demoState,
    applications: demoState.applications.map((item) => item.id === application.id ? updatedApplication : item),
    activities: [activity, ...demoState.activities],
    nextActivityId: demoState.nextActivityId + 1,
  };
  return clone({ application: updatedApplication, activity });
}

export function deleteDemoApplication(applicationId) {
  const application = demoState.applications.find((item) => String(item.id) === String(applicationId));

  if (!application) {
    throw new Error("Application not found.");
  }

  demoState = {
    ...demoState,
    applications: demoState.applications.filter((item) => String(item.id) !== String(applicationId)),
    activities: demoState.activities.filter((activity) => String(activity.application_id) !== String(applicationId)),
    aiBriefs: demoState.aiBriefs.filter((brief) => String(brief.application_id) !== String(applicationId)),
  };

  return null;
}

export function getDemoActionItems() {
  const today = getTodayValue();
  const upcomingCutoff = formatLocalDate(addDays(new Date(`${today}T12:00:00`), 3));
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - 14);

  const reminderApplications = getActiveApplications().filter(
    (application) => !FOLLOW_UP_EXCLUDED_STATUSES.has(application.status),
  );

  return clone({
    overdue_followups: sortByUpdatedAt(
      reminderApplications.filter(
        (application) => application.follow_up_date && application.follow_up_date < today,
      ),
    ),
    upcoming_followups: sortByUpdatedAt(
      reminderApplications.filter(
        (application) =>
          application.follow_up_date &&
          application.follow_up_date >= today &&
          application.follow_up_date <= upcomingCutoff,
      ),
    ),
    stale_applications: sortByUpdatedAt(
      getActiveApplications().filter((application) => {
        if (STALE_EXCLUDED_STATUSES.has(application.status) || application.follow_up_date) {
          return false;
        }

        const updatedAt = application.updated_at ? new Date(application.updated_at) : null;
        return updatedAt && updatedAt < staleCutoff;
      }),
    ),
  });
}

export function getDemoResumeVersions({ includeInactive = false } = {}) {
  const resumeVersions = includeInactive
    ? demoState.resumeVersions
    : demoState.resumeVersions.filter((resumeVersion) => resumeVersion.is_active);
  return clone(sortResumeVersionsByUpdatedAt(resumeVersions));
}

export function createDemoResumeVersion(payload) {
  const timestamp = nowIso();
  const resumeVersion = {
    id: demoState.nextResumeVersionId,
    name: payload.name,
    target_role: payload.target_role || null,
    description: payload.description || null,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  };

  demoState = {
    ...demoState,
    resumeVersions: [resumeVersion, ...demoState.resumeVersions],
    nextResumeVersionId: demoState.nextResumeVersionId + 1,
  };

  return clone(resumeVersion);
}

export function updateDemoResumeVersion(resumeVersionId, payload) {
  let updatedResumeVersion = null;
  const timestamp = nowIso();

  demoState = {
    ...demoState,
    resumeVersions: demoState.resumeVersions.map((resumeVersion) => {
      if (String(resumeVersion.id) !== String(resumeVersionId)) {
        return resumeVersion;
      }

      updatedResumeVersion = {
        ...resumeVersion,
        ...payload,
        updated_at: timestamp,
      };
      return updatedResumeVersion;
    }),
  };

  if (!updatedResumeVersion) {
    throw new Error("Resume version not found.");
  }

  return clone(updatedResumeVersion);
}

export function getDemoResumeVersionDeleteImpact(resumeVersionId) {
  const resumeVersion = demoState.resumeVersions.find(
    (candidate) => String(candidate.id) === String(resumeVersionId),
  );

  if (!resumeVersion) {
    throw new Error("Resume version not found.");
  }
  const assignmentCount = demoState.applications.filter(
    (application) => String(application.resume_version_id) === String(resumeVersionId),
  ).length;
  return clone({
    resume_version_id: resumeVersion.id,
    name: resumeVersion.name,
    is_active: resumeVersion.is_active,
    assignment_count: assignmentCount,
  });
}

export function deleteDemoResumeVersion(resumeVersionId, expectedAssignmentCount) {
  const impact = getDemoResumeVersionDeleteImpact(resumeVersionId);
  if (impact.is_active) {
    throw new Error("Deactivate this resume version before deleting it.");
  }
  if (!Number.isInteger(expectedAssignmentCount) || expectedAssignmentCount < 0) {
    throw new Error("Expected application assignment count must be a nonnegative integer.");
  }
  if (impact.assignment_count !== expectedAssignmentCount) {
    throw new Error("This resume version's application usage changed. Review the deletion warning and try again.");
  }

  demoState = {
    ...demoState,
    applications: demoState.applications.map((application) =>
      String(application.resume_version_id) === String(resumeVersionId)
        ? { ...application, resume_version_id: null, updated_at: nowIso() }
        : application,
    ),
    resumeVersions: demoState.resumeVersions.filter((candidate) => String(candidate.id) !== String(resumeVersionId)),
  };
  return clone({
    resume_version_id: impact.resume_version_id,
    name: impact.name,
    unassigned_application_count: impact.assignment_count,
  });
}

export function getDemoActivities(applicationId) {
  const activities = demoState.activities
    .filter((activity) => String(activity.application_id) === String(applicationId))
    .sort(
      (first, second) =>
        second.activity_date.localeCompare(first.activity_date) ||
        second.created_at.localeCompare(first.created_at),
    );
  return clone(activities);
}

export function createDemoActivity(applicationId, payload) {
  getDemoApplication(applicationId);

  const timestamp = nowIso();
  const activity = {
    id: demoState.nextActivityId,
    application_id: Number(applicationId),
    activity_date: payload.activity_date || getTodayValue(),
    activity_type: payload.activity_type || "Note",
    note: payload.note,
    created_at: timestamp,
    updated_at: timestamp,
  };

  demoState = {
    ...demoState,
    activities: [activity, ...demoState.activities],
    nextActivityId: demoState.nextActivityId + 1,
  };

  return clone(activity);
}

export function updateDemoActivity(applicationId, activityId, payload) {
  let updatedActivity = null;
  const timestamp = nowIso();

  demoState = {
    ...demoState,
    activities: demoState.activities.map((activity) => {
      if (
        String(activity.application_id) !== String(applicationId) ||
        String(activity.id) !== String(activityId)
      ) {
        return activity;
      }

      updatedActivity = {
        ...activity,
        ...payload,
        updated_at: timestamp,
      };
      return updatedActivity;
    }),
  };

  if (!updatedActivity) {
    throw new Error("Activity not found.");
  }

  return clone(updatedActivity);
}

export function deleteDemoActivity(applicationId, activityId) {
  const currentCount = demoState.activities.length;
  demoState = {
    ...demoState,
    activities: demoState.activities.filter(
      (activity) =>
        String(activity.application_id) !== String(applicationId) ||
        String(activity.id) !== String(activityId),
    ),
  };

  if (demoState.activities.length === currentCount) {
    throw new Error("Activity not found.");
  }

  return null;
}

export function getDemoDashboardSummary() {
  const applications = getActiveApplications();
  const resumeVersionsById = new Map(demoState.resumeVersions.map((resumeVersion) => [resumeVersion.id, resumeVersion]));
  const today = getTodayValue();
  const upcomingCutoff = formatLocalDate(addDays(new Date(`${today}T12:00:00`), 3));
  const statusCounts = new Map(USER_SELECTABLE_APPLICATION_STATUSES.map((status) => [status, 0]));
  const sourceCounts = new Map();
  const resumeCounts = new Map();

  for (const application of applications) {
    statusCounts.set(application.status, (statusCounts.get(application.status) || 0) + 1);

    const source = getSourceLabel(application.source);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    const resumeKey = application.resume_version_id || "unassigned";
    resumeCounts.set(resumeKey, (resumeCounts.get(resumeKey) || 0) + 1);
  }

  const activeApplicationCount = applications.filter((application) =>
    ACTIVE_APPLICATION_STATUSES.has(application.status),
  ).length;
  const followUpApplications = applications.filter(
    (application) => !FOLLOW_UP_EXCLUDED_STATUSES.has(application.status),
  );
  const overdueFollowupCount = followUpApplications.filter(
    (application) => application.follow_up_date && application.follow_up_date < today,
  ).length;
  const upcomingFollowupCount = followUpApplications.filter(
    (application) =>
      application.follow_up_date &&
      application.follow_up_date >= today &&
      application.follow_up_date <= upcomingCutoff,
  ).length;
  const redFlaggedCount = applications.filter((application) => getRedFlagCount(application) > 0).length;
  const closedApplicationCount = applications.filter((application) =>
    CLOSED_APPLICATION_STATUSES.has(application.status),
  ).length;

  const resumeUsage = [...resumeCounts.entries()].map(([resumeKey, count]) => {
    if (resumeKey === "unassigned") {
      return { label: "No resume version", count };
    }

    return {
      label: resumeVersionsById.get(resumeKey)?.name || `Resume #${resumeKey}`,
      count,
    };
  });

  return clone({
    summary_cards: [
      { key: "total_applications", label: "Total applications", tone: "total", value: applications.length },
      { key: "active_applications", label: "Active applications", tone: "active", value: activeApplicationCount },
      { key: "closed_applications", label: "Closed applications", tone: "closed", value: closedApplicationCount },
      { key: "overdue_followups", label: "Overdue follow-ups", tone: "overdue", value: overdueFollowupCount },
      { key: "upcoming_followups", label: "Upcoming follow-ups", tone: "upcoming", value: upcomingFollowupCount },
      { key: "red_flagged_applications", label: "Red-flagged applications", tone: "flags", value: redFlaggedCount },
    ],
    status_breakdown: USER_SELECTABLE_APPLICATION_STATUSES.map((status) => ({
      label: status,
      count: statusCounts.get(status) || 0,
    })),
    source_breakdown: [...sourceCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label)),
    resume_usage: resumeUsage.sort((first, second) => first.label.localeCompare(second.label)),
    red_flag_snapshot: {
      flagged_count: redFlaggedCount,
      items: RED_FLAG_OPTIONS.map((option) => ({
        label: option.label,
        count: applications.filter((application) => Boolean(application[option.name])).length,
      })).filter((item) => item.count > 0),
    },
  });
}

export function getDemoOutcomeInsights() {
  const stages = PROGRESSION_STAGES;
  const rank = (app) => Math.max(0, stages.indexOf(furthestStageFor(app)));
  const counts = (rows) => ({ submitted: rows.filter((a) => rank(a) >= 1).length, progressed: rows.filter((a) => rank(a) >= 2).length, human_responses: rows.filter((a) => rank(a) >= 3).length, interviews: rows.filter((a) => rank(a) >= 4).length, offers: rows.filter((a) => rank(a) >= 5).length });
  const metricGroup = (id, label, rows) => {
    const c = counts(rows); const rate = (n) => c.submitted ? n / c.submitted : null;
    return { id, label, ...c, progressed_rate: rate(c.progressed), human_responses_rate: rate(c.human_responses), interviews_rate: rate(c.interviews), offers_rate: rate(c.offers) };
  };
  const applications = demoState.applications;
  const c = counts(applications);
  const summaryLabels = [["submitted", "Submitted"], ["progressed", "Progressed"], ["human_responses", "Human response"], ["interviews", "Interview reached"], ["offers", "Offer received"]];
  const submitted = applications.filter((a) => rank(a) >= 1);
  const bySource = new Map(); const byResume = new Map();
  submitted.forEach((a) => { const source = (a.source || "").trim() || "Unspecified"; bySource.set(source, [...(bySource.get(source) || []), a]); const v = demoState.resumeVersions.find((r) => r.id === a.resume_version_id); const key = v ? String(v.id) : "unassigned"; const label = v ? v.name : "Unassigned"; byResume.set(`${key}|${label}`, [...(byResume.get(`${key}|${label}`) || []), a]); });
  const sourceOrder = ["LinkedIn", "Indeed", "ZipRecruiter", "Company Website", "Referral", "Other"];
  return clone({ total_applications: applications.length, summary: summaryLabels.map(([key, label]) => ({ key, label, count: c[key], denominator: key === "submitted" ? null : c.submitted, rate: key === "submitted" || !c.submitted ? null : c[key] / c.submitted })), funnel: stages.slice(1).map((stage, index) => ({ key: stage.toLowerCase().replaceAll(" ", "_"), label: stage, stage, count: applications.filter((a) => rank(a) >= index + 1).length, denominator: c.submitted, rate: c.submitted ? applications.filter((a) => rank(a) >= index + 1).length / c.submitted : null })), source_performance: [...bySource.entries()].sort((a,b) => (sourceOrder.indexOf(a[0]) + 99) % 99 - (sourceOrder.indexOf(b[0]) + 99) % 99 || a[0].localeCompare(b[0])).map(([label, rows]) => metricGroup(label, label, rows)), resume_version_performance: [...byResume.entries()].map(([value, rows]) => { const [id, label] = value.split("|"); return metricGroup(id, label, rows); }).sort((a,b) => b.submitted - a.submitted || a.label.localeCompare(b.label)) });
}
