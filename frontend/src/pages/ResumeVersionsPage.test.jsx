import { describe, expect, it, vi } from "vitest";

import {
  RESUME_EDIT_CANCEL_CONFIRM_MESSAGE,
  RESUME_EDIT_SWITCH_CONFIRM_MESSAGE,
  formatResumeUpdatedDate,
  isResumeEditDirty,
  resolveResumeEditCancel,
  resolveResumeEditSwitch,
} from "./ResumeVersionsPage.jsx";

const resumeA = {
  description: "Backend-focused resume",
  id: 1,
  name: "Backend Resume",
  target_role: "Backend Engineer",
};

const resumeB = {
  description: "Frontend-focused resume",
  id: 2,
  name: "Frontend Resume",
  target_role: "Frontend Engineer",
};

const resumeAEditForm = {
  description: resumeA.description,
  name: resumeA.name,
  target_role: resumeA.target_role,
};

const dirtyResumeAEditForm = {
  ...resumeAEditForm,
  description: "Unsaved backend changes",
};

function getCurrentEditState(overrides = {}) {
  return {
    actionError: "Old error",
    actionMessage: "Old message",
    editingId: resumeA.id,
    editForm: resumeAEditForm,
    editFormBaseline: resumeAEditForm,
    ...overrides,
  };
}

describe("resume edit in-page protection", () => {
  it("opens a resume for editing without prompting when no edit is active", () => {
    const confirmLeave = vi.fn();
    const result = resolveResumeEditSwitch(
      {
        editingId: null,
        editForm: { name: "", target_role: "", description: "" },
        editFormBaseline: { name: "", target_role: "", description: "" },
      },
      resumeA,
      confirmLeave,
    );

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(result.editingId).toBe(resumeA.id);
    expect(result.editForm).toEqual(resumeAEditForm);
  });

  it("prompts before switching from a dirty resume edit", () => {
    const confirmLeave = vi.fn().mockReturnValue(false);

    resolveResumeEditSwitch(
      getCurrentEditState({ editForm: dirtyResumeAEditForm }),
      resumeB,
      confirmLeave,
    );

    expect(confirmLeave).toHaveBeenCalledWith(RESUME_EDIT_SWITCH_CONFIRM_MESSAGE);
  });

  it("keeps the current resume and draft when switch confirmation is canceled", () => {
    const currentState = getCurrentEditState({ editForm: dirtyResumeAEditForm });
    const result = resolveResumeEditSwitch(currentState, resumeB, vi.fn().mockReturnValue(false));

    expect(result).toBe(currentState);
    expect(result.editingId).toBe(resumeA.id);
    expect(result.editForm.description).toBe("Unsaved backend changes");
    expect(isResumeEditDirty(result.editingId, result.editForm, result.editFormBaseline)).toBe(true);
  });

  it("opens the next resume and discards the previous draft when switch confirmation is accepted", () => {
    const result = resolveResumeEditSwitch(
      getCurrentEditState({ editForm: dirtyResumeAEditForm }),
      resumeB,
      vi.fn().mockReturnValue(true),
    );

    expect(result.editingId).toBe(resumeB.id);
    expect(result.editForm).toEqual({
      description: resumeB.description,
      name: resumeB.name,
      target_role: resumeB.target_role,
    });
    expect(result.editForm.description).not.toBe("Unsaved backend changes");
    expect(result.actionError).toBe("");
    expect(result.actionMessage).toBe("");
  });

  it("switches from an unchanged resume edit without prompting", () => {
    const confirmLeave = vi.fn();
    const result = resolveResumeEditSwitch(getCurrentEditState(), resumeB, confirmLeave);

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(result.editingId).toBe(resumeB.id);
  });

  it("prompts before canceling a dirty resume edit", () => {
    const confirmLeave = vi.fn().mockReturnValue(false);

    resolveResumeEditCancel(getCurrentEditState({ editForm: dirtyResumeAEditForm }), confirmLeave);

    expect(confirmLeave).toHaveBeenCalledWith(RESUME_EDIT_CANCEL_CONFIRM_MESSAGE);
  });

  it("keeps the edit form and draft when cancel confirmation is declined", () => {
    const currentState = getCurrentEditState({ editForm: dirtyResumeAEditForm });
    const result = resolveResumeEditCancel(currentState, vi.fn().mockReturnValue(false));

    expect(result).toBe(currentState);
    expect(result.editingId).toBe(resumeA.id);
    expect(result.editForm.description).toBe("Unsaved backend changes");
  });

  it("exits edit mode when cancel confirmation is accepted", () => {
    const result = resolveResumeEditCancel(
      getCurrentEditState({ editForm: dirtyResumeAEditForm }),
      vi.fn().mockReturnValue(true),
    );

    expect(result.editingId).toBeNull();
    expect(result.editForm).toEqual({ name: "", target_role: "", description: "" });
    expect(result.editFormBaseline).toEqual({ name: "", target_role: "", description: "" });
  });

  it("cancels an unchanged edit without prompting", () => {
    const confirmLeave = vi.fn();
    const result = resolveResumeEditCancel(getCurrentEditState(), confirmLeave);

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(result.editingId).toBeNull();
  });

  it("preserves a dirty create draft while opening a resume edit", () => {
    const result = resolveResumeEditSwitch(
      {
        createForm: {
          description: "Draft create description",
          name: "New Resume Draft",
          target_role: "",
        },
        editingId: null,
        editForm: { name: "", target_role: "", description: "" },
        editFormBaseline: { name: "", target_role: "", description: "" },
      },
      resumeA,
      vi.fn(),
    );

    expect(result.createForm).toEqual({
      description: "Draft create description",
      name: "New Resume Draft",
      target_role: "",
    });
    expect(result.editingId).toBe(resumeA.id);
  });
});

describe("resume update dates", () => {
  const now = new Date(2026, 4, 20, 12, 0, 0);

  it("uses local calendar dates for friendly resume update labels", () => {
    expect(formatResumeUpdatedDate(new Date(2026, 4, 20, 0, 5, 0).toISOString(), now)).toBe("Updated today");
    expect(formatResumeUpdatedDate(new Date(2026, 4, 19, 23, 55, 0).toISOString(), now)).toBe("Updated yesterday");
    expect(formatResumeUpdatedDate(new Date(2026, 4, 16, 12, 0, 0).toISOString(), now)).toBe("Updated 4 days ago");
    expect(formatResumeUpdatedDate(new Date(2026, 4, 13, 12, 0, 0).toISOString(), now)).toBe("Updated May 13, 2026");
  });
});
