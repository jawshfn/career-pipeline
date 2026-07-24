import React, { useEffect, useRef, useState } from "react";

import {
  createApplicationActivity,
  deleteApplicationActivity,
  getApplicationActivities,
} from "../../services/applicationActivitiesService.js";
import ErrorMessage from "../ui/ErrorMessage.jsx";
import ConfirmationDialog from "../ui/ConfirmationDialog.jsx";
import LoadingState from "../ui/LoadingState.jsx";
import AutoGrowingTextarea from "../ui/AutoGrowingTextarea.jsx";
import { normalizeUtcTimestamp } from "../../utils/dateFormatting.js";

const activityTypeOptions = [
  "Note",
  "Applied",
  "Follow-up",
  "Recruiter contact",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Other",
];

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialActivityForm() {
  return {
    activity_date: formatLocalDate(new Date()),
    activity_type: "Note",
    note: "",
  };
}

export { getInitialActivityForm };

export function formatActivityDate(value) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!dateParts) {
    return value || "-";
  }

  const [, year, month, day] = dateParts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatLoggedTime(value) {
  const timestamp = normalizeUtcTimestamp(value);
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function getActivityNotePreview(note, limit = 120) {
  const normalized = String(note || "").trim().replace(/\s+/g, " ");
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}…` : normalized;
}

export function shouldShowActivityLoadingState({
  applicationChanged,
  currentIsLoading = false,
  hasExistingActivities,
}) {
  return Boolean(applicationChanged || !hasExistingActivities || currentIsLoading);
}

export default function ApplicationActivityTimeline({
  applicationId,
  draftData,
  isActive,
  onDraftChange,
  onResetDraft,
  refreshVersion = 0,
}) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState(null);
  const [pendingActivityDeletion, setPendingActivityDeletion] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const previousApplicationIdRef = useRef(applicationId);

  useEffect(() => {
    let isCurrent = true;
    const applicationChanged = String(previousApplicationIdRef.current) !== String(applicationId);

    if (applicationChanged) {
      previousApplicationIdRef.current = applicationId;
      setActivities([]);
      setIsLoading(true);
    }

    async function loadActivities() {
      if (
        shouldShowActivityLoadingState({
          applicationChanged,
          currentIsLoading: isLoading,
          hasExistingActivities: activities.length > 0,
        })
      ) {
        setIsLoading(true);
      }
      setError("");
      setMessage("");

      try {
        const data = await getApplicationActivities(applicationId);
        if (isCurrent) {
          setActivities(data);
        }
      } catch (loadError) {
        if (isCurrent) {
          setError(loadError.message || "Could not load activity timeline.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadActivities();

    return () => {
      isCurrent = false;
    };
  }, [applicationId, refreshVersion]);

  function updateField(event) {
    const { name, value } = event.target;
    onDraftChange((currentDraftData) => ({ ...currentDraftData, [name]: value }));
    setMessage("");
  }

  async function handleAddActivity() {
    if (!draftData.note.trim()) {
      setError("Add a note before saving activity.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const createdActivity = await createApplicationActivity(applicationId, {
        activity_date: draftData.activity_date,
        activity_type: draftData.activity_type,
        note: draftData.note.trim(),
      });
      setActivities((currentActivities) =>
        [createdActivity, ...currentActivities].sort((firstActivity, secondActivity) =>
          secondActivity.activity_date.localeCompare(firstActivity.activity_date) ||
          secondActivity.created_at.localeCompare(firstActivity.created_at),
        ),
      );
      onResetDraft();
      setMessage("Activity added.");
    } catch (saveError) {
      setError(saveError.message || "Could not add activity.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteActivity(activity) {
    if (pendingActivityDeletion) return;
    setDeleteError("");
    setPendingActivityDeletion(activity);
  }

  function cancelDeleteActivity() {
    if (deletingActivityId) return;
    setDeleteError("");
    setPendingActivityDeletion(null);
  }

  async function handleDeleteActivity() {
    const activity = pendingActivityDeletion;
    if (!activity || deletingActivityId) return;

    setDeletingActivityId(activity.id);
    setDeleteError("");
    setMessage("");

    try {
      await deleteApplicationActivity(applicationId, activity.id);
      setActivities((currentActivities) =>
        currentActivities.filter((currentActivity) => currentActivity.id !== activity.id),
      );
      setMessage("Activity deleted.");
      setPendingActivityDeletion(null);
    } catch (deleteError) {
      setDeleteError(deleteError.message || "Could not delete activity.");
    } finally {
      setDeletingActivityId(null);
    }
  }

  return (
    <section className="detail-field-group detail-field-group-wide activity-timeline-section" hidden={!isActive}>
      <div className="activity-timeline-heading">
        <div>
          <h3>Activity timeline</h3>
          <p>Track dated updates, follow-ups, interviews, and other application events.</p>
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}
      {message ? (
        <div className="message message-success" role="status">
          {message}
        </div>
      ) : null}

      {isLoading ? <LoadingState message="Loading activity timeline..." /> : null}
      {!isLoading ? (
        <>
          <div className="activity-form-grid">
            <label>
              Activity date
              <input
                name="activity_date"
                type="date"
                value={draftData.activity_date}
                onChange={updateField}
              />
            </label>
            <label>
              Activity type
              <select name="activity_type" value={draftData.activity_type} onChange={updateField}>
                {activityTypeOptions.map((activityType) => (
                  <option key={activityType} value={activityType}>
                    {activityType}
                  </option>
                ))}
              </select>
            </label>
            <label className="activity-note-field">
              Note
              <AutoGrowingTextarea
                name="note"
                rows="1"
                maxRows={4}
                isVisible={isActive}
                value={draftData.note}
                onChange={updateField}
                placeholder="Recruiter replied, assessment completed, interview scheduled..."
              />
            </label>
            <div className="activity-form-actions">
              <button className="primary-small-button" type="button" disabled={isSaving} onClick={handleAddActivity}>
                {isSaving ? "Adding..." : "Add activity"}
              </button>
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="activity-empty-state">
              <h4>No activity yet</h4>
              <p>Add updates as this opportunity moves forward.</p>
            </div>
          ) : null}
          {activities.length > 0 ? (
            <div className="activity-list">
              {activities.map((activity) => (
                <article className="activity-item" key={activity.id}>
                  <div className="activity-item-header">
                    <div>
                      <time dateTime={activity.activity_date}>{formatActivityDate(activity.activity_date)}</time>
                      <span className="activity-type-badge">{activity.activity_type}</span>
                      {formatLoggedTime(activity.created_at) ? (
                        <span className="activity-logged-time">Logged at {formatLoggedTime(activity.created_at)}</span>
                      ) : null}
                    </div>
                    <button
                      className="quiet-danger-button"
                      type="button"
                      disabled={deletingActivityId === activity.id}
                      onClick={() => requestDeleteActivity(activity)}
                    >
                      Delete
                    </button>
                  </div>
                  <p>{activity.note}</p>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Delete activity"
        confirmTone="danger"
        description={pendingActivityDeletion ? (
          <>
            <p>This activity from {formatActivityDate(pendingActivityDeletion.activity_date)} will be permanently deleted. This action cannot be undone.</p>
            {getActivityNotePreview(pendingActivityDeletion.note) ? <p>“{getActivityNotePreview(pendingActivityDeletion.note)}”</p> : null}
          </>
        ) : ""}
        errorMessage={deleteError}
        isOpen={Boolean(pendingActivityDeletion)}
        isProcessing={Boolean(deletingActivityId)}
        onCancel={cancelDeleteActivity}
        onConfirm={handleDeleteActivity}
        processingLabel="Deleting..."
        title={pendingActivityDeletion ? `Delete ${pendingActivityDeletion.activity_type} activity?` : "Delete activity?"}
      />
    </section>
  );
}
