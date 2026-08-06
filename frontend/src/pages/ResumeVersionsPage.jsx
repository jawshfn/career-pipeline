import React, { useEffect, useRef, useState } from "react";

import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import ConfirmationDialog from "../components/ui/ConfirmationDialog.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import AutoGrowingTextarea from "../components/ui/AutoGrowingTextarea.jsx";
import ResumeFileSection, { formatResumeFileDate, formatResumeFileSize } from "../components/resumes/ResumeFileSection.jsx";
import { isArchivedApplication } from "../utils/applicationReviewRows.js";

const initialCreateForm = {
  name: "",
  target_role: "",
  description: "",
};

export function getResumeDeleteConfirmationDescription({ assignment_count: assignmentCount, has_file: hasFile = false }) {
  const fileWording = hasFile ? " Its attached PDF will also be removed." : "";
  if (assignmentCount === 0) return `This resume version and its historical tracking will be permanently deleted.${fileWording} This action cannot be undone.`;
  if (assignmentCount === 1) {
    return `This resume version is currently used by 1 application. Deleting it will remove the resume assignment from that application and erase this resume’s historical tracking.${fileWording} This action cannot be undone.`;
  }
  return `This resume version is currently used by ${assignmentCount} applications. Deleting it will remove the resume assignment from all ${assignmentCount} applications and erase this resume’s historical tracking.${fileWording} This action cannot be undone.`;
}

export function getResumeDeleteSuccessMessage({ name, unassigned_application_count: assignmentCount }) {
  if (assignmentCount === 0) return `"${name}" permanently deleted.`;
  return `"${name}" permanently deleted and removed from ${assignmentCount} application${assignmentCount === 1 ? "" : "s"}.`;
}

function normalizeFormValue(value) {
  return String(value ?? "");
}

export function isResumeFormDirty(formData, baselineFormData = initialCreateForm) {
  return Object.keys(baselineFormData).some(
    (fieldName) => normalizeFormValue(formData[fieldName]) !== normalizeFormValue(baselineFormData[fieldName]),
  );
}

function toEditForm(resumeVersion) {
  return {
    name: resumeVersion.name || "",
    target_role: resumeVersion.target_role || "",
    description: resumeVersion.description || "",
  };
}

function getCleanEditState() {
  return {
    editingId: null,
    editForm: initialCreateForm,
    editFormBaseline: initialCreateForm,
  };
}

function getEditStateForResume(resumeVersion) {
  const nextEditForm = toEditForm(resumeVersion);

  return {
    editingId: resumeVersion.id,
    editForm: nextEditForm,
    editFormBaseline: nextEditForm,
  };
}

export function isResumeEditDirty(editingId, editForm, editFormBaseline) {
  return Boolean(editingId && isResumeFormDirty(editForm, editFormBaseline));
}

export function getResumeUsageCounts(applications = []) {
  return applications.reduce((usageCounts, application) => {
    if (application.resume_version_id === null || application.resume_version_id === undefined || application.resume_version_id === "") {
      return usageCounts;
    }
    const resumeVersionId = String(application.resume_version_id);
    usageCounts.set(resumeVersionId, (usageCounts.get(resumeVersionId) || 0) + 1);
    return usageCounts;
  }, new Map());
}

export function formatResumeUsage(count) {
  if (!count) return "Not used by any applications";
  return `Used by ${count} application${count === 1 ? "" : "s"}`;
}

export function resolveResumeEditSwitch(currentState, nextResumeVersion) {
  const hasDirtyCreateForm = isResumeFormDirty(currentState.createForm || initialCreateForm, initialCreateForm);
  return {
    ...currentState,
    ...getEditStateForResume(nextResumeVersion),
    actionError: "",
    actionMessage: "",
    ...(hasDirtyCreateForm
      ? {
          createError: "",
          createForm: initialCreateForm,
        }
      : {}),
    isCreateOpen: false,
  };
}

export function resolveResumeEditCancel(currentState) {
  return {
    ...currentState,
    ...getCleanEditState(),
  };
}

export function resolveResumeCreateStart(currentState) {
  return {
    ...currentState,
    ...getCleanEditState(),
    isCreateOpen: true,
  };
}

