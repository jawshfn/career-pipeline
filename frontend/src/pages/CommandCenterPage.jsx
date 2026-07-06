import React, { useEffect, useState } from "react";

import { getApplicationActionItems } from "../api/applicationsApi.js";
import CommandCenterSection from "../components/command-center/CommandCenterSection.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

const emptyActionItems = {
  overdue_followups: [],
  upcoming_followups: [],
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
      {!isLoading && !error && !hasActionItems ? (
        <div className="empty-state">
          <h3>No action items right now</h3>
          <p>Add follow-up dates or update stale applications to keep this view useful.</p>
        </div>
      ) : null}
      {!isLoading && !error && hasActionItems ? (
        <div className="command-center-grid">
          <CommandCenterSection
            applications={actionItems.overdue_followups}
            description="Follow-up dates before today."
            title="Overdue Follow-ups"
          />
          <CommandCenterSection
            applications={actionItems.upcoming_followups}
            description="Follow-ups due today through the next 3 days."
            title="Upcoming Follow-ups"
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
