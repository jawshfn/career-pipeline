import { describe, expect, it } from "vitest";

import {
  formatResumeUpdatedDate,
  formatResumeUsage,
  getDuplicateResumeName,
  getResumeConfirmationDescriptor,
  getResumeUsageCounts,
  resolveResumeDuplicate,
  resolveResumeEditCancel,
  resolveResumeEditSwitch,
} from "./ResumeVersionsPage.jsx";

const resumeA = { id: 1, name: "Backend Resume", target_role: "Backend Engineer", description: "Backend-focused resume" };
const resumeB = { id: 2, name: "Frontend Resume", target_role: "Frontend Engineer", description: "Frontend-focused resume" };
const baseline = { name: resumeA.name, target_role: resumeA.target_role, description: resumeA.description };
const dirtyState = {
  actionError: "Old error", actionMessage: "Old message", createError: "", createForm: { name: "", target_role: "", description: "" },
  editingId: resumeA.id, editForm: { ...baseline, description: "Unsaved changes" }, editFormBaseline: baseline, isCreateOpen: false,
};

describe("resume confirmation descriptors", () => {
  it("retains the requested switch target and describes its dirty edit", () => {
    const action = { type: "switch-edit", targetResumeVersion: resumeB, currentResumeVersion: resumeA };
    const descriptor = getResumeConfirmationDescriptor(action, dirtyState);
    expect(descriptor).toMatchObject({ title: "Switch resume versions?", cancelLabel: "Keep editing", confirmLabel: "Switch resume" });
    expect(descriptor.description).toContain("Backend Resume");
    expect(descriptor.description).toContain("Frontend Resume");
    expect(resolveResumeEditSwitch(dirtyState, action.targetResumeVersion).editingId).toBe(resumeB.id);
  });

  it("describes a dirty edit cancellation without applying it until confirmation", () => {
    const descriptor = getResumeConfirmationDescriptor({ type: "cancel-edit", currentResumeVersion: resumeA }, dirtyState);
    expect(descriptor).toMatchObject({ title: "Discard resume changes?", confirmLabel: "Discard changes" });
    expect(resolveResumeEditCancel(dirtyState).editingId).toBeNull();
  });

  it("combines dirty edit and creation work for one duplicate confirmation", () => {
    const currentState = { ...dirtyState, createForm: { name: "Draft", target_role: "", description: "" } };
    const action = { type: "duplicate", sourceResumeVersion: resumeB, currentResumeVersion: resumeA };
    const descriptor = getResumeConfirmationDescriptor(action, currentState);
    expect(descriptor).toMatchObject({ title: "Replace current resume work?", confirmLabel: "Discard and duplicate" });
    const result = resolveResumeDuplicate(currentState, resumeB, [resumeA, resumeB]);
    expect(result.createForm.name).toBe("Frontend Resume copy");
    expect(result.editingId).toBeNull();
  });

  it("uses a single creation-draft warning when editing a resume", () => {
    const currentState = { ...dirtyState, editingId: null, createForm: { name: "Draft", target_role: "", description: "" } };
    const descriptor = getResumeConfirmationDescriptor({ type: "switch-edit", targetResumeVersion: resumeB }, currentState);
    expect(descriptor).toMatchObject({ cancelLabel: "Keep draft", confirmLabel: "Discard and edit" });
  });

  it("does not need a dialog for clean work", () => {
    const clean = { ...dirtyState, editForm: baseline };
    expect(getResumeConfirmationDescriptor({ type: "switch-edit", targetResumeVersion: resumeB, currentResumeVersion: resumeA }, clean)).toBeNull();
  });
});

describe("resume helpers", () => {
  it("suggests copied names case-insensitively", () => {
    expect(getDuplicateResumeName("Early Career Resume", [{ name: "early career resume copy" }, { name: "EARLY CAREER RESUME COPY 2" }])).toBe("Early Career Resume copy 3");
  });
  it("counts application usage", () => {
    const counts = getResumeUsageCounts([{ resume_version_id: 1 }, { resume_version_id: "1" }, { resume_version_id: null }]);
    expect(formatResumeUsage(counts.get("1"))).toBe("Used by 2 applications");
  });
  it("formats friendly updated dates", () => {
    expect(formatResumeUpdatedDate(new Date(2026, 4, 20, 0, 5).toISOString(), new Date(2026, 4, 20, 12))).toBe("Updated today");
  });
});
