// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/applications/ApplicationDetailPanel.jsx", () => ({
  default: ({ initialTab, onClose }) => <div data-testid="application-detail">Detail tab: {initialTab}<button type="button" onClick={onClose}>Close</button></div>,
}));

import ApplicationsPage from "./ApplicationsPage.jsx";

function getLocalDate(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const applications = [
  {
    company_name: "Northstar Analytics",
    date_applied: "2026-07-10",
    date_saved: "2026-07-09",
    follow_up_date: getLocalDate(-3),
    id: 1,
    location: "Remote",
    notes: "Ask about the platform team.",
    role_title: "Platform Engineer",
    source: "Company Website",
    status: "Applied",
    updated_at: "2026-07-14",
    vague_job_description: true,
  },
  {
    company_name: "Cedar Labs",
    date_applied: "2026-07-08",
    date_saved: "2026-07-07",
    follow_up_date: getLocalDate(0),
    id: 2,
    location: "New York, NY",
    notes: "",
    role_title: "Product Designer",
    source: "Referral",
    status: "Interview",
    updated_at: "2026-07-13",
  },
  {
    company_name: "Harbor Works",
    date_applied: "2026-06-20",
    date_saved: "2026-06-19",
    follow_up_date: null,
    id: 3,
    location: "Boston, MA",
    notes: "Closed application notes.",
    role_title: "Data Analyst",
    source: "LinkedIn",
    status: "Rejected",
    updated_at: "2026-07-12",
  },
  {
    company_name: "Summit Systems",
    date_applied: "2026-07-11",
    date_saved: "2026-07-10",
    follow_up_date: getLocalDate(3),
    id: 4,
    location: "Chicago, IL",
    notes: "",
    role_title: "Security Engineer",
    source: "Company Website",
    status: "Saved",
    updated_at: "2026-07-11",
  },
];

function clickButton(container, label) {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent.includes(label));
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function setControlValue(control, value) {
  const setValue = Object.getOwnPropertyDescriptor(control.constructor.prototype, "value").set;
  setValue.call(control, value);
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ApplicationsPage", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.requestAnimationFrame = vi.fn((callback) => callback());
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete HTMLElement.prototype.scrollIntoView;
    vi.unstubAllGlobals();
  });

  async function renderApplications() {
    await act(async () => {
      root.render(
        <ApplicationsPage
          applications={applications}
          error=""
          isLoading={false}
          onUnsavedChangesChange={vi.fn()}
          onUpdateApplication={vi.fn()}
          resumeVersions={[]}
        />,
      );
    });
  }

  it("switches between Active, Closed, and All application views", async () => {
    await renderApplications();
    expect(container.textContent).toContain("Northstar Analytics");
    expect(container.textContent).not.toContain("Harbor Works");

    await act(async () => clickButton(container, "Closed"));
    expect(container.textContent).toContain("Harbor Works");
    expect(container.textContent).not.toContain("Northstar Analytics");

    await act(async () => clickButton(container, "All"));
    expect(container.textContent).toContain("Northstar Analytics");
    expect(container.textContent).toContain("Harbor Works");
  });

  it("supports search, sorting, advanced filters, and clear filters", async () => {
    await renderApplications();
    const clear = [...container.querySelectorAll("button")].find((button) => button.textContent === "Clear filters");
    expect(clear.disabled).toBe(true);

    const search = container.querySelector('input[name="search"]');
    await act(async () => setControlValue(search, "Cedar"));
    expect(container.textContent).toContain("Cedar Labs");
    expect(clear.disabled).toBe(false);

    await act(async () => clickButton(container, "More filters"));
    expect(container.querySelector("#applications-advanced-filters")).not.toBeNull();
    const source = container.querySelector('select[name="source"]');
    await act(async () => setControlValue(source, "Referral"));
    expect(container.textContent).toContain("Cedar Labs");

    const sort = container.querySelector('select[name="sortBy"]');
    await act(async () => setControlValue(sort, "company_asc"));
    await act(async () => clear.click());
    expect(search.value).toBe("");
    expect(clear.disabled).toBe(true);
  });

  it("keeps follow-up labels, flags, notes, edit actions, and mobile data labels", async () => {
    await renderApplications();

    expect(container.textContent).toContain("Overdue");
    expect(container.textContent).toContain("Due today");
    expect(container.querySelector(".follow-up-future")).not.toBeNull();
    expect(container.querySelector(".applications-table .red-flag-indicator")).not.toBeNull();
    ["Opportunity", "Status", "Applied", "Follow-up", "Resume", "Flags", "Notes", "Actions"].forEach((label) => {
      expect(container.querySelector(`[data-label="${label}"]`)).not.toBeNull();
    });

    await act(async () => clickButton(container, "Notes"));
    expect(container.querySelector('[data-testid="application-detail"]').textContent).toContain("job-details");
    await act(async () => clickButton(container, "Edit"));
    expect(container.querySelector('[data-testid="application-detail"]').textContent).toContain("overview");
  });

  it("shows the filtered empty state", async () => {
    await renderApplications();
    const search = container.querySelector('input[name="search"]');
    await act(async () => setControlValue(search, "No matching opportunity"));

    expect(container.textContent).toContain("No applications match your current filters.");
  });

  it("opens the featured demo application on the AI Brief tab once", async () => {
    const onFeaturedApplicationPresented = vi.fn();
    await act(async () => {
      root.render(
        <ApplicationsPage
          applications={applications}
          error=""
          featuredApplicationId={3}
          isDemoMode
          isLoading={false}
          onFeaturedApplicationPresented={onFeaturedApplicationPresented}
          onUnsavedChangesChange={vi.fn()}
          onUpdateApplication={vi.fn()}
          resumeVersions={[]}
        />,
      );
    });

    expect(container.querySelector('[data-testid="application-detail"]').textContent).toContain("ai-brief");
    expect(onFeaturedApplicationPresented).toHaveBeenCalledTimes(1);

    await act(async () => clickButton(container, "Close"));
    expect(container.querySelector('[data-testid="application-detail"]')).toBeNull();
  });

  it("keeps an explicitly requested application ahead of the featured demo", async () => {
    const onFeaturedApplicationPresented = vi.fn();
    await act(async () => {
      root.render(
        <ApplicationsPage
          applications={applications}
          error=""
          featuredApplicationId={3}
          isDemoMode
          isLoading={false}
          onFeaturedApplicationPresented={onFeaturedApplicationPresented}
          onRequestedApplicationHandled={vi.fn()}
          onUnsavedChangesChange={vi.fn()}
          onUpdateApplication={vi.fn()}
          requestedApplicationId={2}
          resumeVersions={[]}
        />,
      );
    });

    expect(container.querySelector('[data-testid="application-detail"]').textContent).toContain("overview");
    expect(onFeaturedApplicationPresented).not.toHaveBeenCalled();
  });

  it("pins Harborview only for the default demo sort without overriding filters", async () => {
    const activeApplications = applications.map((application) => (
      application.id === 3 ? { ...application, status: "Interview" } : application
    ));
    await act(async () => {
      root.render(
        <ApplicationsPage
          applications={activeApplications}
          error=""
          featuredApplicationId={3}
          isDemoMode
          isLoading={false}
          onUnsavedChangesChange={vi.fn()}
          onUpdateApplication={vi.fn()}
          resumeVersions={[]}
        />,
      );
    });

    expect(container.querySelector("tbody tr .opportunity-company").textContent).toBe("Harbor Works");
    const sort = container.querySelector('select[name="sortBy"]');
    await act(async () => setControlValue(sort, "company_asc"));
    expect(container.querySelector("tbody tr .opportunity-company").textContent).toBe("Cedar Labs");

    const search = container.querySelector('input[name="search"]');
    await act(async () => setControlValue(search, "Northstar"));
    expect(container.querySelector("tbody tr .opportunity-company").textContent).toBe("Northstar Analytics");
    expect(container.textContent).not.toContain("Harbor Works");
  });
});
