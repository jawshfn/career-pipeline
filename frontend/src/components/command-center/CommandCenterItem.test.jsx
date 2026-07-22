// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenterItem from "./CommandCenterItem.jsx";

const application = { id: 1, company_name: "Silverline Careers Group", follow_up_date: "2026-07-25", role_title: "Entry Level Product Analyst", status: "Applied" };

describe("CommandCenterItem", () => {
  let container; let root;
  beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it("keeps application navigation and reminder management as separate buttons", async () => {
    const onOpenApplication = vi.fn(); const onManageReminder = vi.fn();
    await act(async () => root.render(<CommandCenterItem application={application} onManageReminder={onManageReminder} onOpenApplication={onOpenApplication} />));
    const openButton = container.querySelector(".command-center-application-link");
    expect(openButton.tagName).toBe("BUTTON"); expect(openButton.getAttribute("aria-label")).toBe("Open Silverline Careers Group — Entry Level Product Analyst"); expect(container.textContent).toContain("Applied");
    await act(async () => openButton.click()); expect(onOpenApplication).toHaveBeenCalledWith(application); expect(onManageReminder).not.toHaveBeenCalled();
    await act(async () => container.querySelector(".command-center-manage-reminder").click()); expect(onManageReminder).toHaveBeenCalledWith(application); expect(onOpenApplication).toHaveBeenCalledTimes(1);
  });

  it("offers navigation but no reminder action for needs check-in applications", async () => {
    await act(async () => root.render(<CommandCenterItem application={{ ...application, follow_up_date: null }} onOpenApplication={vi.fn()} showUpdatedAt />));
    expect(container.querySelector(".command-center-application-link")).not.toBeNull(); expect(container.querySelector(".command-center-manage-reminder")).toBeNull();
  });
});
