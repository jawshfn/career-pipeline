import { beforeEach, describe, expect, it } from "vitest";

import {
  createDemoApplication,
  getDemoActionItems,
  getDemoDashboardSummary,
  resetDemoState,
} from "./demoStore.js";

function formatDateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getCard(summary, key) {
  return summary.summary_cards.find((card) => card.key === key);
}

function createApplication(payload) {
  return createDemoApplication({
    company_name: "Dashboard demo company",
    role_title: "Dashboard demo role",
    ...payload,
  });
}

describe("demo dashboard follow-up metrics", () => {
  beforeEach(() => resetDemoState());

  it("counts only actionable overdue and upcoming follow-ups", () => {
    const baseline = getDemoDashboardSummary();
    const baselineOverdue = getCard(baseline, "overdue_followups").value;
    const baselineUpcoming = getCard(baseline, "upcoming_followups").value;
    const baselineClosed = getCard(baseline, "closed_applications").value;

    createApplication({ follow_up_date: formatDateOffset(-1) });
    createApplication({ status: "Rejected", follow_up_date: formatDateOffset(-1) });
    createApplication({ status: "Withdrawn", follow_up_date: formatDateOffset(-1) });
    createApplication({ status: "Offer", follow_up_date: formatDateOffset(0) });
    createApplication({ status: "Rejected", follow_up_date: formatDateOffset(0) });
    createApplication({ status: "Withdrawn", follow_up_date: formatDateOffset(3) });
    createApplication({ follow_up_date: formatDateOffset(4) });
    createApplication({ status: "Archived", follow_up_date: formatDateOffset(-1) });

    const summary = getDemoDashboardSummary();
    const actionItems = getDemoActionItems();

    expect(getCard(summary, "overdue_followups").value).toBe(baselineOverdue + 1);
    expect(getCard(summary, "upcoming_followups").value).toBe(baselineUpcoming + 1);
    expect(getCard(summary, "closed_applications").value).toBe(baselineClosed + 4);
    expect(actionItems.overdue_followups).toHaveLength(getCard(summary, "overdue_followups").value);
    expect(actionItems.upcoming_followups).toHaveLength(getCard(summary, "upcoming_followups").value);
  });
});
