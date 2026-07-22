import React, { useCallback, useEffect, useRef, useState } from "react";

import { getApplicationActionItems } from "../services/applicationsService.js";
import CommandCenterSection from "../components/command-center/CommandCenterSection.jsx";
import DailyRemindersHeader from "../components/command-center/DailyRemindersHeader.jsx";
import FollowUpActionDialog from "../components/command-center/FollowUpActionDialog.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

const emptyActionItems = { overdue_followups: [], upcoming_followups: [], stale_applications: [] };

export default function CommandCenterPage({ onApplyFollowUpAction }) {
  const [actionItems, setActionItems] = useState(emptyActionItems);
  const [actionItemsError, setActionItemsError] = useState("");
  const [isActionItemsLoading, setIsActionItemsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [selectedReminderApplication, setSelectedReminderApplication] = useState(null);
  const [isReminderActionProcessing, setIsReminderActionProcessing] = useState(false);
  const [reminderDialogError, setReminderDialogError] = useState("");
  const [hasReminderStateConflict, setHasReminderStateConflict] = useState(false);
  const actionInFlightRef = useRef(new Set());

  const loadActionItems = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsActionItemsLoading(true);
    setActionItemsError("");
    try {
      const nextActionItems = await getApplicationActionItems();
      setActionItems({ overdue_followups: nextActionItems.overdue_followups || [], upcoming_followups: nextActionItems.upcoming_followups || [], stale_applications: nextActionItems.stale_applications || [] });
    } catch (error) {
      setActionItems(emptyActionItems);
      setActionItemsError(error.message || "Could not load reminder action items.");
    } finally { if (showLoading) setIsActionItemsLoading(false); }
  }, []);

  useEffect(() => { loadActionItems(); }, [loadActionItems]);

  function handleManageReminder(application) {
    setActionMessage(""); setReminderDialogError(""); setHasReminderStateConflict(false); setSelectedReminderApplication(application);
  }
  function handleCloseDialog() {
    if (isReminderActionProcessing) return;
    setSelectedReminderApplication(null); setReminderDialogError(""); setHasReminderStateConflict(false);
  }
  async function handleApplyReminderAction(payload, successMessage) {
    const application = selectedReminderApplication;
    if (!application || actionInFlightRef.current.has(application.id) || hasReminderStateConflict) return;
    actionInFlightRef.current.add(application.id);
    setIsReminderActionProcessing(true); setReminderDialogError(""); setActionMessage("");
    try {
      await onApplyFollowUpAction(application.id, payload);
      await loadActionItems({ showLoading: false });
      setSelectedReminderApplication(null); setHasReminderStateConflict(false); setActionMessage(successMessage);
    } catch (error) {
      const message = error.message || "Could not update this reminder.";
      if (/changed after it was loaded/i.test(message)) {
        setReminderDialogError(message);
        await loadActionItems({ showLoading: false });
        setHasReminderStateConflict(true);
      } else setReminderDialogError(message);
    } finally {
      actionInFlightRef.current.delete(application.id); setIsReminderActionProcessing(false);
    }
  }

  const hasActionItems = actionItems.overdue_followups.length > 0 || actionItems.upcoming_followups.length > 0 || actionItems.stale_applications.length > 0;
  return <div className="command-center-page">
    <DailyRemindersHeader />
    {!isActionItemsLoading && actionMessage ? <div className="message command-center-message" role="status">{actionMessage}</div> : null}
    {isActionItemsLoading ? <LoadingState message="Loading action items..." /> : null}
    {!isActionItemsLoading && actionItemsError ? <ErrorMessage message={actionItemsError} /> : null}
    {!isActionItemsLoading && !actionItemsError && !hasActionItems ? <div className="empty-state command-center-all-clear"><h3>No urgent follow-ups today</h3><p>Add follow-up dates and next actions to keep your search moving.</p></div> : null}
    {!isActionItemsLoading && !actionItemsError && hasActionItems ? <div className="command-center-layout"><div className="command-center-grid">
      {actionItems.overdue_followups.length > 0 ? <CommandCenterSection accent="overdue" applications={actionItems.overdue_followups} description="Follow-up dates before today." onManageReminder={handleManageReminder} title="Overdue Follow-ups" updatingApplicationId={isReminderActionProcessing ? selectedReminderApplication?.id : null} /> : null}
      {actionItems.upcoming_followups.length > 0 ? <CommandCenterSection accent="upcoming" applications={actionItems.upcoming_followups} description="Follow-ups due today through the next 3 days." onManageReminder={handleManageReminder} title="Upcoming Follow-ups" updatingApplicationId={isReminderActionProcessing ? selectedReminderApplication?.id : null} /> : null}
      {actionItems.stale_applications.length > 0 ? <CommandCenterSection accent="stale" applications={actionItems.stale_applications} description="Active applications without a follow-up and no recent update." title="Needs check-in" showUpdatedAt /> : null}
    </div></div> : null}
    <FollowUpActionDialog application={selectedReminderApplication} errorMessage={reminderDialogError} hasStateConflict={hasReminderStateConflict} isOpen={Boolean(selectedReminderApplication)} isProcessing={isReminderActionProcessing} onCancel={handleCloseDialog} onSubmit={handleApplyReminderAction} />
  </div>;
}
