export const REVIEW_CATEGORIES = ["All", "Included", "Needs attention", "Ready", "Needs review", "Possible duplicate", "Exact duplicates", "Excluded"];
export const REVIEW_STATE_CATEGORIES = ["Ready", "Needs review", "Possible duplicate", "Exact duplicate — skipped", "Imported as new", "Excluded"];
export const REVIEW_PAGE_SIZE = 50;
export const BULK_RESOLUTION_KINDS = ["status", "source", "employment_type", "highest_confirmed_stage", "date_saved", "date_applied", "follow_up_date", "resume_version_name"];

const FIELD_LABELS = Object.freeze({
  company_name: "Company", role_title: "Role", status: "Status", source: "Source",
  employment_type: "Employment Type", highest_confirmed_stage: "Highest Stage Reached",
  date_saved: "Date Saved", date_applied: "Date Applied", follow_up_date: "Follow-up Date",
  resume_version_id: "Resume Version", resume_version_name: "Resume Version", job_link: "Job Link",
  location: "Location", compensation: "Compensation", next_action: "Next Action",
  contact_name: "Contact Name", contact_info: "Contact Information", prep_notes: "Preparation Notes",
  notes: "Personal Notes", job_description: "Job Description", red_flags_notes: "Red-Flag Notes",
  import: "Import",
});

const MODELED_FIELDS = new Set(Object.keys(FIELD_LABELS).filter((field) => field !== "import" && field !== "resume_version_name"));
const ISSUE_FIELD_ALIASES = Object.freeze({ resume_version_name: "resume_version_id" });
const BACKEND_DEPENDENCIES = Object.freeze({
  status: ["date_applied", "highest_confirmed_stage"],
  date_applied: ["status", "highest_confirmed_stage"],
  highest_confirmed_stage: ["status", "date_applied"],
});
const ISSUE_FIELD_RULES = Object.freeze({
  "Saved applications cannot have a Date Applied.": ["status", "date_applied"],
  "Choose whether this terminal application was submitted.": ["status", "date_applied", "highest_confirmed_stage"],
  "A submitted terminal application must have reached at least Applied.": ["date_applied", "highest_confirmed_stage"],
  "Highest Stage Reached cannot be below current status.": ["status", "highest_confirmed_stage"],
});

export function reviewFieldLabel(field) {
  return FIELD_LABELS[field] || String(field || "Import issue").replace(/_/gu, " ");
}

export function duplicateReviewDescription(duplicate) {
  const confidence = duplicate?.confidence;
  const reason = duplicate?.reason;
  const sourceRow = Number.isInteger(duplicate?.sourceRowNumber) ? `spreadsheet row ${duplicate.sourceRowNumber}` : "another spreadsheet row";
  if (duplicate?.scope === "in_batch") {
    if (reason === "job_link") return `Exact Job Link match with ${sourceRow}.`;
    if (reason === "company_role_date") return `Matches ${sourceRow} with the same company, role, and Date Applied.`;
    if (reason === "company_role") return `Possible match with ${sourceRow}: same company and role.`;
    return confidence === "exact" ? `Exact match with ${sourceRow}.` : `Possible match with ${sourceRow}.`;
  }
  if (duplicate?.scope === "existing") {
    const application = duplicate.application;
    const company = application?.company_name || "an existing application";
    const role = application?.role_title;
    const context = role ? `${company} — ${role}` : company;
    if (reason === "job_link") return `Exact Job Link match with ${context}.`;
    if (reason === "company_role_date") return `Matches an existing application with the same company, role, and Date Applied: ${context}.`;
    if (reason === "company_role") return `Possible match with an existing application: ${context}.`;
    return confidence === "exact" ? `Exact match with an existing application: ${context}.` : `Possible match with an existing application: ${context}.`;
  }
  return confidence === "exact" ? "This row has an exact duplicate match." : "This row may match another application.";
}

