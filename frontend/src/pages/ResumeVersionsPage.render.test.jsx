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

  it("starts expanded with focused empty-library guidance when there are no versions", async () => {
    await renderPage([]);
    expect(container.querySelector("details").open).toBe(true);
    expect(container.textContent).toContain("No resume versions yet");
    expect(container.textContent).toContain("Create your first resume version above. You can later assign it to applications and compare confirmed outcomes.");
  });

  it("reopens and focuses the empty create form without clearing its draft", async () => {
    await renderPage([]);
    const disclosure = container.querySelector("details");
    const name = container.querySelector('input[name="name"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(name, "Platform Resume");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      disclosure.open = false;
      disclosure.dispatchEvent(new Event("toggle", { bubbles: true }));
    });
    expect(container.textContent).toContain("Create your first version");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Create your first version").classList).toContain("primary-small-button");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Create your first version").click());
    expect(disclosure.open).toBe(true);
    expect(container.querySelector('input[name="name"]').value).toBe("Platform Resume");
    expect(document.activeElement).toBe(container.querySelector('input[name="name"]'));
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
    await act(async () => [...inactiveCard.querySelectorAll("button")].find((button) => button.textContent === "Edit details").click());

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
    expect(container.querySelectorAll(".resume-version-meta-line")).toHaveLength(1);
    expect(container.querySelector(".resume-version-meta-line").textContent).toContain("Not used by any applications");
  });

  it("uses the selected version's existing values in the distinct inline editing state", async () => {
    await renderPage();
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit details");
    await act(async () => edit.click());
    expect(container.textContent).toContain("Editing resume version");
    const editSurface = container.querySelector(".resume-version-card-editing");
    expect(editSurface.querySelector('input[name="name"]').value).toBe(resume.name);
    expect(editSurface.querySelector('textarea[name="description"]').value).toBe(resume.description);
  });

  it("closes a clean edit and opens New resume version without confirmation", async () => {
    await renderPage();
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit details");
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
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit details");
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
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit details");
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

  it("groups active-card actions in a labeled disclosure", async () => {
    await renderPage();
    const card = container.querySelector(".resume-version-card");
    const disclosure = card.querySelector(".resume-actions-disclosure");
    expect(disclosure.querySelector("summary").getAttribute("aria-label")).toBe("Actions for Engineering Resume");
    expect(disclosure.open).toBe(false);
    await act(async () => disclosure.querySelector("summary").click());
    for (const label of ["Edit details", "Deactivate"]) {
      const button = [...disclosure.querySelectorAll("button")].find((item) => item.textContent === label);
      expect(button.className).toBe("secondary-button");
    }
    expect([...disclosure.querySelectorAll("button")].map((button) => button.textContent)).not.toContain("Delete permanently");
    await act(async () => disclosure.querySelector("button").click());
    expect(container.querySelectorAll(".resume-actions-disclosure[open], .manage-pdf-disclosure[open]")).toHaveLength(0);
    expect(container.querySelector(".resume-version-card-editing")).toBeTruthy();
  });

  it("places inactive-card editing, reactivation, and deletion together", async () => {
    const inactiveResume = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    await renderPage([inactiveResume]);
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    const disclosure = container.querySelector(".resume-actions-disclosure");
    await act(async () => disclosure.querySelector("summary").click());
    expect([...disclosure.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      "Edit details",
      "Reactivate",
      "Delete permanently",
    ]);
  });

  it("coordinates card disclosures and restores the active trigger after Escape", async () => {
    const attachedResume = {
      ...resume,
      file: { original_filename: "engineering-resume.pdf", size_bytes: 2048, updated_at: resume.updated_at },
    };
    const secondResume = { ...resume, id: 2, name: "Second Resume" };
    await renderPage([attachedResume, secondResume]);

    const cards = [...container.querySelectorAll(".resume-version-card")];
    const firstActions = cards[0].querySelector(".resume-actions-disclosure");
    const managePdf = cards[0].querySelector(".manage-pdf-disclosure");
    const secondActions = cards[1].querySelector(".resume-actions-disclosure");
    await act(async () => firstActions.querySelector("summary").click());
    expect(firstActions.open).toBe(true);
    expect(managePdf.open).toBe(false);

    await act(async () => managePdf.querySelector("summary").click());
    expect(container.querySelector(".resume-actions-disclosure").open).toBe(false);
    expect(container.querySelector(".manage-pdf-disclosure").open).toBe(true);

    await act(async () => secondActions.querySelector("summary").click());
    expect(container.querySelector(".manage-pdf-disclosure").open).toBe(false);
    expect(container.querySelectorAll(".resume-version-card")[1].querySelector(".resume-actions-disclosure").open).toBe(true);
    expect(container.querySelectorAll("details[open]")).toHaveLength(1);

    const activeActions = container.querySelectorAll(".resume-version-card")[1].querySelector(".resume-actions-disclosure");
    const trigger = activeActions.querySelector("summary");
    trigger.focus();
    await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    expect(activeActions.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("clears an open disclosure when its card is filtered from the library", async () => {
    const inactiveResume = { ...resume, id: 2, is_active: false, name: "Inactive Resume" };
    await renderPage([resume], { allResumeVersions: [resume, inactiveResume] });
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    const inactiveActions = [...container.querySelectorAll(".resume-version-card")]
      .find((card) => card.textContent.includes(inactiveResume.name))
      .querySelector(".resume-actions-disclosure");
    await act(async () => inactiveActions.querySelector("summary").click());
    expect(inactiveActions.open).toBe(true);
    await act(async () => container.querySelector('input[type="checkbox"]').click());
    expect(container.querySelectorAll(".resume-actions-disclosure[open], .manage-pdf-disclosure[open]")).toHaveLength(0);
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
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit details");
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
    const secondEdit = [...cards[1].querySelectorAll("button")].find((button) => button.textContent === "Edit details");
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
      .find((button) => button.textContent === "Edit details");
    await act(async () => secondEdit.click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click());
    expect([...container.querySelectorAll(".resume-version-list h3")].map((heading) => heading.textContent)).toEqual([resume.name, secondResume.name]);
    expect(container.querySelector(".resume-version-card-editing")).toBeNull();
  });
});
