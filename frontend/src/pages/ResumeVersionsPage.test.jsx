import { describe, expect, it, vi } from "vitest";

import {
  RESUME_EDIT_CANCEL_CONFIRM_MESSAGE,
  RESUME_CREATE_DISCARD_EDIT_CONFIRM_MESSAGE,
  RESUME_EDIT_DISCARD_CREATE_CONFIRM_MESSAGE,
  RESUME_DUPLICATE_REPLACE_CREATE_CONFIRM_MESSAGE,
  RESUME_EDIT_SWITCH_CONFIRM_MESSAGE,
  formatResumeUpdatedDate,
  formatResumeUsage,
  getDuplicateResumeName,
  getResumeUsageCounts,
  isResumeEditDirty,
  resolveResumeDuplicate,
  resolveResumeCreateStart,
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

  it("starts editing without confirmation when the create form is clean", () => {
    const confirmLeave = vi.fn();
    const result = resolveResumeEditSwitch(
      {
        createError: "",
        createForm: { name: "", target_role: "", description: "" },
        editingId: null,
        editForm: { name: "", target_role: "", description: "" },
        editFormBaseline: { name: "", target_role: "", description: "" },
        isCreateOpen: true,
      },
      resumeA,
      confirmLeave,
    );

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(result.editingId).toBe(resumeA.id);
    expect(result.isCreateOpen).toBe(false);
  });

  it("does not begin editing or alter a dirty create draft when confirmation is declined", () => {
    const currentState = {
      createError: "Create validation error",
      createForm: { description: "Draft create description", name: "New Resume Draft", target_role: "" },
      editingId: null,
      editForm: { name: "", target_role: "", description: "" },
      editFormBaseline: { name: "", target_role: "", description: "" },
      isCreateOpen: true,
    };
    const confirmLeave = vi.fn().mockReturnValue(false);
    const result = resolveResumeEditSwitch(currentState, resumeA, confirmLeave);

    expect(confirmLeave).toHaveBeenCalledWith(RESUME_EDIT_DISCARD_CREATE_CONFIRM_MESSAGE);
    expect(result).toBe(currentState);
    expect(result.createForm.name).toBe("New Resume Draft");
    expect(result.editingId).toBeNull();
  });

  it("clears a confirmed create draft before beginning an edit", () => {
    const result = resolveResumeEditSwitch(
      {
        createError: "Create validation error",
        createForm: { description: "Copied description", name: "Backend Resume copy", target_role: "Backend Engineer" },
        editingId: null,
        editForm: { name: "", target_role: "", description: "" },
        editFormBaseline: { name: "", target_role: "", description: "" },
        isCreateOpen: true,
      },
      resumeA,
      vi.fn().mockReturnValue(true),
    );

    expect(result.createForm).toEqual({ name: "", target_role: "", description: "" });
    expect(result.createError).toBe("");
    expect(result.isCreateOpen).toBe(false);
    expect(result.editingId).toBe(resumeA.id);
  });

  it("does not partially change either draft when edit-switch confirmation is declined first", () => {
    const currentState = {
      ...getCurrentEditState({ editForm: dirtyResumeAEditForm }),
      createForm: { description: "Copied description", name: "Backend Resume copy", target_role: "Backend Engineer" },
      createError: "Create validation error",
      isCreateOpen: true,
    };
    const confirmLeave = vi.fn().mockReturnValue(false);

    expect(resolveResumeEditSwitch(currentState, resumeB, confirmLeave)).toBe(currentState);
    expect(confirmLeave).toHaveBeenCalledWith(RESUME_EDIT_SWITCH_CONFIRM_MESSAGE);
    expect(confirmLeave).toHaveBeenCalledTimes(1);
  });
});