export function fieldsNeededForIssues(row) {
  const fields = [];
  const add = (field) => {
    const modeledField = ISSUE_FIELD_ALIASES[field] || field;
    if (MODELED_FIELDS.has(modeledField) && !fields.includes(modeledField)) fields.push(modeledField);
  };

  (row?.issues || []).forEach((issue) => {
    const ruleFields = ISSUE_FIELD_RULES[issue.message];
    if (ruleFields) {
      ruleFields.forEach(add);
      return;
    }
    const field = ISSUE_FIELD_ALIASES[issue.field] || issue.field;
    if (!MODELED_FIELDS.has(field)) return;
    add(field);
    if (!issue.kind) (BACKEND_DEPENDENCIES[field] || []).forEach(add);
  });
  return fields;
}

export function bulkResolutionIssuesFor(rows) {
  const grouped = new Map();
  (rows || []).forEach((row) => {
    (row.issues || []).forEach((issue) => {
      if (!issue.raw || !BULK_RESOLUTION_KINDS.includes(issue.kind)) return;
      if (["date_saved", "date_applied", "follow_up_date"].includes(issue.kind) && !issue.message.startsWith("Choose the date order")) return;
      const key = `${issue.kind}\u0000${issue.raw}`;
      const current = grouped.get(key) || { ...issue, rows: [] };
      if (!current.rows.some((item) => item.sourceRowNumber === row.sourceRowNumber)) current.rows.push(row);
      grouped.set(key, current);
    });
  });
  return [...grouped.values()];
}

export function createInitialReviewState() {
  return {
    rows: null,
    valueMappings: {},
    dateOrders: {},
    rowOverrides: {},
    rowDecisions: {},
    filter: "Included",
    search: "",
    page: 0,
    editing: null,
    confirming: false,
    importing: false,
    summary: null,
    submissionIssues: {},
  };
}

export function reviewStateFor(row) {
  if (row.duplicate?.confidence === "exact") return row.allowDuplicate && !row.excluded ? "Imported as new" : "Exact duplicate — skipped";
  if (row.excluded) return "Excluded";
  if (row.issues.length) return "Needs review";
  if ((row.duplicate?.confidence === "possible" || (row.duplicate && !row.duplicate.confidence)) && row.duplicateDecision !== "keep_in_import") return "Possible duplicate";
  return "Ready";
}

export function updateRowReviewState({ rowOverrides, rowDecisions }, rowNumber, change) {
  const nextRowOverrides = { ...(rowOverrides[rowNumber] || {}), ...(change.values || {}) };
  (change.clearValues || []).forEach((key) => delete nextRowOverrides[key]);
  const nextOverrides = change.values || change.clearValues
    ? { ...rowOverrides, [rowNumber]: nextRowOverrides }
    : rowOverrides;
  const decision = {
    ...(rowDecisions[rowNumber] || {}),
    ...Object.fromEntries(
      ["excluded", "allowDuplicate", "duplicateDecision"]
        .filter((key) => Object.hasOwn(change, key))
        .map((key) => [key, change[key]]),
    ),
  };

  if ((change.values || change.clearValues) && [...Object.keys(change.values || {}), ...(change.clearValues || [])].some((key) => ["company_name", "role_title", "job_link", "date_applied"].includes(key))) {
    if (["skip_exact", "import_as_new", "exclude"].includes(decision.duplicateDecision)) delete decision.excluded;
    delete decision.allowDuplicate;
    delete decision.duplicateDecision;
  }

  return { rowOverrides: nextOverrides, rowDecisions: { ...rowDecisions, [rowNumber]: decision } };
}

export function submissionIssuesFor(error) {
  const rowErrors = error?.detail?.row_errors;
  if (!Array.isArray(rowErrors)) return {};
  return rowErrors.reduce((issues, item) => {
    if (!Number.isInteger(item?.source_row_number) || !item.message) return issues;
    const rowIssues = issues[item.source_row_number] || [];
    return { ...issues, [item.source_row_number]: [...rowIssues, { field: item.field || "import", message: item.message }] };
  }, {});
}

