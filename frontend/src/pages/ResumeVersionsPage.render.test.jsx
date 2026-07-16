// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResumeVersionsPage from "./ResumeVersionsPage.jsx";

const resume = {
  description: "A focused engineering resume.",
  id: 1,
  is_active: true,
  name: "Engineering Resume",
  target_role: "Software Engineer",
  updated_at: new Date().toISOString(),
};

describe("ResumeVersionsPage library experience", () => {
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
  });

  async function renderPage(resumeVersions = [resume], overrides = {}) {
    await act(async () => {
      root.render(
        <ResumeVersionsPage
          error=""
          isLoading={false}
          onCreateResumeVersion={vi.fn()}
          onLoadResumeVersions={vi.fn()}
          onUnsavedChangesChange={vi.fn()}
          onUpdateResumeVersion={vi.fn()}
          resumeVersions={resumeVersions}
          {...overrides}
        />,
      );
    });
  }

  it("starts collapsed when versions exist and preserves a create draft when reopened", async () => {
    await renderPage();
    const disclosure = container.querySelector("details");
    expect(disclosure.open).toBe(false);

    await act(async () => disclosure.querySelector("summary").click());
    const name = container.querySelector('input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(name, "Platform Resume");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => disclosure.querySelector("summary").click());
    await act(async () => disclosure.querySelector("summary").click());
    expect(container.querySelector('input[name="name"]').value).toBe("Platform Resume");
  });

  it("starts expanded with the existing empty-state wording when there are no versions", async () => {
    await renderPage([]);
    expect(container.querySelector("details").open).toBe(true);
    expect(container.textContent).toContain("No resume versions yet");
    expect(container.textContent).toContain("Create resume versions to track which resume is tied to each opportunity.");
  });

  it("clears and collapses the form after creating a version", async () => {
    const onCreateResumeVersion = vi.fn().mockResolvedValue({ name: "Platform Resume" });
    await renderPage([], { onCreateResumeVersion });
    const name = container.querySelector('input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(name, "Platform Resume");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onCreateResumeVersion).toHaveBeenCalledWith({ description: null, name: "Platform Resume", target_role: null });
    expect(container.querySelector("details").open).toBe(false);
    expect(name.value).toBe("");
    expect(container.querySelector(".resume-version-list-panel .message-success").textContent).toContain("Platform Resume created.");
    expect(container.querySelector(".resume-version-create-panel .message-success")).toBeNull();
  });

  it("keeps the form open and draft when creation fails", async () => {
    const onCreateResumeVersion = vi.fn().mockRejectedValue(new Error("Could not create"));
    await renderPage([], { onCreateResumeVersion });
    const name = container.querySelector('input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(name, "Platform Resume");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.querySelector("details").open).toBe(true);
    expect(name.value).toBe("Platform Resume");
    expect(container.textContent).toContain("Could not create");
  });

  it("shows a friendly date with the exact local timestamp available", async () => {
    await renderPage();
    const updated = container.querySelector("time");
    expect(updated.textContent).toBe("Updated today");
    expect(updated.title).not.toBe("");
  });

  it("uses the selected version's existing values in the distinct inline editing state", async () => {
    await renderPage();
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit");
    await act(async () => edit.click());
    expect(container.textContent).toContain("Editing resume version");
    const editSurface = container.querySelector(".resume-version-card-editing");
    expect(editSurface.querySelector('input[name="name"]').value).toBe(resume.name);
    expect(editSurface.querySelector('textarea[name="description"]').value).toBe(resume.description);
  });

  it("collapses creation for editing while retaining its unfinished draft", async () => {
    await renderPage();
    const disclosure = container.querySelector("details");
    await act(async () => disclosure.querySelector("summary").click());
    const createName = container.querySelector('.resume-version-create-panel input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(createName, "Saved Draft");
      createName.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit");
    await act(async () => edit.click());
    expect(disclosure.open).toBe(false);
    await act(async () => disclosure.querySelector("summary").click());
    expect(container.querySelector('.resume-version-create-panel input[name="name"]').value).toBe("Saved Draft");
  });

  it("renders the active edit form before the remaining cards and restores its position after saving", async () => {
    const secondResume = { ...resume, id: 2, name: "Second Resume" };
    const onUpdateResumeVersion = vi.fn().mockResolvedValue(secondResume);
    await renderPage([resume, secondResume], { onUpdateResumeVersion });
    const cards = [...container.querySelectorAll(".resume-version-card")];
    const secondEdit = [...cards[1].querySelectorAll("button")].find((button) => button.textContent === "Edit");
    await act(async () => secondEdit.click());
    const listPanel = container.querySelector(".resume-version-list-panel");
    const editSurface = listPanel.querySelector(".resume-version-card-editing");
    const resumeGrid = listPanel.querySelector(".resume-version-list");
    expect(editSurface.compareDocumentPosition(resumeGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(resumeGrid.textContent).toContain(resume.name);
    expect(resumeGrid.textContent).not.toContain(secondResume.name);
    expect(listPanel.querySelectorAll(".resume-version-card-editing")).toHaveLength(1);
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Save").click());
    const feedback = listPanel.querySelector(".message-success");
    expect(feedback.textContent).toContain("Second Resume updated.");
    expect(feedback.compareDocumentPosition(listPanel.querySelector(".resume-version-list")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...listPanel.querySelectorAll(".resume-version-list h3")].map((heading) => heading.textContent)).toEqual([resume.name, secondResume.name]);
    expect(container.querySelector(".resume-version-create-panel .message-success")).toBeNull();
  });

  it("restores the edited card to its original position when editing is cancelled", async () => {
    const secondResume = { ...resume, id: 2, name: "Second Resume" };
    await renderPage([resume, secondResume]);
    const secondEdit = [...container.querySelectorAll(".resume-version-card")[1].querySelectorAll("button")]
      .find((button) => button.textContent === "Edit");
    await act(async () => secondEdit.click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click());
    expect([...container.querySelectorAll(".resume-version-list h3")].map((heading) => heading.textContent)).toEqual([resume.name, secondResume.name]);
    expect(container.querySelector(".resume-version-card-editing")).toBeNull();
  });
});
