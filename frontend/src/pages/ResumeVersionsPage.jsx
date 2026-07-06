import React, { useEffect, useState } from "react";

import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

const initialCreateForm = {
  name: "",
  target_role: "",
  description: "",
};

function toEditForm(resumeVersion) {
  return {
    name: resumeVersion.name || "",
    target_role: resumeVersion.target_role || "",
    description: resumeVersion.description || "",
  };
}

function toPayload(formData) {
  return {
    name: formData.name.trim(),
    target_role: formData.target_role.trim() || null,
    description: formData.description.trim() || null,
  };
}

function formatDateTime(value) {
  if (!value) {
    return "-";
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
  onUpdateResumeVersion,
  resumeVersions,
}) {
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialCreateForm);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    onLoadResumeVersions({ includeInactive });
  }, [includeInactive, onLoadResumeVersions]);

  function updateCreateField(event) {
    const { name, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: value }));
    setActionMessage("");
  }

  function updateEditField(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
    setActionMessage("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    setIsCreating(true);

    try {
      const created = await onCreateResumeVersion(toPayload(createForm));
      setCreateForm(initialCreateForm);
      setActionMessage(`${created.name} created.`);
    } catch (creationError) {
      setActionError(creationError.message || "Could not create resume version.");
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(resumeVersion) {
    setEditingId(resumeVersion.id);
    setEditForm(toEditForm(resumeVersion));
    setActionError("");
    setActionMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(initialCreateForm);
  }

  async function handleSaveEdit(resumeVersionId) {
    setActionError("");
    setActionMessage("");
    setSavingId(resumeVersionId);

    try {
      const updated = await onUpdateResumeVersion(resumeVersionId, toPayload(editForm));
      setEditingId(null);
      setEditForm(initialCreateForm);
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

  return (
    <div className="resume-versions-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Resume library</p>
          <h2>Resume Versions</h2>
          <p>Manage reusable resume variants for different roles and applications.</p>
        </div>
      </header>

      <section className="panel resume-version-create-panel" aria-labelledby="create-resume-version-title">
        <div className="section-heading">
          <h2 id="create-resume-version-title">Create Resume Version</h2>
          <p>Add a reusable resume variant without changing application records.</p>
        </div>

        {actionError ? <ErrorMessage message={actionError} /> : null}
        {actionMessage ? (
          <div className="message message-success" role="status">
            {actionMessage}
          </div>
        ) : null}

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
            <textarea
              name="description"
              value={createForm.description}
              onChange={updateCreateField}
              rows="3"
              placeholder="Short positioning note or key differences"
            />
          </label>

          <div className="form-actions">
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create version"}
            </button>
          </div>
        </form>
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

        {isLoading ? <LoadingState message="Loading resume versions..." /> : null}
        {!isLoading && error ? <ErrorMessage message={error} /> : null}

        {!isLoading && !error && visibleResumeVersions.length === 0 ? (
          <div className="empty-state">
            <h3>No resume versions yet</h3>
            <p>Create a resume version to make assignment easier in Quick Add and Application Detail.</p>
          </div>
        ) : null}

        {!isLoading && !error && visibleResumeVersions.length > 0 ? (
          <div className="resume-version-list">
            {visibleResumeVersions.map((resumeVersion) => {
              const isEditing = editingId === resumeVersion.id;
              const isSaving = savingId === resumeVersion.id;

              return (
                <article
                  className={`resume-version-card ${resumeVersion.is_active ? "" : "resume-version-card-inactive"}`}
                  key={resumeVersion.id}
                >
                  {isEditing ? (
                    <div className="resume-version-edit-form">
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
                        <textarea
                          name="description"
                          value={editForm.description}
                          onChange={updateEditField}
                          rows="3"
                        />
                      </label>

                      <div className="resume-version-actions">
                        <button className="secondary-button" type="button" onClick={cancelEditing}>
                          Cancel
                        </button>
                        <button
                          className="primary-small-button"
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveEdit(resumeVersion.id)}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
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

                      <p className="resume-version-description">
                        {resumeVersion.description || "No description yet."}
                      </p>

                      <dl className="resume-version-meta">
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatDateTime(resumeVersion.updated_at)}</dd>
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
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
