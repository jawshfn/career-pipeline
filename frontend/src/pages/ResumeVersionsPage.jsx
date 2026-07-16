import React, { useEffect, useRef, useState } from "react";

import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import AutoGrowingTextarea from "../components/ui/AutoGrowingTextarea.jsx";

const initialCreateForm = {
  name: "",
  target_role: "",
  description: "",
};

export const RESUME_EDIT_SWITCH_CONFIRM_MESSAGE = "You have unsaved changes. Switch resumes without saving?";
export const RESUME_EDIT_CANCEL_CONFIRM_MESSAGE = "You have unsaved changes. Cancel editing without saving?";

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

export function resolveResumeEditSwitch(currentState, nextResumeVersion, confirmLeave) {
  const nextResumeId = nextResumeVersion.id;
  const isSwitchingResume = currentState.editingId && currentState.editingId !== nextResumeId;

  if (
    isSwitchingResume &&
    isResumeEditDirty(currentState.editingId, currentState.editForm, currentState.editFormBaseline) &&
    !confirmLeave(RESUME_EDIT_SWITCH_CONFIRM_MESSAGE)
  ) {
    return currentState;
  }

  return {
    ...currentState,
    ...getEditStateForResume(nextResumeVersion),
    actionError: "",
    actionMessage: "",
  };
}

export function resolveResumeEditCancel(currentState, confirmLeave) {
  if (
    isResumeEditDirty(currentState.editingId, currentState.editForm, currentState.editFormBaseline) &&
    !confirmLeave(RESUME_EDIT_CANCEL_CONFIRM_MESSAGE)
  ) {
    return currentState;
  }

  return {
    ...currentState,
    ...getCleanEditState(),
  };
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
  error,
  isLoading,
  onCreateResumeVersion,
  onLoadResumeVersions,
  onUnsavedChangesChange,
  onUpdateResumeVersion,
  resumeVersions,
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
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(resumeVersions.length === 0);
  const createDisclosureInitialized = useRef(false);
  const editSurfaceRef = useRef(null);

  useEffect(() => {
    onLoadResumeVersions({ includeInactive });
  }, [includeInactive, onLoadResumeVersions]);

  useEffect(() => {
    if (!isLoading && !createDisclosureInitialized.current) {
      setIsCreateOpen(resumeVersions.length === 0);
      createDisclosureInitialized.current = true;
    }
  }, [isLoading, resumeVersions.length]);

  useEffect(() => {
    if (editingId) editSurfaceRef.current?.focus();
  }, [editingId]);

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
    const nextState = resolveResumeEditSwitch(
      {
        actionError,
        actionMessage,
        editingId,
        editForm,
        editFormBaseline,
      },
      resumeVersion,
      window.confirm,
    );

    setEditingId(nextState.editingId);
    setEditForm(nextState.editForm);
    setEditFormBaseline(nextState.editFormBaseline);
    setActionError(nextState.actionError);
    setActionMessage(nextState.actionMessage);
    if (nextState.editingId === resumeVersion.id) {
      setIsCreateOpen(false);
    }
  }

  function cancelEditing() {
    const nextState = resolveResumeEditCancel(
      {
        editingId,
        editForm,
        editFormBaseline,
      },
      window.confirm,
    );

    setEditingId(nextState.editingId);
    setEditForm(nextState.editForm);
    setEditFormBaseline(nextState.editFormBaseline);
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

  const visibleResumeVersions = includeInactive
    ? resumeVersions
    : resumeVersions.filter((resumeVersion) => resumeVersion.is_active);
  const editingResumeVersion = resumeVersions.find((resumeVersion) => resumeVersion.id === editingId);
  const remainingVisibleResumeVersions = visibleResumeVersions.filter((resumeVersion) => resumeVersion.id !== editingId);

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
          <summary id="create-resume-version-title" className="resume-version-disclosure-summary">
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
        {!isLoading && !editingId && actionError ? <ErrorMessage message={actionError} /> : null}

        {isLoading ? <LoadingState message="Loading resume versions..." /> : null}
        {!isLoading && error ? <ErrorMessage message={error} /> : null}

        {!isLoading && !error && visibleResumeVersions.length === 0 ? (
          <div className="empty-state">
            <h3>No resume versions yet</h3>
            <p>Create resume versions to track which resume is tied to each opportunity.</p>
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

              <div className="resume-version-actions">
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
            </div>
          </article>
        ) : null}

        {!isLoading && !error && remainingVisibleResumeVersions.length > 0 ? (
          <div className="resume-version-list">
            {remainingVisibleResumeVersions.map((resumeVersion) => {
              const isSaving = savingId === resumeVersion.id;

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
                        <span className={`resume-version-state ${resumeVersion.is_active ? "" : "resume-version-state-inactive"}`}>
                          {resumeVersion.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {resumeVersion.description ? (
                        <p className="resume-version-description">{resumeVersion.description}</p>
                      ) : null}

                      <dl className="resume-version-meta">
                        <div>
                          <dt>Updated</dt>
                          <dd>
                            <time
                              aria-label={formatResumeUpdatedTimestamp(resumeVersion.updated_at) || "Updated date unavailable"}
                              dateTime={resumeVersion.updated_at || undefined}
                              title={formatResumeUpdatedTimestamp(resumeVersion.updated_at) || undefined}
                            >
                              {formatResumeUpdatedDate(resumeVersion.updated_at)}
                            </time>
                          </dd>
                        </div>
                      </dl>

                      <div className="resume-version-actions">
                        <button className="secondary-button" type="button" onClick={() => startEditing(resumeVersion)}>
                          Edit
                        </button>
                        <button
                          className={`secondary-button ${resumeVersion.is_active ? "quiet-danger-button" : ""}`}
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleActiveToggle(resumeVersion)}
                        >
                          {isSaving
                            ? "Saving..."
                            : resumeVersion.is_active
                              ? "Deactivate"
                              : "Reactivate"}
                        </button>
                      </div>
                  </>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
