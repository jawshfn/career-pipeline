import { beforeEach, describe, expect, it } from "vitest";

import { applyDemoFollowUpAction, createDemoApplication, getDemoActivities, resetDemoState } from "./demoStore.js";

describe("demo follow-up actions", () => {
  beforeEach(() => resetDemoState());

  function createFollowUpApplication() {
    const today = new Date();
    const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return createDemoApplication({ company_name: "Northstar", role_title: "Developer", follow_up_date: value, next_action: "Keep this" });
  }

  it("updates and logs a single complete action atomically", () => {
    const application = createFollowUpApplication();
    const result = applyDemoFollowUpAction(application.id, { action: "complete", expected_follow_up_date: application.follow_up_date });
    expect(result.application.follow_up_date).toBeNull();
    expect(result.application.next_action).toBe("Keep this");
    expect(result.activity.note).toBe("Completed follow-up.");
    expect(getDemoActivities(application.id)).toHaveLength(1);
  });

  it("supports scheduling, rescheduling, clear, next action values, and stale conflicts", () => {
    const application = createFollowUpApplication();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const target = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const scheduled = applyDemoFollowUpAction(application.id, { action: "complete_and_schedule", expected_follow_up_date: application.follow_up_date, follow_up_date: target, next_action: "  Send note  " });
    expect(scheduled.application.next_action).toBe("Send note");
    expect(() => applyDemoFollowUpAction(application.id, { action: "clear", expected_follow_up_date: application.follow_up_date })).toThrow("changed after it was loaded");
    const cleared = applyDemoFollowUpAction(application.id, { action: "clear", expected_follow_up_date: target, next_action: null });
    expect(cleared.application.next_action).toBeNull();
    expect(getDemoActivities(application.id)).toHaveLength(2);
  });
});
