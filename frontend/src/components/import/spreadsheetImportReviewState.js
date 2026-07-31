export const REVIEW_CATEGORIES = ["All", "Ready", "Needs review", "Possible duplicate", "Excluded"];
export const REVIEW_PAGE_SIZE = 50;

export function createInitialReviewState() {
  return {
    rows: null,
    valueMappings: {},
    dateOrders: {},
    rowOverrides: {},
    rowDecisions: {},
    filter: "All",
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
  if (row.excluded) return "Excluded";
  if (row.issues.length) return "Needs review";
  if (row.duplicate && !row.allowDuplicate) return "Possible duplicate";
  return "Ready";
}

export function updateRowReviewState({ rowOverrides, rowDecisions }, rowNumber, change) {
  const nextOverrides = change.values
    ? { ...rowOverrides, [rowNumber]: { ...(rowOverrides[rowNumber] || {}), ...change.values } }
    : rowOverrides;
  const decision = {
    ...(rowDecisions[rowNumber] || {}),
    ...Object.fromEntries(
      ["excluded", "allowDuplicate"]
        .filter((key) => Object.hasOwn(change, key))
        .map((key) => [key, change[key]]),
    ),
  };

  if (change.values && Object.keys(change.values).some((key) => ["company_name", "role_title", "job_link", "date_applied"].includes(key))) {
    delete decision.allowDuplicate;
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
  const blocking = included.filter((row) => row.issues.length || (row.duplicate?.highConfidence && !row.allowDuplicate));
  const normalizedSearch = search.toLowerCase();
  const filtered = reviewRows.filter((row) => (
    (filter === "All" || reviewStateFor(row) === filter)
    && `${row.values.company_name || ""} ${row.values.role_title || ""}`.toLowerCase().includes(normalizedSearch)
  ));
  const pageCount = Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * REVIEW_PAGE_SIZE, (currentPage + 1) * REVIEW_PAGE_SIZE);
  const unresolved = reviewRows
    .flatMap((row) => row.issues.filter((issue) => issue.raw).map((issue) => ({ ...issue, row })))
    .filter((issue, index, list) => list.findIndex((item) => item.field === issue.field && item.raw === issue.raw) === index);

  return { reviewRows, included, blocking, filtered, pageRows, unresolved, currentPage };
}
