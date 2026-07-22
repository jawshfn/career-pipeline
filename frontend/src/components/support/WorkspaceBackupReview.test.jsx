// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkspaceBackupReview from "./WorkspaceBackupReview.jsx";

const backupSummary = {
  format: "pursuithq-workspace-backup", version: 1, exported_at: "2026-07-01T12:00:00Z",
  resume_versions: 1, applications: 3, application_activities: 2,
  active_applications: 1, closed_applications: 1, legacy_archived_applications: 1,
};

function validResult(warnings = []) {
  return { is_valid: true, backup_summary: backupSummary, current_workspace_summary: { ...backupSummary }, warnings, errors: [] };
}

async function mount(props = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  document.body.appendChild(container);
  await act(async () => root.render(<WorkspaceBackupReview onValidateWorkspaceBackup={vi.fn().mockResolvedValue(validResult())} {...props} />));
  return { container, root };
}

async function chooseFile(container, file) {
  const input = container.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", { configurable: true, value: file ? [file] : [] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  return input;
}

function file(name = "backup.json", type = "", text = '{"ok":true}') {
  const selected = new File([text], name, { type });
  selected.text = vi.fn().mockResolvedValue(text);
  return selected;
}

afterEach(() => { document.body.replaceChildren(); });

describe("WorkspaceBackupReview", () => {
  it("renders the local initial state and validates accepted file selections without reading them", async () => {
    const validate = vi.fn().mockResolvedValue(validResult());
    const { container, root } = await mount({ onValidateWorkspaceBackup: validate });
    expect(container.textContent).toContain("Review a workspace backup");
    const input = container.querySelector('input[type="file"]');
    expect(input.closest("label").textContent).toContain("PursuitHQ JSON backup");
    expect(container.querySelector("button").disabled).toBe(true);
    expect(container.textContent).not.toContain("Clear selection");
    const selected = file("review.json", "");
    await chooseFile(container, selected);
    expect(selected.text).not.toHaveBeenCalled();
    expect(container.textContent).toContain("review.json");
    expect(container.textContent).toContain("Clear selection");
    expect(container.querySelector("button").disabled).toBe(false);
    await act(async () => root.unmount());
  });

  it("rejects empty, oversized, and non-JSON files accessibly", async () => {
    const { container, root } = await mount();
    for (const selected of [file("empty.json", "", ""), file("backup.txt", "text/plain")]) {
      await chooseFile(container, selected);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
    }
    const oversized = file("large.json");
    Object.defineProperty(oversized, "size", { configurable: true, value: 25 * 1024 * 1024 + 1 });
    await chooseFile(container, oversized);
    expect(container.querySelector('[role="alert"]').textContent).toContain("no larger than 25 MiB");
    await chooseFile(container, file("mime-without-extension", "application/json"));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("defers reading until review, sends raw text, and prevents duplicate pending reviews", async () => {
    let resolveValidation;
    const validate = vi.fn(() => new Promise((resolve) => { resolveValidation = resolve; }));
    const { container, root } = await mount({ onValidateWorkspaceBackup: validate });
    const selected = file("raw.json", "application/json", " { raw text } ");
    await chooseFile(container, selected);
    const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "Review backup");
    await act(async () => { button.click(); button.click(); });
    expect(selected.text).toHaveBeenCalledOnce();
    expect(validate).toHaveBeenCalledWith(" { raw text } ");
    expect(button.textContent).toBe("Reviewing backup...");
    expect(button.disabled).toBe(true);
    await act(async () => resolveValidation(validResult()));
    expect(button.textContent).toBe("Review backup");
    expect(button.disabled).toBe(false);
    await act(async () => root.unmount());
  });

  it("renders all valid summaries, warnings, and status semantics", async () => {
    const { container, root } = await mount({ onValidateWorkspaceBackup: vi.fn().mockResolvedValue(validResult(["First warning", "Second warning"])) });
    await chooseFile(container, file());
    await act(async () => [...container.querySelectorAll("button")].find((item) => item.textContent === "Review backup").click());
    const result = container.querySelector('[role="status"]');
    expect(result.textContent).toContain("Backup is valid");
    expect(result.textContent).toContain("No data has been changed");
    expect(result.textContent).toContain("Restore is not available");
    expect(result.textContent).toContain("pursuithq-workspace-backup");
    expect(result.textContent).toContain("Version: 1");
    expect(result.textContent).toContain("Exported:");
    ["Resume versions", "Applications", "Activities", "Active applications", "Closed applications", "Legacy archived"].forEach((label) => expect(result.textContent).toContain(label));
    expect(result.textContent.indexOf("First warning")).toBeLessThan(result.textContent.indexOf("Second warning"));
    await act(async () => root.unmount());
  });

  it("renders structured invalid results and focuses errors", async () => {
    const invalid = { is_valid: false, errors: [
      { code: "schema_error", path: "data.applications[0].id", message: "Invalid field." },
      { code: "counts_mismatch", path: "counts.applications", message: "Count mismatch." },
    ] };
    const { container, root } = await mount({ onValidateWorkspaceBackup: vi.fn().mockResolvedValue(invalid) });
    await chooseFile(container, file());
    await act(async () => [...container.querySelectorAll("button")].find((item) => item.textContent === "Review backup").click());
    const alert = container.querySelector('[role="alert"]');
    expect(alert.textContent).toContain("Backup needs attention");
    expect(alert.textContent).toContain("No data has been changed");
    expect(alert.textContent).toContain("data.applications[0].id");
    expect(alert.textContent).toContain("Count mismatch.");
    expect(document.activeElement).toBe(alert);
    await act(async () => root.unmount());
  });

  it("recovers from validation and file-read failures without retaining a valid result", async () => {
    const validate = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockRejectedValueOnce({});
    const { container, root } = await mount({ onValidateWorkspaceBackup: validate });
    const selected = file();
    await chooseFile(container, selected);
    const review = () => [...container.querySelectorAll("button")].find((item) => item.textContent === "Review backup").click();
    await act(async () => review());
    expect(container.querySelector('[role="alert"]').textContent).toContain("Network unavailable");
    expect(document.activeElement).toBe(container.querySelector('[role="alert"]'));
    await act(async () => review());
    expect(container.querySelector('[role="alert"]').textContent).toContain("Could not review the workspace backup.");
    const unreadable = file("unreadable.json");
    unreadable.text.mockRejectedValue(new Error("Cannot read"));
    await chooseFile(container, unreadable);
    await act(async () => review());
    expect(container.querySelector('[role="alert"]').textContent).toContain("Cannot read");
    expect(container.querySelector('[role="status"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("clears native selection, feedback, and prior results when clearing or replacing a file", async () => {
    const { container, root } = await mount();
    const first = file("first.json");
    const input = await chooseFile(container, first);
    await act(async () => [...container.querySelectorAll("button")].find((item) => item.textContent === "Review backup").click());
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    await act(async () => [...container.querySelectorAll("button")].find((item) => item.textContent === "Clear selection").click());
    expect(input.value).toBe("");
    expect(container.textContent).not.toContain("first.json");
    expect(container.querySelector('[role="status"]')).toBeNull();
    await chooseFile(container, file("second.json"));
    expect(container.textContent).toContain("second.json");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("renders demo guidance without interactive controls or calls", async () => {
    const validate = vi.fn();
    const { container, root } = await mount({ isDemoMode: true, onValidateWorkspaceBackup: validate });
    expect(container.textContent).toContain("LOCAL APP ONLY");
    expect(container.textContent).toContain("Workspace restore preview");
    expect(container.textContent).toContain("available only in the local PursuitHQ app");
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.textContent).not.toContain("Review backup");
    expect(validate).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
