import {
  ACTIVE_APPLICATION_STATUSES,
  CLOSED_APPLICATION_STATUSES,
  DEFAULT_APPLICATION_SOURCE,
  RED_FLAG_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../constants/applicationConstants.js";
import { createDemoState } from "./demoData.js";

const FOLLOW_UP_EXCLUDED_STATUSES = new Set(["Rejected", "Withdrawn", "Archived"]);
const STALE_EXCLUDED_STATUSES = new Set(["Offer", "Rejected", "Withdrawn", "Archived"]);

let demoState = createDemoState();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function updateEffectivenessMetrics(metrics, application) {
  metrics.applications += 1;

  if (ACTIVE_APPLICATION_STATUSES.has(application.status)) {
    metrics.active += 1;
  }

  if (application.status === "Interview") {
    metrics.interviews += 1;
  }

  if (application.status === "Offer") {
    metrics.offers += 1;
  }

  if (CLOSED_APPLICATION_STATUSES.has(application.status)) {
    metrics.closed += 1;
  }
}

function sortByUpdatedAt(applications) {
  return [...applications].sort((first, second) =>
    String(second.updated_at || "").localeCompare(String(first.updated_at || "")),
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

export function createDemoApplication(payload) {
  const timestamp = nowIso();
  const createdApplication = {
    id: demoState.nextApplicationId,
    company_name: payload.company_name,
    role_title: payload.role_title,
    job_link: payload.job_link || "",
    source: payload.source || DEFAULT_APPLICATION_SOURCE,
    status: payload.status || "Saved",
    location: payload.location || "",
    compensation: payload.compensation || "",
    salary_min: payload.salary_min ?? null,
    salary_max: payload.salary_max ?? null,
    employment_type: payload.employment_type || "",
    date_saved: payload.date_saved || getTodayValue(),
    date_applied: normalizeDateOnly(payload.date_applied),
    follow_up_date: normalizeDateOnly(payload.follow_up_date),
    next_action: payload.next_action || "",
    contact_name: payload.contact_name || "",
    contact_info: payload.contact_info || "",
    prep_notes: payload.prep_notes || "",
    resume_version_id: payload.resume_version_id ?? null,
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
  const timestamp = nowIso();

  demoState = {
    ...demoState,
    applications: demoState.applications.map((application) => {
      if (String(application.id) !== String(applicationId)) {
        return application;
      }

      updatedApplication = {
        ...application,
        ...payload,
        is_archived: payload.status === "Archived" ? true : application.is_archived,
        updated_at: timestamp,
      };
      return updatedApplication;
    }),
  };

  if (!updatedApplication) {
    throw new Error("Application not found.");
  }

  return clone(updatedApplication);
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
  return clone([...resumeVersions].sort((first, second) => first.name.localeCompare(second.name)));
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
  const sourceEffectiveness = new Map();
  const resumeEffectiveness = new Map();

  for (const application of applications) {
    statusCounts.set(application.status, (statusCounts.get(application.status) || 0) + 1);

    const source = getSourceLabel(application.source);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    const sourceMetrics = sourceEffectiveness.get(source) || {
      source,
      applications: 0,
      active: 0,
      interviews: 0,
      offers: 0,
      closed: 0,
    };
    updateEffectivenessMetrics(sourceMetrics, application);
    sourceEffectiveness.set(source, sourceMetrics);

    const resumeKey = application.resume_version_id || "unassigned";
    resumeCounts.set(resumeKey, (resumeCounts.get(resumeKey) || 0) + 1);
    const resumeVersion = resumeVersionsById.get(application.resume_version_id);
    const resumeMetrics = resumeEffectiveness.get(resumeKey) || {
      id: String(resumeKey),
      label: resumeVersion ? getResumeLabel(resumeVersion) : "Unassigned",
      applications: 0,
      active: 0,
      interviews: 0,
      offers: 0,
      closed: 0,
    };
    updateEffectivenessMetrics(resumeMetrics, application);
    resumeEffectiveness.set(resumeKey, resumeMetrics);
  }

  const activeApplicationCount = applications.filter((application) =>
    ACTIVE_APPLICATION_STATUSES.has(application.status),
  ).length;
  const overdueFollowupCount = applications.filter(
    (application) => application.follow_up_date && application.follow_up_date < today,
  ).length;
  const upcomingFollowupCount = applications.filter(
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
    source_effectiveness: [...sourceEffectiveness.values()].sort(
      (first, second) => second.applications - first.applications || first.source.localeCompare(second.source),
    ),
    resume_version_effectiveness: [...resumeEffectiveness.values()].sort(
      (first, second) => second.applications - first.applications || first.label.localeCompare(second.label),
    ),
  });
}
