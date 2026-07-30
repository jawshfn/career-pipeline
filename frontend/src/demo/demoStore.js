import {
  DEFAULT_APPLICATION_SOURCE,
  FOLLOW_UP_EXCLUDED_STATUSES,
  PROGRESSION_STAGES,
  STALE_EXCLUDED_STATUSES,
} from "../constants/applicationConstants.js";
import { createDemoState } from "./demoData.js";
import { createCanonicalJobBriefSource, createJobBriefPayload, createJobBriefSourceFingerprint } from "../services/jobBriefService.js";
import {
  selectDemoDashboardSummary,
  selectDemoOutcomeContributors,
  selectDemoOutcomeInsights,
} from "./demoSelectors.js";

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
  const impliedApplied = application.date_applied;
  return PROGRESSION_STAGES[Math.max(storedRank, statusRank, impliedApplied ? 1 : 0)];
}

function isArchived(application) {
  return application.is_archived || application.status === "Archived";
}

function getActiveApplications() {
  return demoState.applications.filter((application) => !isArchived(application));
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
  const status = payload.status || "Saved";
  const dateApplied = normalizeDateOnly(payload.date_applied) || (PROGRESSION_STAGES.indexOf(status) >= 1 ? getTodayValue() : null);
  const createdApplication = {
    id: demoState.nextApplicationId,
    company_name: payload.company_name,
    role_title: payload.role_title,
    job_link: payload.job_link || "",
    source: payload.source || DEFAULT_APPLICATION_SOURCE,
    status,
    furthest_stage: furthestStageFor({ ...payload, status, date_applied: dateApplied }),
    location: payload.location || "",
    compensation: payload.compensation || "",
    employment_type: payload.employment_type || "",
    date_saved: payload.date_saved || getTodayValue(),
    date_applied: dateApplied,
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
  const application = getDemoApplication(applicationId);
  if (Object.prototype.hasOwnProperty.call(payload, "status") && payload.status !== application.status && payload.status !== "Archived") {
    const { status, ...remainingPatch } = payload;
    const transitioned = transitionDemoApplicationStatus(applicationId, {
      status,
      expected_status: application.status,
      expected_furthest_stage: application.furthest_stage,
    });
    return Object.keys(remainingPatch).length ? updateDemoApplication(applicationId, remainingPatch) : transitioned;
  }
  return updateDemoApplicationRecord(applicationId, payload);
}

function updateDemoApplicationRecord(applicationId, payload, { preserveConfirmedStage = false } = {}) {
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
      updatedApplication.furthest_stage = preserveConfirmedStage
        ? payload.furthest_stage
        : furthestStageFor({
          ...updatedApplication,
          furthest_stage: payload.furthest_stage ?? application.furthest_stage,
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

export function transitionDemoApplicationStatus(applicationId, payload) {
  const application = getDemoApplication(applicationId);
  if (application.is_archived || application.status === "Archived") throw new Error("Archived applications cannot have their status changed.");
  if (application.status !== payload.expected_status || application.furthest_stage !== payload.expected_furthest_stage) {
    throw new Error("This application changed after it was loaded. Refresh it and try again.");
  }
  const targetRank = PROGRESSION_STAGES.indexOf(payload.status);
  if (targetRank < 0 && !["Rejected", "Withdrawn"].includes(payload.status)) throw new Error("Choose a valid application status.");
  const currentRank = PROGRESSION_STAGES.indexOf(application.furthest_stage);
  const terminalFromUnconfirmed = application.status === "Saved" && ["Rejected", "Withdrawn"].includes(payload.status) && currentRank === 0 && !application.date_applied;
  if (terminalFromUnconfirmed && !["not_submitted", "submitted"].includes(payload.terminal_submission_intent)) throw new Error("Choose whether this application was submitted before it was closed.");
  const resetToSaved = payload.status === "Saved" && application.status !== "Saved";
  const backwardCorrection = (PROGRESSION_STAGES.includes(application.status) || ["Rejected", "Withdrawn"].includes(application.status)) && payload.status !== "Saved" && targetRank >= 0 && targetRank < currentRank;
  if (resetToSaved && !payload.confirm_not_submitted) throw new Error("Confirm that this application was not submitted before marking it Saved.");
  if (backwardCorrection && !payload.confirm_backward_change) throw new Error("Confirm changing the highest confirmed stage when moving backward.");
  const patch = { status: payload.status };
  if (resetToSaved) { patch.furthest_stage = "Saved"; patch.date_applied = null; }
  else if (targetRank >= 1 && !application.date_applied) patch.date_applied = getTodayValue();
  if (terminalFromUnconfirmed && payload.terminal_submission_intent === "submitted") {
    const stage = payload.confirmed_stage || "Applied";
    if (PROGRESSION_STAGES.indexOf(stage) < 1) throw new Error("Submitted applications must confirm Applied or a later stage.");
    patch.furthest_stage = stage;
  }
  if (backwardCorrection) patch.furthest_stage = payload.status;
  return updateDemoApplicationRecord(applicationId, patch, { preserveConfirmedStage: Boolean(patch.furthest_stage) });
}

export function correctDemoApplicationOutcomeHistory(applicationId, payload) {
  const application = getDemoApplication(applicationId);
  if (application.is_archived || application.status === "Archived") throw new Error("Archived applications cannot have outcome history corrected.");
  if (application.furthest_stage !== payload.expected_furthest_stage) throw new Error("This application changed after it was loaded. Refresh it and try again.");
  if (payload.confirmed_stage === application.furthest_stage) throw new Error("Highest confirmed stage is already set to that value.");
  const statusRank = PROGRESSION_STAGES.indexOf(application.status);
  if (statusRank >= 0 && PROGRESSION_STAGES.indexOf(payload.confirmed_stage) < statusRank) throw new Error("Highest confirmed stage cannot be below the current active status.");
  const previous = application.furthest_stage;
  if (PROGRESSION_STAGES.indexOf(payload.confirmed_stage) < 0) throw new Error("Choose a valid confirmed stage.");
  const updated = updateDemoApplicationRecord(
    applicationId,
    { furthest_stage: payload.confirmed_stage, ...(payload.confirmed_stage === "Saved" ? { date_applied: null } : {}) },
    { preserveConfirmedStage: payload.confirmed_stage === "Saved" },
  );
  const timestamp = nowIso();
  demoState = { ...demoState, activities: [{ id: demoState.nextActivityId, application_id: Number(applicationId), activity_date: getTodayValue(), activity_type: "Outcome History Correction", note: `Highest confirmed stage corrected from ${previous} to ${payload.confirmed_stage}.`, created_at: timestamp, updated_at: timestamp }, ...demoState.activities], nextActivityId: demoState.nextActivityId + 1 };
  return updated;
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
  const today = getTodayValue();
  const upcomingCutoff = formatLocalDate(addDays(new Date(`${today}T12:00:00`), 3));
  return clone(selectDemoDashboardSummary({
    applications: demoState.applications,
    today,
    upcomingCutoff,
  }));
}

export function getDemoOutcomeInsights() {
  return clone(selectDemoOutcomeInsights({
    applications: demoState.applications,
    resumeVersions: demoState.resumeVersions,
  }));
}

export function getDemoOutcomeContributors({ metric, group_type = "global", group_id = null }) {
  return clone(selectDemoOutcomeContributors(
    { applications: demoState.applications, resumeVersions: demoState.resumeVersions },
    { metric, group_type, group_id },
  ));
}
