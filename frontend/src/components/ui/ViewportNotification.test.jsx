// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ViewportNotification from "./ViewportNotification.jsx";

describe("ViewportNotification", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll(".viewport-notification").forEach((element) => element.remove());
    vi.useRealTimers();
  });

  it("renders a polite status notification through a body portal", async () => {
    await act(async () => root.render(<ViewportNotification message="Application saved." onDismiss={vi.fn()} />));
    const notification = document.body.querySelector(".viewport-notification");
    expect(notification.textContent).toBe("Application saved.");
    expect(notification.getAttribute("role")).toBe("status");
    expect(notification.classList).toContain("viewport-notification-success");
    expect(notification.parentElement).toBe(document.body);
    expect(container.querySelector(".viewport-notification")).toBeNull();
  });

  it("uses the destructive-success modifier while remaining a polite status", async () => {
    await act(async () => root.render(<ViewportNotification message="Activity deleted." onDismiss={vi.fn()} tone="destructive-success" />));
    const notification = document.body.querySelector(".viewport-notification");
    expect(notification.classList).toContain("viewport-notification-destructive-success");
    expect(notification.getAttribute("role")).toBe("status");
  });

  it("auto-dismisses and replaces its timer when the message changes", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    await act(async () => root.render(<ViewportNotification message="First." onDismiss={onDismiss} />));
    await act(async () => vi.advanceTimersByTime(3000));
    await act(async () => root.render(<ViewportNotification message="Newest." onDismiss={onDismiss} />));
    await act(async () => vi.advanceTimersByTime(1500));
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(3000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("cleans up its timer on unmount", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    await act(async () => root.render(<ViewportNotification message="Saved." onDismiss={onDismiss} />));
    await act(async () => root.unmount());
    await act(async () => vi.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
