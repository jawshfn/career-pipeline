import React, { useMemo, useRef, useState } from "react";

import { createApplicationActivity } from "../api/applicationActivitiesApi.js";
import CommandCenterSection from "../components/command-center/CommandCenterSection.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

const staleExcludedStatuses = new Set(["Offer", "Rejected", "Withdrawn", "Archived"]);

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareDateValues(firstValue, secondValue) {
  return String(firstValue || "").localeCompare(String(secondValue || ""));
}

function isSnoozeLaterThanCurrent(application, targetDateValue) {
  if (!application.follow_up_date || !targetDateValue) {
    return false;
  }

  return targetDateValue > application.follow_up_date;
}

function getAvailableFollowUpActions(application) {
  const today = new Date();
  const snooze3Date = formatLocalDate(addDays(today, 3));
  const snooze7Date = formatLocalDate(addDays(today, 7));

  return {
    snooze3: isSnoozeLaterThanCurrent(application, snooze3Date),
    snooze7: isSnoozeLaterThanCurrent(application, snooze7Date),
  };
}

function getFollowUpActivityNote(baseNote, application) {
  const nextAction = String(application.next_action || "").trim();
  return nextAction ? `${baseNote} Next action: ${nextAction}.` : baseNote;
}

function getActionItems(applications) {
  const today = new Date();
  const todayValue = formatLocalDate(today);
  const upcomingCutoffValue = formatLocalDate(addDays(today, 3));
  const staleCutoffTimestamp = addDays(today, -14).getTime();

  const overdueFollowups = applications
    .filter((application) => application.follow_up_date && application.follow_up_date < todayValue)
    .sort(
      (firstApplication, secondApplication) =>
        compareDateValues(firstApplication.follow_up_date, secondApplication.follow_up_date) ||
        compareDateValues(secondApplication.updated_at, firstApplication.updated_at),
    );

  const upcomingFollowups = applications
    .filter(
      (application) =>
        application.follow_up_date &&
        application.follow_up_date >= todayValue &&
        application.follow_up_date <= upcomingCutoffValue,
    )
    .sort(
      (firstApplication, secondApplication) =>
        compareDateValues(firstApplication.follow_up_date, secondApplication.follow_up_date) ||
        compareDateValues(secondApplication.updated_at, firstApplication.updated_at),
    );

  const staleApplications = applications
    .filter((application) => {
      const updatedTimestamp = parseTimestamp(application.updated_at);
      return (
        !application.follow_up_date &&
        !staleExcludedStatuses.has(application.status) &&
        updatedTimestamp !== null &&
        updatedTimestamp < staleCutoffTimestamp
      );
    })
    .sort((firstApplication, secondApplication) =>
      compareDateValues(firstApplication.updated_at, secondApplication.updated_at),
    );

  return {
    overdue_followups: overdueFollowups,
    upcoming_followups: upcomingFollowups,
    stale_applications: staleApplications,
  };
}

export default function CommandCenterPage({
  applications,
  error,
  isLoading,
  onUpdateApplication,
}) {
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const actionInFlightRef = useRef(new Set());
  const actionItems = useMemo(() => getActionItems(applications), [applications]);

  async function logFollowUpActivity(application, note) {
    await createApplicationActivity(application.id, {
      activity_date: formatLocalDate(new Date()),
      activity_type: "Follow-up",
      note: getFollowUpActivityNote(note, application),
    });
  }

  async function updateFollowUp(application, nextFollowUpDate, message, activityNote) {
    if (actionInFlightRef.current.has(application.id)) {
      return;
    }

    actionInFlightRef.current.add(application.id);
    setActionError("");
    setActionMessage("");
    setUpdatingApplicationId(application.id);

    try {
      await onUpdateApplication(application.id, { follow_up_date: nextFollowUpDate });
      setActionMessage(message);

      try {
        await logFollowUpActivity(application, activityNote);
      } catch (activityError) {
        setActionError(activityError.message || "Follow-up updated, but activity could not be logged.");
      }
    } catch (updateError) {
      setActionError(updateError.message || "Could not update follow-up date.");
    } finally {
      actionInFlightRef.current.delete(application.id);
      setUpdatingApplicationId(null);
    }
  }

  function handleFollowUpAction(application, action) {
    const today = new Date();
    const availableActions = getAvailableFollowUpActions(application);

    if (action === "snooze-3") {
      if (!availableActions.snooze3) {
        return;
      }

      updateFollowUp(
        application,
        formatLocalDate(addDays(today, 3)),
        "Follow-up snoozed for 3 days.",
        "Snoozed follow-up 3 days.",
      );
      return;
    }

    if (action === "snooze-7") {
      if (!availableActions.snooze7) {
        return;
      }

      updateFollowUp(
        application,
        formatLocalDate(addDays(today, 7)),
        "Follow-up snoozed for 1 week.",
        "Snoozed follow-up 1 week.",
      );
      return;
    }

    updateFollowUp(application, null, "Follow-up cleared.", "Cleared follow-up date.");
  }

  const hasActionItems =
    actionItems.overdue_followups.length > 0 ||
    actionItems.upcoming_followups.length > 0 ||
    actionItems.stale_applications.length > 0;

  return (
    <div className="command-center-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily Command Center</p>
          <h2>Command Center</h2>
          <p>See follow-ups and stale applications that need attention.</p>
        </div>
      </header>

      {isLoading ? <LoadingState message="Loading action items..." /> : null}
      {!isLoading && error ? <ErrorMessage message={error} /> : null}
      {!isLoading && actionError ? <ErrorMessage message={actionError} /> : null}
      {!isLoading && actionMessage ? (
        <div className="message message-success command-center-message" role="status">
          {actionMessage}
        </div>
      ) : null}
      {!isLoading && !error && !hasActionItems ? (
        <div className="empty-state">
          <h3>No urgent follow-ups today</h3>
          <p>Add follow-up dates and next actions to keep your search moving.</p>
        </div>
      ) : null}
      {!isLoading && !error && hasActionItems ? (
        <div className="command-center-grid">
          <CommandCenterSection
            accent="overdue"
            applications={actionItems.overdue_followups}
            description="Follow-up dates before today."
            getAvailableFollowUpActions={getAvailableFollowUpActions}
            onFollowUpAction={handleFollowUpAction}
            title="Overdue Follow-ups"
            updatingApplicationId={updatingApplicationId}
          />
          <CommandCenterSection
            accent="upcoming"
            applications={actionItems.upcoming_followups}
            description="Follow-ups due today through the next 3 days."
            getAvailableFollowUpActions={getAvailableFollowUpActions}
            onFollowUpAction={handleFollowUpAction}
            title="Upcoming Follow-ups"
            updatingApplicationId={updatingApplicationId}
          />
          <CommandCenterSection
            accent="stale"
            applications={actionItems.stale_applications}
            description="Active applications without a follow-up and no recent update."
            title="Stale Applications"
            showUpdatedAt
          />
        </div>
      ) : null}
    </div>
  );
}
