// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DailyRemindersHeader, {
  formatFullLocalDate,
  formatLocalClock,
  formatLocalDateValue,
  getLocalGreeting,
} from "./DailyRemindersHeader.jsx";

describe("DailyRemindersHeader", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.clearAllTimers();
    container.remove();
    vi.useRealTimers();
  });

  it.each([
    [4, 59, "Welcome back"],
    [5, 0, "Good morning"],
    [11, 59, "Good morning"],
    [12, 0, "Good afternoon"],
    [16, 59, "Good afternoon"],
    [17, 0, "Good evening"],
    [21, 59, "Good evening"],
    [22, 0, "Welcome back"],
  ])("uses the correct greeting at %i:%i", (hour, minute, greeting) => {
    expect(getLocalGreeting(new Date(2026, 6, 22, hour, minute))).toBe(greeting);
  });

  it("uses browser-local formatters and semantic local date and time markup", () => {
    const date = new Date(2026, 6, 22, 0, 54);
    vi.setSystemTime(date);
    act(() => root.render(<DailyRemindersHeader />));

    expect(formatLocalClock(date)).toBe(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date));
    expect(formatFullLocalDate(date)).toBe(new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    }).format(date));
    expect(formatLocalDateValue(date)).toBe("2026-07-22");
    expect(container.textContent).toContain("Reminders");
    expect(container.textContent).toContain("Local time");
    expect(container.querySelector("h2").textContent).toBe("Welcome back");

    const [clock, calendarDate] = container.querySelectorAll("time");
    expect(clock.textContent).toBe(formatLocalClock(date));
    expect(clock.getAttribute("aria-live")).toBeNull();
    expect(calendarDate.textContent).toBe(formatFullLocalDate(date));
    expect(calendarDate.dateTime).toBe("2026-07-22");
    expect(container.querySelector(".command-center-time-panel").getAttribute("aria-label")).toBe("Current local date and time");
    expect(container.textContent).not.toMatch(/\b(?:EST|EDT|UTC|GMT)\b/);
  });

  it("updates at minute boundaries, including greeting changes", () => {
    vi.setSystemTime(new Date(2026, 6, 22, 11, 59, 30));
    act(() => root.render(<DailyRemindersHeader />));

    expect(container.querySelector("h2").textContent).toBe("Good morning");
    expect(container.querySelector(".command-center-current-time").textContent).toBe(formatLocalClock(new Date()));

    act(() => vi.advanceTimersByTime(30000));
    expect(container.querySelector("h2").textContent).toBe("Good afternoon");
    expect(container.querySelector(".command-center-current-time").textContent).toBe(formatLocalClock(new Date()));

    act(() => vi.advanceTimersByTime(60000));
    expect(container.querySelector(".command-center-current-time").textContent).toBe(formatLocalClock(new Date()));

  });

  it("updates the local date after midnight", () => {
    vi.setSystemTime(new Date(2026, 6, 22, 23, 59, 30));
    act(() => root.render(<DailyRemindersHeader />));

    act(() => vi.advanceTimersByTime(30000));
    expect(container.querySelector(".command-center-current-date").textContent).toBe(formatFullLocalDate(new Date()));
    expect(container.querySelector(".command-center-current-date").dateTime).toBe("2026-07-23");
  });

  it("cleans up scheduled updates on unmount", () => {
    vi.setSystemTime(new Date(2026, 6, 22, 9, 15, 10));
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    act(() => root.render(<DailyRemindersHeader />));
    const clockBeforeUnmount = container.querySelector(".command-center-current-time").textContent;

    act(() => root.unmount());
    vi.advanceTimersByTime(120000);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(container.textContent).toBe("");
    expect(clockBeforeUnmount).toBe(formatLocalClock(new Date(2026, 6, 22, 9, 15, 10)));
  });
});