export function getResumeConfirmationDescriptor(action, currentState) {
  const dirtyEdit = isResumeEditDirty(currentState.editingId, currentState.editForm, currentState.editFormBaseline);
  const dirtyCreate = isResumeFormDirty(currentState.createForm || initialCreateForm, initialCreateForm);
  const editingResume = action.currentResumeVersion;
  if (action.type === "switch-edit" && (dirtyEdit || dirtyCreate)) {
    const currentName = editingResume?.name || "this resume";
    const description = dirtyEdit && dirtyCreate
      ? `You have unsaved changes to "${currentName}" and an unfinished new resume version. Switching to "${action.targetResumeVersion.name}" will discard both.`
      : dirtyEdit
        ? `You have unsaved changes to "${currentName}". Switching to "${action.targetResumeVersion.name}" will discard them.`
        : `You have an unfinished new resume version. Editing "${action.targetResumeVersion.name}" will discard that draft.`;
    return { title: "Switch resume versions?", description, cancelLabel: dirtyCreate && !dirtyEdit ? "Keep draft" : "Keep editing", confirmLabel: dirtyCreate && !dirtyEdit ? "Discard and edit" : "Switch resume" };
  }
  if (action.type === "cancel-edit" && dirtyEdit) return { title: "Discard resume changes?", description: `Changes to "${editingResume?.name || "this resume"}" have not been saved.`, cancelLabel: "Keep editing", confirmLabel: "Discard changes" };
  if (action.type === "start-create" && dirtyEdit) return { title: "Start a new resume version?", description: `You have unsaved changes to "${editingResume?.name || "this resume"}". Starting a new resume version will discard them.`, cancelLabel: "Keep editing", confirmLabel: "Discard and continue" };
  return null;
}

function toPayload(formData) {
  return {
    name: formData.name.trim(),
    target_role: formData.target_role.trim() || null,
    description: formData.description.trim() || null,
  };
}

export function formatResumeUpdatedDate(value, now = new Date()) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const updatedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((today - updatedDay) / 86_400_000);
  if (daysAgo === 0) return "Updated today";
  if (daysAgo === 1) return "Updated yesterday";
  if (daysAgo > 1 && daysAgo < 7) return `Updated ${daysAgo} days ago`;

  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

