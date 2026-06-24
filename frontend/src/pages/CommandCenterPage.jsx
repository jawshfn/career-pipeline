import React, { useEffect, useState } from "react";

import { getApplicationActionItems } from "../api/applicationsApi.js";
import CommandCenterSection from "../components/command-center/CommandCenterSection.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

const emptyActionItems = {
  overdue_followups: [],
  due_today: [],
  stale_applications: [],
};

export default function CommandCenterPage() {
  const [actionItems, setActionItems] = useState(emptyActionItems);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadActionItems() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getApplicationActionItems();
        if (!ignore) {
          setActionItems(data);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "Could not load command center.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadActionItems();

    return () => {
      ignore = true;
    };
  }, []);

  const hasActionItems =
    actionItems.overdue_followups.length > 0 ||
    actionItems.due_today.length > 0 ||
    actionItems.stale_applications.length > 0;

  return (
    <div className="command-center-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily Command Center</p>
          <h2>Today&apos;s Actions</h2>
          <p>Review applications that need follow-up or a next step.</p>
        </div>
      </header>

      {isLoading ? <LoadingState message="Loading action items..." /> : null}
      {!isLoading && error ? <ErrorMessage message={error} /> : null}
      {!isLoading && !error && !hasActionItems ? (
        <div className="empty-state">No action items right now. Your pipeline is clear for today.</div>
      ) : null}
      {!isLoading && !error && hasActionItems ? (
        <div className="command-center-grid">
          <CommandCenterSection
            applications={actionItems.overdue_followups}
            description="Follow-up dates before today."
            title="Overdue Follow-ups"
          />
          <CommandCenterSection
            applications={actionItems.due_today}
            description="Follow-ups scheduled for today."
            title="Due Today"
          />
          <CommandCenterSection
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
