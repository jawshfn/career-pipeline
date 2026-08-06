const UNASSIGNED_RESUME_KEY = "unassigned";

function isArchived(application) {
  return application.is_archived || application.status === "Archived";
}

function isUnassigned(resumeVersionId) {
  return resumeVersionId == null || (typeof resumeVersionId === "string" && !resumeVersionId.trim());
}

function compareResumeIds(first, second) {
  return String(first).localeCompare(String(second), undefined, { numeric: true });
}

export function buildResumeUsageSummary(applications = [], resumeVersions = []) {
  const resumeVersionsById = new Map(resumeVersions.map((resumeVersion) => [String(resumeVersion.id), resumeVersion]));
  const countsById = new Map();
  let unassignedApplicationCount = 0;

  applications.forEach((application) => {
    if (isArchived(application)) return;
    if (isUnassigned(application.resume_version_id)) {
      unassignedApplicationCount += 1;
      return;
    }
    const id = application.resume_version_id;
    const key = String(id);
    countsById.set(key, { id, count: (countsById.get(key)?.count || 0) + 1 });
  });

  const assignedEntries = [...countsById.values()]
    .map(({ id, count }) => {
      const resumeVersion = resumeVersionsById.get(String(id));
      return {
        id,
        label: resumeVersion?.name || `Resume #${id}`,
        count,
        isActive: Boolean(resumeVersion?.is_active),
        isDefault: Boolean(resumeVersion?.is_default),
      };
    })
    .sort((first, second) => second.count - first.count
      || first.label.localeCompare(second.label)
      || compareResumeIds(first.id, second.id));
  const assignedApplicationCount = assignedEntries.reduce((total, entry) => total + entry.count, 0);
  const entries = unassignedApplicationCount
    ? [...assignedEntries, {
      id: UNASSIGNED_RESUME_KEY,
      label: "No resume assigned",
      count: unassignedApplicationCount,
      isActive: false,
      isDefault: false,
      isUnassigned: true,
    }]
    : assignedEntries;

  return {
    assignedApplicationCount,
    unassignedApplicationCount,
    distinctAssignedResumeCount: assignedEntries.length,
    entries,
  };
}