export function formatResumeUpdatedTimestamp(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ResumeVersionsPage({
  applications = [],
  error,
  isLoading,
  onAssignDefaultResumeToUnassigned,
  onCreateResumeVersion,
  onDeleteResumeVersion,
  onDeleteResumeVersionFile,
  onGetResumeVersionFileContent,
  onGetResumeVersionDeleteImpact,
  onUnsavedChangesChange,
  onUpdateResumeVersion,
  onUploadResumeVersionFile,
  isDemoMode = false,
  resumeVersions,
  allResumeVersions = resumeVersions,
}) {
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialCreateForm);
  const [editFormBaseline, setEditFormBaseline] = useState(initialCreateForm);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [actionError, setActionError] = useState("");
  const [createError, setCreateError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [checkingDeleteId, setCheckingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingResumeAction, setPendingResumeAction] = useState(null);
  const [pendingResumeDeletion, setPendingResumeDeletion] = useState(null);
  const [pendingDefaultAssignment, setPendingDefaultAssignment] = useState(null);
  const [deleteDialogError, setDeleteDialogError] = useState("");
  const [defaultAssignmentError, setDefaultAssignmentError] = useState("");
  const [isAssigningDefault, setIsAssigningDefault] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(resumeVersions.length === 0);
  const [openDisclosure, setOpenDisclosure] = useState(null);
  const createDisclosureInitialized = useRef(false);
  const createNameRef = useRef(null);
  const shouldFocusCreateNameRef = useRef(false);
  const editSurfaceRef = useRef(null);

  useEffect(() => {
    if (!isLoading && !createDisclosureInitialized.current) {
      setIsCreateOpen(resumeVersions.length === 0);
      createDisclosureInitialized.current = true;
    }
  }, [isLoading, resumeVersions.length]);

  useEffect(() => {
    if (editingId) editSurfaceRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (isCreateOpen && shouldFocusCreateNameRef.current) {
      createNameRef.current?.focus();
      shouldFocusCreateNameRef.current = false;
    }
  }, [createForm, isCreateOpen]);

  const hasCreateFormChanges = isResumeFormDirty(createForm, initialCreateForm);
  const hasEditFormChanges = editingId ? isResumeFormDirty(editForm, editFormBaseline) : false;

  useEffect(() => {
    onUnsavedChangesChange?.(hasCreateFormChanges || hasEditFormChanges);
  }, [hasCreateFormChanges, hasEditFormChanges, onUnsavedChangesChange]);

  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  function updateCreateField(event) {
    const { name, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: value }));
    setActionMessage("");
    setCreateError("");
  }

  function updateEditField(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
    setActionMessage("");
    setActionError("");
  }

  function setDisclosureOpen(resumeVersionId, type, isOpen) {
    if (isOpen) {
      setOpenDisclosure({ resumeVersionId, type });
      return;
    }
    setOpenDisclosure((current) => (
      current?.resumeVersionId === resumeVersionId && current.type === type ? null : current
    ));
  }

  function closeDisclosure(resumeVersionId, type) {
    setOpenDisclosure((current) => (
      current?.resumeVersionId === resumeVersionId && current.type === type ? null : current
    ));
  }

  function handleDisclosureEscape(event, resumeVersionId, type) {
    if (event.key !== "Escape" || !event.currentTarget.open) return;
    event.preventDefault();
    closeDisclosure(resumeVersionId, type);
    event.currentTarget.querySelector("summary")?.focus();
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreateError("");
    setActionError("");
    setActionMessage("");
    setIsCreating(true);

    try {
      const created = await onCreateResumeVersion(toPayload(createForm));
      setCreateForm(initialCreateForm);
      setIsCreateOpen(false);
      setActionMessage(`${created.name} created.`);
    } catch (creationError) {
      setIsCreateOpen(true);
      setCreateError(creationError.message || "Could not create resume version.");
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(resumeVersion) {
    setOpenDisclosure(null);
    const currentState = {
      actionError,
      actionMessage,
      createError,
      createForm,
      editingId,
      editForm,
      editFormBaseline,
      isCreateOpen,
    };
    const action = { type: "switch-edit", targetResumeVersion: resumeVersion, currentResumeVersion: allResumeVersions.find((version) => version.id === editingId) };
    requestResumeAction(action, currentState);
  }

  function cancelEditing() {
    requestResumeAction({ type: "cancel-edit", currentResumeVersion: allResumeVersions.find((version) => version.id === editingId) }, { editingId, editForm, editFormBaseline, createForm });
  }

  function handleCreateDisclosureClick(event) {
    if (isCreateOpen || !editingId) return;

    event.preventDefault();
    const currentState = {
      createForm,
      editForm,
      editFormBaseline,
      editingId,
      isCreateOpen,
    };
    requestResumeAction({ type: "start-create", currentResumeVersion: allResumeVersions.find((version) => version.id === editingId) }, currentState);
  }

  function reopenEmptyCreateForm() {
    shouldFocusCreateNameRef.current = true;
    setIsCreateOpen(true);
  }

  function applyResumeAction(action, currentState) {
    const nextState = action.type === "switch-edit"
      ? resolveResumeEditSwitch(currentState, action.targetResumeVersion)
      : action.type === "cancel-edit"
        ? resolveResumeEditCancel(currentState)
          : resolveResumeCreateStart(currentState);
    if (action.type === "start-create") shouldFocusCreateNameRef.current = true;
    setActionError(nextState.actionError);
    setActionMessage(nextState.actionMessage);
    setCreateError(nextState.createError);
    setCreateForm(nextState.createForm);
    setEditingId(nextState.editingId);
    setEditForm(nextState.editForm);
    setEditFormBaseline(nextState.editFormBaseline);
    setIsCreateOpen(nextState.isCreateOpen);
  }

  function requestResumeAction(action, currentState) {
    if (pendingResumeAction) return;
    const descriptor = getResumeConfirmationDescriptor(action, currentState);
    if (descriptor) {
      setPendingResumeAction({ action, descriptor });
      return;
    }
    applyResumeAction(action, currentState);
  }

  function confirmResumeAction() {
    if (!pendingResumeAction) return;
    const currentState = { actionError, actionMessage, createError, createForm, editingId, editForm, editFormBaseline, isCreateOpen };
    const { action } = pendingResumeAction;
    setPendingResumeAction(null);
    applyResumeAction(action, currentState);
  }

  async function handleSaveEdit(resumeVersionId) {
    setActionError("");
    setActionMessage("");
    setSavingId(resumeVersionId);

    try {
      const updated = await onUpdateResumeVersion(resumeVersionId, toPayload(editForm));
      setEditingId(null);
      setEditForm(initialCreateForm);
      setEditFormBaseline(initialCreateForm);
      setActionMessage(`${updated.name} updated.`);
    } catch (updateError) {
      setActionError(updateError.message || "Could not update resume version.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleActiveToggle(resumeVersion) {
    setOpenDisclosure(null);
    setActionError("");
    setActionMessage("");
    setSavingId(resumeVersion.id);

    try {
      const updated = await onUpdateResumeVersion(resumeVersion.id, {
        is_active: !resumeVersion.is_active,
      });
      setActionMessage(`${updated.name} ${updated.is_active ? "reactivated" : "deactivated"}.`);
    } catch (updateError) {
      setActionError(updateError.message || "Could not update resume version status.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDefaultToggle(resumeVersion) {
    setOpenDisclosure(null);
    setActionError("");
    setActionMessage("");
    setSavingId(resumeVersion.id);
    try {
      const updated = await onUpdateResumeVersion(resumeVersion.id, { is_default: !resumeVersion.is_default });
      setActionMessage(updated.is_default
        ? `"${updated.name}" is now the default for new applications.`
        : "Default resume cleared.");
    } catch (updateError) {
      setActionError(updateError.message || "Could not update the default resume.");
    } finally {
      setSavingId(null);
    }
  }

  function requestDefaultAssignment(resumeVersion, expectedUnassignedCount) {
    setDefaultAssignmentError("");
    setPendingDefaultAssignment({ resumeVersion, expectedUnassignedCount });
  }

  async function confirmDefaultAssignment() {
    if (!pendingDefaultAssignment || isAssigningDefault) return;
    setIsAssigningDefault(true);
    setDefaultAssignmentError("");
    try {
      const result = await onAssignDefaultResumeToUnassigned(
        pendingDefaultAssignment.resumeVersion.id,
        pendingDefaultAssignment.expectedUnassignedCount,
      );
      setActionMessage(`"${result.name}" assigned to ${result.assigned_application_count} application${result.assigned_application_count === 1 ? "" : "s"}.`);
      setPendingDefaultAssignment(null);
    } catch (assignmentError) {
      setDefaultAssignmentError(assignmentError.message || "Could not assign the default resume.");
    } finally {
      setIsAssigningDefault(false);
    }
  }

  async function handleDeleteResumeVersion(resumeVersion) {
    setOpenDisclosure(null);
    setActionError("");
    setCheckingDeleteId(resumeVersion.id);
    try {
      const impact = await onGetResumeVersionDeleteImpact(resumeVersion.id);
      if (impact.is_active) {
        setActionError("Deactivate this resume version before deleting it.");
        return;
      }
      setPendingResumeDeletion({ resumeVersion, impact });
      setDeleteDialogError("");
    } catch (deleteError) {
      setActionError(deleteError.message || "Could not delete resume version.");
    } finally {
      setCheckingDeleteId(null);
    }
  }

  async function confirmResumeDeletion() {
    const pending = pendingResumeDeletion;
    if (!pending || deletingId) return;
    setDeletingId(pending.resumeVersion.id);
    setDeleteDialogError("");
    try {
      const deleted = await onDeleteResumeVersion(pending.resumeVersion.id, pending.impact.assignment_count);
      setActionMessage(getResumeDeleteSuccessMessage(deleted));
      setPendingResumeDeletion(null);
    } catch (deleteError) {
      const message = deleteError.message || "Could not delete resume version.";
      if (message === "This resume version's application usage changed. Review the deletion warning and try again.") {
        try {
          const impact = await onGetResumeVersionDeleteImpact(pending.resumeVersion.id);
          if (impact.is_active) {
            setPendingResumeDeletion(null);
            setActionError("Deactivate this resume version before deleting it.");
          } else {
            setPendingResumeDeletion({ ...pending, impact });
            setDeleteDialogError(message);
          }
        } catch (impactError) {
          setDeleteDialogError(impactError.message || "Could not delete resume version.");
        }
      } else setDeleteDialogError(message);
    } finally {
      setDeletingId(null);
    }
  }

  const libraryResumeVersions = includeInactive ? allResumeVersions : resumeVersions;
  const visibleResumeVersions = libraryResumeVersions;
  const editingResumeVersion = libraryResumeVersions.find((resumeVersion) => resumeVersion.id === editingId);
  const remainingVisibleResumeVersions = visibleResumeVersions.filter((resumeVersion) => resumeVersion.id !== editingId);
  const resumeUsageCounts = getResumeUsageCounts(applications);
  const unassignedEligibleApplicationCount = applications.filter((application) => (
    !isArchivedApplication(application)
    && (application.resume_version_id === null || application.resume_version_id === undefined || application.resume_version_id === "")
  )).length;

  useEffect(() => {
    if (!openDisclosure) return;
    const isVisible = visibleResumeVersions.some((resumeVersion) => resumeVersion.id === openDisclosure.resumeVersionId);
    if (!isVisible || editingId === openDisclosure.resumeVersionId) setOpenDisclosure(null);
  }, [editingId, openDisclosure, visibleResumeVersions]);

  return (
    <div className="resume-versions-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Resume library</p>
          <h2>Resumes</h2>
          <p>Manage reusable resume variants for different roles and applications.</p>
        </div>
      </header>

      <section className="panel resume-version-create-panel" aria-labelledby="create-resume-version-title">
        <details className="resume-version-disclosure" onToggle={(event) => setIsCreateOpen(event.currentTarget.open)} open={isCreateOpen}>
          <summary id="create-resume-version-title" className="resume-version-disclosure-summary" onClick={handleCreateDisclosureClick}>
            <span>
              <strong className="resume-version-disclosure-cue resume-version-workflow-cue">New resume version</strong>
              <small>Add a reusable resume variant without changing application records.</small>
            </span>
            <span aria-hidden="true" className="resume-version-disclosure-chevron" />
          </summary>
          <div className="resume-version-disclosure-content">
            {createError ? <ErrorMessage message={createError} /> : null}

            <form className="resume-version-form" onSubmit={handleCreate}>
          <label>
            Name
            <input
              ref={createNameRef}
              name="name"
              value={createForm.name}
              onChange={updateCreateField}
              required
              placeholder="Software Engineering Resume"
            />
          </label>

          <label>
            Target role
            <input
              name="target_role"
              value={createForm.target_role}
              onChange={updateCreateField}
              placeholder="Frontend, backend, analyst, support"
            />
          </label>

          <label className="resume-version-description-field">
            Description
            <AutoGrowingTextarea
              name="description"
              value={createForm.description}
              onChange={updateCreateField}
              maxRows={4}
              rows="1"
              placeholder="Short positioning note or key differences"
            />
          </label>

          <div className="form-actions">
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create version"}
            </button>
          </div>
            </form>
          </div>
        </details>
      </section>

      <section className="panel resume-version-list-panel" aria-labelledby="resume-version-list-title">
        <div className="section-heading resume-version-list-heading">
          <div>
            <h2 id="resume-version-list-title">Resume Version List</h2>
            <p>
              {visibleResumeVersions.length} version{visibleResumeVersions.length === 1 ? "" : "s"} shown
            </p>
          </div>
          <label className="include-inactive-toggle">
            <input
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              type="checkbox"
            />
            Include inactive
          </label>
        </div>

        {actionMessage ? <div className="message message-success resume-version-list-feedback" role="status">{actionMessage}</div> : null}
        {!isLoading && actionError ? <ErrorMessage message={actionError} /> : null}

        {isLoading ? <LoadingState message="Loading resume versions..." /> : null}
        {!isLoading && error ? <ErrorMessage message={error} /> : null}

        {!isLoading && !error && visibleResumeVersions.length === 0 ? (
          <div className="empty-state">
            <h3>No resume versions yet</h3>
            <p>Create your first resume version above. You can later assign it to applications and compare confirmed outcomes.</p>
            {!isCreateOpen ? <div className="empty-state-actions"><button className="primary-small-button" type="button" onClick={reopenEmptyCreateForm}>Create your first version</button></div> : null}
          </div>
        ) : null}

        {!isLoading && !error && editingResumeVersion ? (
          <article className="resume-version-card resume-version-card-editing" ref={editSurfaceRef} tabIndex={-1}>
            <div className="resume-version-edit-form">
              <p className="resume-version-editing-cue resume-version-workflow-cue">Editing resume version</p>
              {actionError ? <ErrorMessage message={actionError} /> : null}
              <label>
                Name
                <input
                  name="name"
                  value={editForm.name}
                  onChange={updateEditField}
                  required
                />
              </label>

              <label>
                Target role
                <input
                  name="target_role"
                  value={editForm.target_role}
                  onChange={updateEditField}
                />
              </label>

              <label className="resume-version-description-field">
                Description
                <AutoGrowingTextarea
                  name="description"
                  value={editForm.description}
                  onChange={updateEditField}
                  maxRows={4}
                  rows="1"
                />
              </label>

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={cancelEditing}>
                  Cancel
                </button>
                <button
                  className="primary-small-button"
                  type="button"
                  disabled={savingId === editingResumeVersion.id}
                  onClick={() => handleSaveEdit(editingResumeVersion.id)}
                >
                  {savingId === editingResumeVersion.id ? "Saving..." : "Save"}
                </button>
              </div>
              <section className="resume-file-section resume-file-section-read-only">
                <h4>Resume file</h4>
                {editingResumeVersion.file ? <p>{editingResumeVersion.file.original_filename} · {formatResumeFileSize(editingResumeVersion.file.size_bytes)} · Added {formatResumeFileDate(editingResumeVersion.file.updated_at || editingResumeVersion.file.created_at)}</p> : <p>No PDF attached</p>}
                <p>Save or cancel resume details to manage the PDF.</p>
              </section>
            </div>
          </article>
        ) : null}

        {!isLoading && !error && remainingVisibleResumeVersions.length > 0 ? (
          <div className="resume-version-list">
            {remainingVisibleResumeVersions.map((resumeVersion) => {
              const isSaving = savingId === resumeVersion.id;
              const isCheckingDelete = checkingDeleteId === resumeVersion.id;
              const isDeleting = deletingId === resumeVersion.id;
              const isDeleteInProgress = isCheckingDelete || isDeleting;
              const usageCount = resumeUsageCounts.get(String(resumeVersion.id)) || 0;
              const hasUnassignedCallout = resumeVersion.is_active && resumeVersion.is_default && unassignedEligibleApplicationCount > 0;

              return (
                <article
                  className={`resume-version-card ${resumeVersion.is_active ? "" : "resume-version-card-inactive"}`}
                  key={resumeVersion.id}
                >
                  <>
                      <div className="resume-version-card-header">
                        <div>
                          <h3>{resumeVersion.name}</h3>
                          <p>{resumeVersion.target_role || "No target role set"}</p>
                        </div>
                        <div className="resume-version-header-controls">
                          <span className={`resume-version-state ${resumeVersion.is_active ? "" : "resume-version-state-inactive"}`}>
                            {resumeVersion.is_active ? "Active" : "Inactive"}
                          </span>
                          {resumeVersion.is_active && resumeVersion.is_default ? <span className="resume-version-state resume-version-state-default">Default</span> : null}
                          <details className="resume-actions-disclosure" open={openDisclosure?.resumeVersionId === resumeVersion.id && openDisclosure.type === "resume-actions"} onKeyDown={(event) => handleDisclosureEscape(event, resumeVersion.id, "resume-actions")}>
                            <summary aria-label={`Actions for ${resumeVersion.name}`} onClick={(event) => { event.preventDefault(); setDisclosureOpen(resumeVersion.id, "resume-actions", !(openDisclosure?.resumeVersionId === resumeVersion.id && openDisclosure.type === "resume-actions")); }}>Actions</summary>
                            <div className="resume-actions-panel">
                              <button className="secondary-button" type="button" disabled={Boolean(savingId) || isDeleteInProgress} onClick={() => { closeDisclosure(resumeVersion.id, "resume-actions"); startEditing(resumeVersion); }}>Edit details</button>
                              <button className="secondary-button" type="button" disabled={Boolean(savingId) || isDeleteInProgress} onClick={() => { closeDisclosure(resumeVersion.id, "resume-actions"); handleActiveToggle(resumeVersion); }}>
                                {isSaving ? "Saving..." : resumeVersion.is_active ? "Deactivate" : "Reactivate"}
                              </button>
                              {resumeVersion.is_active ? <button className="secondary-button" type="button" disabled={Boolean(savingId) || isDeleteInProgress} onClick={() => handleDefaultToggle(resumeVersion)}>{isSaving ? "Saving..." : resumeVersion.is_default ? "Clear default" : "Make default"}</button> : null}
                              {!resumeVersion.is_active ? <button className="quiet-danger-button" type="button" disabled={isDeleteInProgress} onClick={() => { closeDisclosure(resumeVersion.id, "resume-actions"); handleDeleteResumeVersion(resumeVersion); }}>{isCheckingDelete ? "Checking..." : isDeleting ? "Deleting..." : "Delete permanently"}</button> : null}
                            </div>
                          </details>
                        </div>
                      </div>

                      {resumeVersion.description ? (
                        <p className="resume-version-description">{resumeVersion.description}</p>
                      ) : null}

                      <p className="resume-version-meta-line">
                        <time aria-label={formatResumeUpdatedTimestamp(resumeVersion.updated_at) || "Updated date unavailable"} dateTime={resumeVersion.updated_at || undefined} title={formatResumeUpdatedTimestamp(resumeVersion.updated_at) || undefined}>{formatResumeUpdatedDate(resumeVersion.updated_at)}</time>
                        <span aria-hidden="true"> · </span>{formatResumeUsage(usageCount)}
                      </p>

                      {hasUnassignedCallout ? <aside className="resume-default-callout">
                        <p>{unassignedEligibleApplicationCount === 1 ? "1 application does not have a resume assigned." : `${unassignedEligibleApplicationCount} applications do not have a resume assigned.`}</p>
                        <button className="secondary-button" type="button" disabled={isAssigningDefault} onClick={() => requestDefaultAssignment(resumeVersion, unassignedEligibleApplicationCount)}>Assign default to {unassignedEligibleApplicationCount} application{unassignedEligibleApplicationCount === 1 ? "" : "s"}</button>
                      </aside> : null}

                      <ResumeFileSection
                        disabled={isDeleteInProgress}
                        isDemoMode={isDemoMode}
                        onDeleteFile={onDeleteResumeVersionFile}
                        onGetFileContent={onGetResumeVersionFileContent}
                        isManagePdfOpen={openDisclosure?.resumeVersionId === resumeVersion.id && openDisclosure.type === "manage-pdf"}
                        onManagePdfOpenChange={(isOpen) => setDisclosureOpen(resumeVersion.id, "manage-pdf", isOpen)}
                        onManagePdfEscape={(event) => handleDisclosureEscape(event, resumeVersion.id, "manage-pdf")}
                        onUploadFile={onUploadResumeVersionFile}
                        resumeVersion={resumeVersion}
                        usageCount={usageCount}
                      />

                  </>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
      <ConfirmationDialog
        cancelLabel={pendingResumeAction?.descriptor.cancelLabel}
        confirmLabel={pendingResumeAction?.descriptor.confirmLabel}
        description={pendingResumeAction?.descriptor.description || ""}
        isOpen={Boolean(pendingResumeAction)}
        onCancel={() => setPendingResumeAction(null)}
        onConfirm={confirmResumeAction}
        title={pendingResumeAction?.descriptor.title || "Confirm action"}
      />
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Delete permanently"
        confirmTone="danger"
        description={pendingResumeDeletion ? getResumeDeleteConfirmationDescription({ ...pendingResumeDeletion.impact, has_file: Boolean(pendingResumeDeletion.resumeVersion.file) }) : ""}
        errorMessage={deleteDialogError}
        isOpen={Boolean(pendingResumeDeletion)}
        isProcessing={Boolean(deletingId)}
        onCancel={() => {
          if (!deletingId) {
            setDeleteDialogError("");
            setPendingResumeDeletion(null);
          }
        }}
        onConfirm={confirmResumeDeletion}
        processingLabel="Deleting..."
        title={pendingResumeDeletion ? `Permanently delete "${pendingResumeDeletion.resumeVersion.name}"?` : "Permanently delete resume?"}
      />
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel={pendingDefaultAssignment ? `Assign to ${pendingDefaultAssignment.expectedUnassignedCount} application${pendingDefaultAssignment.expectedUnassignedCount === 1 ? "" : "s"}` : "Assign default"}
        description={pendingDefaultAssignment ? `"${pendingDefaultAssignment.resumeVersion.name}" will be assigned to ${pendingDefaultAssignment.expectedUnassignedCount} application${pendingDefaultAssignment.expectedUnassignedCount === 1 ? "" : "s"} that currently have no resume. Existing resume assignments will not be changed. This does not change application status or dates.` : ""}
        errorMessage={defaultAssignmentError}
        isOpen={Boolean(pendingDefaultAssignment)}
        isProcessing={isAssigningDefault}
        onCancel={() => { if (!isAssigningDefault) { setDefaultAssignmentError(""); setPendingDefaultAssignment(null); } }}
        onConfirm={confirmDefaultAssignment}
        processingLabel="Assigning..."
        title="Assign the default resume?"
      />
    </div>
  );
}
