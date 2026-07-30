import {
  ACTIVE_APPLICATION_STATUSES,
  CLOSED_APPLICATION_STATUSES,
  FOLLOW_UP_EXCLUDED_STATUSES,
  PROGRESSION_STAGES,
  RED_FLAG_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../constants/applicationConstants.js";
import { OUTCOME_METRICS } from "../constants/outcomeMetrics.js";

function isArchived(application) {
  return application.is_archived || application.status === "Archived";
}

function getSourceLabel(source) {
  return String(source || "").trim() || "Unspecified";
}

function progressionRank(application) {
  return Math.max(0, PROGRESSION_STAGES.indexOf(application.furthest_stage));
}

function buildOutcomeGroup(id, label, rows) {
  const result = { id, label, analyzed: rows.length };

  OUTCOME_METRICS.slice(1).forEach(({ key, threshold }) => {
    const count = rows.filter((application) => progressionRank(application) >= threshold).length;
    result[key] = count;
    result[`${key}_rate`] = rows.length ? count / rows.length : null;
  });

  return result;
}

function resumeLabel(application, resumeVersions) {
  if (application.resume_version_id == null) return "Unassigned";
  return resumeVersions.find((item) => item.id === application.resume_version_id)?.name
    || `Resume #${application.resume_version_id}`;
}

export function selectDemoDashboardSummary({ applications, today, upcomingCutoff }) {
  const visibleApplications = applications.filter((application) => !isArchived(application));
  const statusCounts = new Map(USER_SELECTABLE_APPLICATION_STATUSES.map((status) => [status, 0]));
  const sourceCounts = new Map();

  for (const application of visibleApplications) {
    statusCounts.set(application.status, (statusCounts.get(application.status) || 0) + 1);
    const source = getSourceLabel(application.source);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }

  const activeApplicationCount = visibleApplications.filter((application) =>
    ACTIVE_APPLICATION_STATUSES.has(application.status),
  ).length;
  const followUpApplications = visibleApplications.filter(
    (application) => !FOLLOW_UP_EXCLUDED_STATUSES.has(application.status),
  );
  const overdueFollowupCount = followUpApplications.filter(
    (application) => application.follow_up_date && application.follow_up_date < today,
  ).length;
  const upcomingFollowupCount = followUpApplications.filter(
    (application) => application.follow_up_date
      && application.follow_up_date >= today
      && application.follow_up_date <= upcomingCutoff,
  ).length;
  const redFlaggedCount = visibleApplications.filter((application) =>
    RED_FLAG_OPTIONS.some((option) => application[option.name]),
  ).length;
  const closedApplicationCount = visibleApplications.filter((application) =>
    CLOSED_APPLICATION_STATUSES.has(application.status),
  ).length;

  return {
    summary_cards: [
      { key: "total_applications", label: "Total applications", tone: "total", value: visibleApplications.length },
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
    red_flag_snapshot: {
      flagged_count: redFlaggedCount,
      items: RED_FLAG_OPTIONS.map((option) => ({
        label: option.label,
        count: visibleApplications.filter((application) => Boolean(application[option.name])).length,
      })).filter((item) => item.count > 0),
    },
  };
}

export function selectDemoOutcomeInsights({ applications, resumeVersions }) {
  const visible = applications.filter((application) => !isArchived(application));
  const analyzed = visible.filter((application) => progressionRank(application) >= 1);
  const bySource = new Map();
  const byResume = new Map();

  analyzed.forEach((application) => {
    const source = getSourceLabel(application.source);
    bySource.set(source, [...(bySource.get(source) || []), application]);
    const version = resumeVersions.find((item) => item.id === application.resume_version_id);
    const id = version ? String(version.id) : "unassigned";
    byResume.set(id, {
      label: version ? version.name : "Unassigned",
      rows: [...(byResume.get(id)?.rows || []), application],
    });
  });

  const summary = OUTCOME_METRICS.map(({ key, label, threshold }) => {
    const count = analyzed.filter((application) => progressionRank(application) >= threshold).length;
    const currentCount = analyzed.filter(
      (application) => PROGRESSION_STAGES.indexOf(application.status) >= threshold,
    ).length;
    return {
      key,
      label,
      count,
      denominator: analyzed.length,
      rate: analyzed.length ? count / analyzed.length : null,
      current_at_or_beyond_count: currentCount,
      currently_elsewhere_count: count - currentCount,
    };
  });
  const sourceOrder = ["LinkedIn", "Indeed", "ZipRecruiter", "Company Website", "Referral", "Other"];

  return {
    scope: {
      visible_applications: visible.length,
      analyzed_applications: analyzed.length,
      saved_applications_excluded: visible.filter(
        (application) => application.status === "Saved" && progressionRank(application) === 0,
      ).length,
      closed_without_confirmed_submission_excluded: visible.filter(
        (application) => ["Rejected", "Withdrawn"].includes(application.status)
          && progressionRank(application) === 0,
      ).length,
      archived_applications_excluded: applications.length - visible.length,
    },
    summary,
    source_performance: [...bySource.entries()]
      .sort((first, second) => (sourceOrder.indexOf(first[0]) + 99) % 99
        - (sourceOrder.indexOf(second[0]) + 99) % 99 || first[0].localeCompare(second[0]))
      .map(([id, rows]) => buildOutcomeGroup(id, id, rows)),
    resume_version_performance: [...byResume.entries()]
      .map(([id, value]) => buildOutcomeGroup(id, value.label, value.rows))
      .sort((first, second) => second.analyzed - first.analyzed || first.label.localeCompare(second.label)),
  };
}

export function selectDemoOutcomeContributors(
  { applications, resumeVersions },
  { metric, group_type = "global", group_id = null },
) {
  const outcomeMetric = OUTCOME_METRICS.find((item) => item.key === metric);
  if (!outcomeMetric) throw new Error("Unsupported outcome contributor request.");
  if (!["global", "source", "resume"].includes(group_type)) {
    throw new Error("Choose a valid contributor group.");
  }

  const contributors = applications
    .filter((application) => !isArchived(application)
      && PROGRESSION_STAGES.indexOf(application.furthest_stage) >= outcomeMetric.threshold)
    .filter((application) => group_type !== "source" || getSourceLabel(application.source) === group_id)
    .filter((application) => group_type !== "resume" || (
      application.resume_version_id == null ? "unassigned" : String(application.resume_version_id)
    ) === group_id)
    .sort((first, second) => first.company_name.localeCompare(second.company_name)
      || first.role_title.localeCompare(second.role_title)
      || first.id - second.id)
    .map((application) => ({
      application_id: application.id,
      company_name: application.company_name,
      role_title: application.role_title,
      status: application.status,
      furthest_stage: application.furthest_stage,
      source: application.source,
      resume_version_id: application.resume_version_id,
      resume_version_label: resumeLabel(application, resumeVersions),
    }));

  return { metric, group_type, group_id, contributors };
}