export function deriveReview({ rows, submissionIssues, filter, search, page }) {
  const reviewRows = (rows || []).map((row) => ({
    ...row,
    issues: [...row.issues, ...(submissionIssues[row.sourceRowNumber] || [])],
  }));
  const included = reviewRows.filter((row) => !row.excluded);
  const blocking = included.filter((row) => row.issues.length || (row.duplicate?.confidence === "exact" && !row.allowDuplicate) || (row.duplicate?.confidence === "possible" && row.duplicateDecision !== "keep_in_import"));
  const normalizedSearch = search.toLowerCase();
  const filtered = reviewRows.filter((row) => (
    (filter === "All" || (filter === "Included" && !row.excluded) || (filter === "Needs attention" && !row.excluded && (row.issues.length || (row.duplicate?.confidence === "possible" && row.duplicateDecision !== "keep_in_import") || (row.duplicate?.confidence === "exact" && !row.allowDuplicate))) || (filter === "Exact duplicates" && row.duplicate?.confidence === "exact") || reviewStateFor(row) === filter)
    && `${row.values.company_name || ""} ${row.values.role_title || ""}`.toLowerCase().includes(normalizedSearch)
  ));
  const pageCount = Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * REVIEW_PAGE_SIZE, (currentPage + 1) * REVIEW_PAGE_SIZE);
  const unresolved = bulkResolutionIssuesFor(included);
  const excludedUnresolved = bulkResolutionIssuesFor(reviewRows.filter((row) => row.excluded));

  return { reviewRows, included, blocking, filtered, pageRows, unresolved, excludedUnresolved, currentPage, pageCount };
}

export function initialReviewFilter(rows) {
  const included = (rows || []).filter((row) => !row.excluded);
  if (included.some((row) => row.issues.length || (row.duplicate?.confidence === "possible" && row.duplicateDecision !== "keep_in_import"))) return "Needs attention";
  if (included.length) return "Included";
  return (rows || []).some((row) => row.duplicate?.confidence === "exact") ? "Exact duplicates" : "All";
}

export function deriveImportWorkflowSteps({ file, table, tableSetupError = "", tableSetupDetail, mappingConfirmed, mappingNeedsAttention, mappedCount = 0, ignoredCount = 0, includedCount = 0, blockingCount = 0, possibleDuplicateCount = 0, importing = false, importComplete = false }) {
  const reviewNeedsAttention = mappingConfirmed && (!includedCount || blockingCount);
  const currentId = importComplete ? "import" : !file ? "upload" : !table ? "structure" : !mappingConfirmed ? "mapping" : reviewNeedsAttention ? "review" : "import";
  const steps = [
    { id: "upload", label: "1 Upload file", status: file ? "Complete" : "Current" },
    { id: "structure", label: "2 Table setup", status: !file ? "Locked" : tableSetupError ? "Needs attention" : table ? "Complete" : "Current", detail: tableSetupError ? tableSetupDetail : undefined },
    { id: "mapping", label: "3 Map columns", status: !table ? "Locked" : mappingConfirmed ? "Complete" : mappingNeedsAttention ? "Needs attention" : "Current", detail: mappingConfirmed ? `${mappedCount} mapped · ${ignoredCount} ignored` : undefined },
    { id: "review", label: "4 Review rows", status: !mappingConfirmed ? "Locked" : !includedCount ? "Needs attention" : blockingCount ? "Needs attention" : "Complete", detail: !mappingConfirmed ? undefined : !includedCount ? "No rows included" : blockingCount ? `${blockingCount} ${blockingCount === 1 ? "row needs" : "rows need"} review` : possibleDuplicateCount ? `${possibleDuplicateCount} possible duplicate ${possibleDuplicateCount === 1 ? "warning" : "warnings"}` : undefined },
    { id: "import", label: "5 Import", status: importComplete ? "Complete" : !mappingConfirmed || !includedCount || blockingCount ? "Locked" : importing ? "Importing" : "Ready", detail: importComplete ? undefined : !mappingConfirmed ? "Complete review first" : !includedCount ? "No rows included" : blockingCount ? `${blockingCount} ${blockingCount === 1 ? "row still needs" : "rows still need"} review` : importing ? "Submitting applications" : `${includedCount} ${includedCount === 1 ? "application" : "applications"} ready` },
  ];
  return steps.map((step) => ({ ...step, current: step.id === currentId, clickable: step.status !== "Locked" }));
}
