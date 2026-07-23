// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ApplicationsTable from "./ApplicationsTable.jsx";

const applications = [
  { id: 1, company_name: "Eligible Co", role_title: "Developer", job_description: "x".repeat(200), status: "Applied" },
  { id: 2, company_name: "No Snapshot Co", role_title: "Analyst", job_description: "", status: "Saved", notes: "Review later" },
];

describe("ApplicationsTable AI-ready controls", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderTable(isDemoMode, onOpenDetails = vi.fn()) {
    await act(async () => root.render(<ApplicationsTable applications={applications} isDemoMode={isDemoMode} onOpenDetails={onOpenDetails} resumeVersions={[]} />));
    return onOpenDetails;
  }

  it("shows the control only for eligible demo applications and opens the AI Brief", async () => {
    const onOpenDetails = await renderTable(true);
    const readyButton = container.querySelector(".ai-ready-button");

    expect(readyButton.textContent).toBe("AI-ready");
    expect(readyButton.title).toBe("Open the AI Brief for this demo application");
    await act(async () => readyButton.click());
    expect(onOpenDetails).toHaveBeenCalledWith(1, "ai-brief");
    expect(container.querySelectorAll(".ai-ready-button")).toHaveLength(1);
  });

  it("does not show AI-ready controls outside demo mode and preserves notes and edit actions", async () => {
    const onOpenDetails = await renderTable(false);

    expect(container.querySelector(".ai-ready-button")).toBeNull();
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Notes").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit").click());
    expect(onOpenDetails).toHaveBeenCalledWith(2, "job-details");
    expect(onOpenDetails).toHaveBeenCalledWith(1);
  });
});