describe("resume create in-page protection", () => {
  it("closes a clean edit and opens creation without prompting", () => {
    const confirmLeave = vi.fn();
    const result = resolveResumeCreateStart({
      createForm: { name: "Saved create draft", target_role: "", description: "" },
      ...getCurrentEditState(),
      isCreateOpen: false,
    }, confirmLeave);

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(result.editingId).toBeNull();
    expect(result.isCreateOpen).toBe(true);
    expect(result.createForm.name).toBe("Saved create draft");
  });

  it("keeps an edit unchanged when abandoning it for creation is declined", () => {
    const currentState = {
      createForm: { name: "Saved create draft", target_role: "", description: "" },
      ...getCurrentEditState({ editForm: dirtyResumeAEditForm }),
      isCreateOpen: false,
    };
    const confirmLeave = vi.fn().mockReturnValue(false);

    expect(resolveResumeCreateStart(currentState, confirmLeave)).toBe(currentState);
    expect(confirmLeave).toHaveBeenCalledWith(RESUME_CREATE_DISCARD_EDIT_CONFIRM_MESSAGE);
    expect(currentState.editForm.description).toBe("Unsaved backend changes");
  });

  it("clears a confirmed dirty edit while retaining the create draft", () => {
    const result = resolveResumeCreateStart({
      createForm: { name: "Saved create draft", target_role: "", description: "" },
      ...getCurrentEditState({ editForm: dirtyResumeAEditForm }),
      isCreateOpen: false,
    }, vi.fn().mockReturnValue(true));

    expect(result.editingId).toBeNull();
    expect(result.editForm).toEqual({ name: "", target_role: "", description: "" });
    expect(result.isCreateOpen).toBe(true);
    expect(result.createForm.name).toBe("Saved create draft");
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

describe("resume duplicate helpers", () => {
  it("suggests the next available copied name case-insensitively", () => {
    expect(getDuplicateResumeName("Early Career Resume", [
      { name: "Early Career Resume" },
      { name: "early career resume copy" },
      { name: "EARLY CAREER RESUME COPY 2" },
    ])).toBe("Early Career Resume copy 3");
  });

  it("does not replace a dirty edit or create draft until each confirmation is accepted", () => {
    const currentState = {
      ...getCurrentEditState({ editForm: dirtyResumeAEditForm }),
      createForm: { name: "Existing draft", target_role: "", description: "" },
      createError: "",
      isCreateOpen: false,
    };
    const declineEdit = vi.fn().mockReturnValue(false);
    expect(resolveResumeDuplicate(currentState, resumeB, [resumeA, resumeB], declineEdit)).toBe(currentState);
    expect(declineEdit).toHaveBeenCalledWith(RESUME_EDIT_CANCEL_CONFIRM_MESSAGE);

    const declineCreate = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(resolveResumeDuplicate(currentState, resumeB, [resumeA, resumeB], declineCreate)).toBe(currentState);
    expect(declineCreate).toHaveBeenLastCalledWith(RESUME_DUPLICATE_REPLACE_CREATE_CONFIRM_MESSAGE);

    const accepted = resolveResumeDuplicate(currentState, resumeB, [resumeA, resumeB], vi.fn().mockReturnValue(true));
    expect(accepted.editingId).toBeNull();
    expect(accepted.isCreateOpen).toBe(true);
    expect(accepted.createForm).toEqual({
      name: "Frontend Resume copy",
      target_role: "Frontend Engineer",
      description: "Frontend-focused resume",
    });
  });
});

describe("resume usage context", () => {
  it("counts assigned applications by resume ID regardless of status", () => {
    const counts = getResumeUsageCounts([
      { resume_version_id: 1, status: "Rejected" },
      { resume_version_id: "1", status: "Withdrawn" },
      { resume_version_id: null },
      { resume_version_id: "" },
      { resume_version_id: 2 },
    ]);
    expect(formatResumeUsage(counts.get("1"))).toBe("Used by 2 applications");
    expect(formatResumeUsage(counts.get("2"))).toBe("Used by 1 application");
    expect(formatResumeUsage(counts.get("3"))).toBe("Not used by any applications");
  });
});
