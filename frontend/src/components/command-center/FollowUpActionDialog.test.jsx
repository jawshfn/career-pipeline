// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowUpActionDialog from "./FollowUpActionDialog.jsx";

const application = { id: 1, company_name: "Northstar Analytics", role_title: "Platform Engineer", status: "Interview", follow_up_date: "2026-07-25", next_action: "Check for a recruiter response." };

describe("FollowUpActionDialog", () => {
  let container; let root; let onSubmit;
  beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); onSubmit = vi.fn(); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  async function render(props = {}) { await act(async () => root.render(<FollowUpActionDialog application={application} isOpen onCancel={vi.fn()} onSubmit={onSubmit} {...props} />)); }
  const select = async (value) => act(async () => container.querySelector(`input[value="${value}"]`).click());
  const confirm = async () => act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Mark complete") || button.textContent.includes("Complete & schedule") || button.textContent === "Reschedule" || button.textContent.includes("Clear reminder")).click());

  it("renders context in the wide shared dialog with no selected action", async () => {
    await render(); const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.classList.contains("confirmation-dialog-wide")).toBe(true); expect(dialog.textContent).toContain(application.company_name); expect(dialog.textContent).toContain(application.role_title); expect(dialog.textContent).toContain("Current follow-up: Jul 25, 2026"); expect(dialog.textContent).not.toContain("Activity note"); expect(dialog.querySelectorAll("textarea")).toHaveLength(0); expect(dialog.querySelectorAll('input[name="follow-up-action"]:checked')).toHaveLength(0); expect([...dialog.querySelectorAll("button")].find((button) => button.textContent.includes("Choose an action")).disabled).toBe(true);
  });

  it("builds complete payloads with omitted, updated, and cleared Next Action values", async () => {
    await render(); await select("complete"); await confirm();
    expect(onSubmit).toHaveBeenLastCalledWith({ action: "complete", expected_follow_up_date: "2026-07-25" }, "Follow-up marked complete."); expect(onSubmit.mock.lastCall[0]).not.toHaveProperty("activity_note");
    await select("complete"); await act(async () => [...container.querySelectorAll('input[name="next-action-mode"]')].find((input) => input.parentElement.textContent.includes("Update")).click()); expect(container.textContent).toContain("New Next Action"); expect(container.textContent).not.toContain("Updated Next Action");
    await act(async () => { const textarea = container.querySelector("textarea"); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, "  Email the recruiter.  "); textarea.dispatchEvent(new Event("input", { bubbles: true })); }); await confirm();
    expect(onSubmit).toHaveBeenLastCalledWith({ action: "complete", expected_follow_up_date: "2026-07-25", next_action: "Email the recruiter." }, "Follow-up marked complete."); expect(onSubmit.mock.lastCall[0]).not.toHaveProperty("activity_note");
    await act(async () => [...container.querySelectorAll('input[name="next-action-mode"]')].find((input) => input.parentElement.textContent.includes("Clear")).click()); await confirm();
    expect(onSubmit).toHaveBeenLastCalledWith({ action: "complete", expected_follow_up_date: "2026-07-25", next_action: null }, "Follow-up marked complete."); expect(onSubmit.mock.lastCall[0]).not.toHaveProperty("activity_note");
  });

  it("populates quick dates and requires a valid reschedule date", async () => {
    await render(); await select("reschedule"); const dateInput = container.querySelector('input[type="date"]');
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "In 3 days").click()); expect(dateInput.value).not.toBe("");
    await act(async () => { dateInput.value = application.follow_up_date; dateInput.dispatchEvent(new Event("change", { bubbles: true })); }); await confirm(); expect(container.textContent).toContain("different from the current reminder");
  });

  it("builds schedule, reschedule, and clear payloads without an activity note", async () => {
    await render(); await select("complete_and_schedule");
    await act(async () => { const input = container.querySelector('input[type="date"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "2099-01-02"); input.dispatchEvent(new Event("input", { bubbles: true })); }); await confirm();
    expect(onSubmit).toHaveBeenLastCalledWith({ action: "complete_and_schedule", expected_follow_up_date: "2026-07-25", follow_up_date: "2099-01-02" }, "Follow-up completed and next reminder scheduled."); expect(onSubmit.mock.lastCall[0]).not.toHaveProperty("activity_note");
    await select("reschedule"); await act(async () => { const input = container.querySelector('input[type="date"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "2099-01-03"); input.dispatchEvent(new Event("input", { bubbles: true })); }); await confirm();
    expect(onSubmit).toHaveBeenLastCalledWith({ action: "reschedule", expected_follow_up_date: "2026-07-25", follow_up_date: "2099-01-03" }, "Follow-up rescheduled."); expect(onSubmit.mock.lastCall[0]).not.toHaveProperty("activity_note");
    await select("clear"); await confirm();
    expect(onSubmit).toHaveBeenLastCalledWith({ action: "clear", expected_follow_up_date: "2026-07-25" }, "Follow-up cleared."); expect(onSubmit.mock.lastCall[0]).not.toHaveProperty("activity_note");
  });

  it("disables mutating controls when processing or conflicted", async () => {
    await render({ hasStateConflict: true });
    expect([...container.querySelectorAll('input[name="follow-up-action"]')].every((input) => input.matches(":disabled"))).toBe(true);
    expect([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Choose an action")).disabled).toBe(true);
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Close")).not.toBeNull();
  });

  it("does not offer a meaningless Next Action clear choice", async () => {
    await render({ application: { ...application, next_action: null } });
    expect([...container.querySelectorAll('input[name="next-action-mode"]')].some((input) => input.parentElement.textContent.includes("Clear"))).toBe(false); expect(container.textContent).toContain("No next action");
  });

  it("resets state when reopened or switched to another application", async () => {
    await render(); await select("reschedule");
    await render({ isOpen: false }); await render();
    expect(container.querySelectorAll('input[name="follow-up-action"]:checked')).toHaveLength(0);
    const anotherApplication = { ...application, id: 2, next_action: "Prepare portfolio links." };
    await select("complete"); await render({ application: anotherApplication });
    expect(container.querySelectorAll('input[name="follow-up-action"]:checked')).toHaveLength(0); expect(container.textContent).toContain("Prepare portfolio links.");
  });
});
