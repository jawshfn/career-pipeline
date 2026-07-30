import React, { useEffect, useState } from "react";

import ConfirmationDialog from "../ui/ConfirmationDialog.jsx";

function OptionRow({ checked, description, label, name, onChange, value }) {
  return <label className="status-transition-option"><input checked={checked} name={name} type="radio" value={value} onChange={onChange} /><span><strong>{label}</strong><small>{description}</small></span></label>;
}

export default function StatusTransitionDialog({ decision, errorMessage, isProcessing, onCancel, onConfirm }) {
  const [intent, setIntent] = useState(decision.defaultIntent || "not_submitted");
  const [confirmedStage, setConfirmedStage] = useState(decision.defaultConfirmedStage || "Applied");

  useEffect(() => {
    setIntent(decision.defaultIntent || "not_submitted");
    setConfirmedStage(decision.defaultConfirmedStage || "Applied");
  }, [decision]);

  const isTerminal = decision.type === "terminal_submission";
  const needsStage = isTerminal && intent === "submitted";
  const isTerminalReopen = ["Rejected", "Withdrawn"].includes(decision.previousStatus);
  const title = isTerminal ? "Close this application?" : decision.type === "reset_to_saved" ? "Mark this application as Saved?" : `Move back to ${decision.nextStatus}?`;
  const prompt = isTerminal
    ? "Was this application submitted before it was closed?"
    : decision.type === "reset_to_saved" ? "This will mark the opportunity as not submitted, clear its application date, and remove it from Outcome Insights."
      : isTerminalReopen
        ? `This will reopen the application at ${decision.nextStatus} and change its highest confirmed stage from ${decision.existingConfirmedStage} to ${decision.nextStatus}. Outcome Insights will be updated.`
        : `This will change the current status and highest confirmed stage from ${decision.existingConfirmedStage} to ${decision.nextStatus}. Outcome Insights will be updated.`;

  return <ConfirmationDialog
    cancelLabel="Cancel"
    confirmLabel={decision.type === "reset_to_saved" ? "Mark as Saved" : decision.type === "backward_active_correction" ? `Move back to ${decision.nextStatus}` : "Update status"}
    description={<div className="status-transition-dialog"><p>{prompt}</p>{isTerminal ? <><fieldset><legend>Submission history</legend><OptionRow checked={intent === "not_submitted"} description="Keep the highest confirmed stage at Saved. This application will not be included in Outcome Insights." label="Not submitted" name="status-transition-intent" value="not_submitted" onChange={() => setIntent("not_submitted")} /><OptionRow checked={intent === "submitted"} description="Choose the highest stage the application genuinely reached." label="Submitted" name="status-transition-intent" value="submitted" onChange={() => setIntent("submitted")} /></fieldset>{needsStage ? <label className="status-transition-stage">Highest confirmed stage<select value={confirmedStage} onChange={(event) => setConfirmedStage(event.target.value)}>{decision.validConfirmedStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select><small>This stage determines historical Outcome Insights.</small></label> : null}</> : null}</div>}
    errorMessage={errorMessage}
    isOpen
    isProcessing={isProcessing}
    processingLabel="Updating..."
    title={title}
    onCancel={onCancel}
    onConfirm={() => onConfirm(intent, confirmedStage)}
  />;
}
