// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResumeVersionsPage, {
  getResumeDeleteConfirmationDescription,
  getResumeDeleteSuccessMessage,
} from "./ResumeVersionsPage.jsx";

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
          onDeleteResumeVersion={vi.fn().mockResolvedValue({ name: "Inactive Resume", unassigned_application_count: 0 })}
          onGetResumeVersionDeleteImpact={vi.fn().mockResolvedValue({ assignment_count: 0, is_active: false, name: "Inactive Resume" })}
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

  it("uses the complete collection immediately when inactive versions are included", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    await renderPage([resume], { allResumeVersions: [resume, inactive] });

    expect([...container.querySelectorAll(".resume-version-card h3")].map((heading) => heading.textContent)).toEqual([resume.name]);
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    expect([...container.querySelectorAll(".resume-version-card h3")].map((heading) => heading.textContent)).toEqual([
      resume.name,
      inactive.name,
    ]);
  });

  it("immediately reflects complete-collection updates while inactive versions are included", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    const updatedInactive = { ...inactive, name: "Updated Inactive Resume" };
    await renderPage([resume], { allResumeVersions: [resume, inactive] });
    await act(async () => container.querySelector('input[type="checkbox"]').click());

    await renderPage([resume], { allResumeVersions: [updatedInactive, resume] });
    expect([...container.querySelectorAll(".resume-version-card h3")].map((heading) => heading.textContent)).toEqual([
      updatedInactive.name,
      resume.name,
    ]);
  });

  it("keeps an inactive resume's edit form at the top after its complete-collection update", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    const updatedInactive = { ...inactive, name: "Updated Inactive Resume" };
    await renderPage([resume], { allResumeVersions: [inactive, resume] });
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    const inactiveCard = [...container.querySelectorAll(".resume-version-card")].find((card) => card.textContent.includes(inactive.name));
    await act(async () => [...inactiveCard.querySelectorAll("button")].find((button) => button.textContent === "Edit").click());

    await renderPage([resume], { allResumeVersions: [updatedInactive, resume] });
    expect(container.querySelector(".resume-version-card-editing")).toBeTruthy();
    expect([...container.querySelectorAll(".resume-version-card h3")].map((heading) => heading.textContent)).toEqual([resume.name]);
  });

  it("keeps a just-deactivated resume visible only while inactive versions are included", async () => {
    const deactivated = { ...resume, is_active: false, name: "Deactivated Resume" };
    await renderPage([resume], { allResumeVersions: [resume] });
    await act(async () => container.querySelector('input[type="checkbox"]').click());

    await renderPage([], { allResumeVersions: [deactivated] });
    expect(container.textContent).toContain(deactivated.name);
    expect(container.textContent).toContain("Inactive");

    await act(async () => container.querySelector('input[type="checkbox"]').click());
    expect(container.textContent).toContain("No resume versions yet");
    expect(container.textContent).not.toContain(deactivated.name);
  });

  it("offers enabled permanent deletion for inactive assigned resumes", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    await renderPage([resume, inactive], { applications: [{ resume_version_id: 2 }] });
    const includeInactive = container.querySelector('input[type="checkbox"]');
    await act(async () => includeInactive.click());

    const deleteButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Delete permanently");
    expect(deleteButton).toBeTruthy();
    expect(deleteButton.disabled).toBe(false);
    expect(deleteButton.getAttribute("aria-describedby")).toBeNull();
    expect(container.querySelectorAll(".quiet-danger-button")).toHaveLength(1);
  });

  it("enables permanent deletion for an inactive unassigned resume", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    await renderPage([inactive]);
    await act(async () => container.querySelector('input[type="checkbox"]').click());

    expect(container.querySelector("button.quiet-danger-button").disabled).toBe(false);
  });

  it("shows deletion progress and disables only that card's actions", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    let resolveImpact;
    let resolveDelete;
    const onGetResumeVersionDeleteImpact = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveImpact = resolve; }));
    const onDeleteResumeVersion = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveDelete = resolve; }));
    await renderPage([resume, inactive], { onDeleteResumeVersion, onGetResumeVersionDeleteImpact });
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    await act(async () => container.querySelector("button.quiet-danger-button").click());

    const inactiveCard = [...container.querySelectorAll(".resume-version-card")].find((card) => card.textContent.includes("Inactive Resume"));
    const activeCard = [...container.querySelectorAll(".resume-version-card")].find((card) => card.textContent.includes("Engineering Resume"));
    expect(inactiveCard.textContent).toContain("Checking...");
    expect([...inactiveCard.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect([...activeCard.querySelectorAll("button")].every((button) => !button.disabled)).toBe(true);

    await act(async () => resolveImpact({ assignment_count: 0, is_active: false, name: "Inactive Resume" }));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () => [...container.querySelector('[role="dialog"]').querySelectorAll("button")].at(-1).click());
    expect(inactiveCard.textContent).toContain("Deleting...");
    expect(onDeleteResumeVersion).toHaveBeenCalledWith(2, 0);

    await act(async () => resolveDelete({ name: "Inactive Resume", unassigned_application_count: 0 }));
  });

  it("confirms deletion and leaves the card in place when deletion fails", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    const onDeleteResumeVersion = vi.fn().mockRejectedValue(new Error("Still assigned"));
    const onGetResumeVersionDeleteImpact = vi.fn().mockResolvedValue({ assignment_count: 1, is_active: false, name: "Authoritative Resume" });
    await renderPage([inactive], { onDeleteResumeVersion, onGetResumeVersionDeleteImpact });
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    await act(async () => container.querySelector("button.quiet-danger-button").click());

    expect(container.querySelector('[role="dialog"]').textContent).toContain(getResumeDeleteConfirmationDescription({ assignment_count: 1 }));
    await act(async () => [...container.querySelector('[role="dialog"]').querySelectorAll("button")].at(-1).click());
    expect(onDeleteResumeVersion).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]').textContent).toContain("Still assigned");
    expect(container.textContent).toContain("Inactive Resume");
  });

  it("does not call deletion when confirmation is declined", async () => {
    const inactive = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    const onDeleteResumeVersion = vi.fn();
    const onGetResumeVersionDeleteImpact = vi.fn().mockResolvedValue({ assignment_count: 0, is_active: false, name: "Inactive Resume" });
    await renderPage([inactive], { onDeleteResumeVersion, onGetResumeVersionDeleteImpact });
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    await act(async () => container.querySelector("button.quiet-danger-button").click());
    await act(async () => container.querySelector('[role="dialog"]').querySelector("button").click());
    expect(onDeleteResumeVersion).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Inactive Resume");
  });

  it("uses count-aware deletion confirmation and success messages", () => {
    expect(getResumeDeleteConfirmationDescription({ assignment_count: 0 })).toContain("historical tracking");
    expect(getResumeDeleteConfirmationDescription({ assignment_count: 1 })).toContain("1 application");
    expect(getResumeDeleteConfirmationDescription({ assignment_count: 2 })).toContain("all 2 applications");
    expect(getResumeDeleteSuccessMessage({ name: "Resume", unassigned_application_count: 0 })).toBe('"Resume" permanently deleted.');
    expect(getResumeDeleteSuccessMessage({ name: "Resume", unassigned_application_count: 1 })).toBe('"Resume" permanently deleted and removed from 1 application.');
    expect(getResumeDeleteSuccessMessage({ name: "Resume", unassigned_application_count: 2 })).toBe('"Resume" permanently deleted and removed from 2 applications.');
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

  it("closes a clean edit and opens New resume version without confirmation", async () => {
    await renderPage();
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit");
    await act(async () => edit.click());
    const disclosure = container.querySelector("details");
    const createName = container.querySelector('.resume-version-create-panel input[name="name"]');
    await act(async () => disclosure.querySelector("summary").click());

    expect(container.querySelector(".resume-version-card-editing")).toBeNull();
    expect(disclosure.open).toBe(true);
    expect(document.activeElement).toBe(createName);
  });

  it("keeps a dirty edit open when opening New resume version is declined", async () => {
    await renderPage();
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit");
    await act(async () => edit.click());
    const editName = container.querySelector('.resume-version-card-editing input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(editName, "Unsaved Resume Name");
      editName.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const disclosure = container.querySelector("details");
    await act(async () => disclosure.querySelector("summary").click());

    expect(container.querySelector('[role="dialog"]').textContent).toContain("Start a new resume version?");
    await act(async () => container.querySelector('[role="dialog"]').querySelector("button").click());
    expect(container.querySelector('.resume-version-card-editing input[name="name"]').value).toBe("Unsaved Resume Name");
    expect(disclosure.open).toBe(false);
  });

  it("clears a confirmed dirty edit and opens New resume version", async () => {
    await renderPage();
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit");
    await act(async () => edit.click());
    const editName = container.querySelector('.resume-version-card-editing input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(editName, "Unsaved Resume Name");
      editName.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const disclosure = container.querySelector("details");
    const createName = container.querySelector('.resume-version-create-panel input[name="name"]');
    await act(async () => disclosure.querySelector("summary").click());

    await act(async () => [...container.querySelector('[role="dialog"]').querySelectorAll("button")].at(-1).click());
    expect(container.querySelector(".resume-version-card-editing")).toBeNull();
    expect(disclosure.open).toBe(true);
    expect(document.activeElement).toBe(createName);
  });

  it("prepares a duplicate draft without creating a record and focuses its editable name", async () => {
    const onCreateResumeVersion = vi.fn().mockResolvedValue({ name: "Engineering Resume copy 2" });
    await renderPage([resume, { ...resume, id: 2, name: "Engineering Resume copy" }], { onCreateResumeVersion });
    const duplicate = [...container.querySelectorAll("button")].find((button) => button.textContent === "Duplicate");
    await act(async () => duplicate.click());
    const disclosure = container.querySelector("details");
    const name = container.querySelector('.resume-version-create-panel input[name="name"]');
    expect(onCreateResumeVersion).not.toHaveBeenCalled();
    expect(disclosure.open).toBe(true);
    expect(name.value).toBe("Engineering Resume copy 2");
    expect(container.querySelector('input[name="target_role"]').value).toBe(resume.target_role);
    expect(container.querySelector('textarea[name="description"]').value).toBe(resume.description);
    expect(document.activeElement).toBe(name);
    expect(resume.name).toBe("Engineering Resume");
    await act(async () => disclosure.querySelector("summary").click());
    await act(async () => disclosure.querySelector("summary").click());
    expect(name.value).toBe("Engineering Resume copy 2");
    await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onCreateResumeVersion).toHaveBeenCalledWith({
      description: resume.description,
      name: "Engineering Resume copy 2",
      target_role: resume.target_role,
    });
    expect(disclosure.open).toBe(false);
  });

  it("does not replace an unfinished new-resume draft when duplication is declined", async () => {
    await renderPage();
    const disclosure = container.querySelector("details");
    await act(async () => disclosure.querySelector("summary").click());
    const name = container.querySelector('.resume-version-create-panel input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(name, "Unfinished draft");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const duplicate = [...container.querySelectorAll("button")].find((button) => button.textContent === "Duplicate");
    await act(async () => duplicate.click());
    expect(container.querySelector('[role="dialog"]').textContent).toContain("Replace new resume draft?");
    await act(async () => container.querySelector('[role="dialog"]').querySelector("button").click());
    expect(name.value).toBe("Unfinished draft");
    expect(disclosure.open).toBe(true);
  });

  it("protects a duplicate-populated draft before opening an edit", async () => {
    await renderPage();
    const duplicate = [...container.querySelectorAll("button")].find((button) => button.textContent === "Duplicate");
    await act(async () => duplicate.click());
    const createName = container.querySelector('.resume-version-create-panel input[name="name"]');
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit");
    await act(async () => edit.click());

    await act(async () => container.querySelector('[role="dialog"]').querySelector("button").click());
    expect(createName.value).toBe("Engineering Resume copy");
    expect(container.querySelector(".resume-version-card-editing")).toBeNull();
    expect(container.querySelector("details").open).toBe(true);
  });

  it("uses the secondary action treatment for Edit, Duplicate, and Deactivate", async () => {
    await renderPage();
    for (const label of ["Edit", "Duplicate", "Deactivate"]) {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
      expect(button.className).toBe("secondary-button");
    }
  });

  it("shows ID-based usage context for active and inactive resume cards", async () => {
    const inactiveResume = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    await renderPage([resume, inactiveResume], {
      applications: [
        { resume_version_id: 1, status: "Rejected" },
        { resume_version_id: "1", status: "Withdrawn" },
        { resume_version_id: 2 },
        { resume_version_id: null },
      ],
    });
    expect(container.textContent).toContain("Used by 2 applications");
    const includeInactive = container.querySelector('input[type="checkbox"]');
    await act(async () => includeInactive.click());
    expect(container.textContent).toContain("Used by 1 application");
  });

  it("discards an accepted unfinished create draft before opening an edit", async () => {
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
    await act(async () => [...container.querySelector('[role="dialog"]').querySelectorAll("button")].at(-1).click());
    expect(disclosure.open).toBe(false);
    await act(async () => disclosure.querySelector("summary").click());
    expect(container.querySelector('.resume-version-create-panel input[name="name"]').value).toBe("");
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
