import React, { useEffect, useState } from "react";

import {
  createApplicationActivity,
  deleteApplicationActivity,
  getApplicationActivities,
} from "../../api/applicationActivitiesApi.js";
import ErrorMessage from "../ui/ErrorMessage.jsx";
import LoadingState from "../ui/LoadingState.jsx";

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

function formatDate(value) {
  return value || "-";
}

export default function ApplicationActivityTimeline({
  applicationId,
  draftData,
  isActive,
  onDraftChange,
  onResetDraft,
}) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadActivities() {
      setIsLoading(true);
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
  }, [applicationId]);

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

  async function handleDeleteActivity(activityId) {
    if (!window.confirm("Delete this activity entry?")) {
      return;
    }

    setDeletingActivityId(activityId);
    setError("");
    setMessage("");

    try {
      await deleteApplicationActivity(applicationId, activityId);
      setActivities((currentActivities) =>
        currentActivities.filter((activity) => activity.id !== activityId),
      );
      setMessage("Activity deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete activity.");
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
              <textarea
                name="note"
                rows="3"
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
            <p className="activity-empty-state">No activity yet. Add updates as this opportunity moves forward.</p>
          ) : null}
          {activities.length > 0 ? (
            <div className="activity-list">
              {activities.map((activity) => (
                <article className="activity-item" key={activity.id}>
                  <div className="activity-item-header">
                    <div>
                      <time dateTime={activity.activity_date}>{formatDate(activity.activity_date)}</time>
                      <span className="activity-type-badge">{activity.activity_type}</span>
                    </div>
                    <button
                      className="quiet-danger-button"
                      type="button"
                      disabled={deletingActivityId === activity.id}
                      onClick={() => handleDeleteActivity(activity.id)}
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
    </section>
  );
}
