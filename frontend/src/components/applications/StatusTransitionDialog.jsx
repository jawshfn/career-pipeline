import React, { useEffect, useState } from "react";

import ConfirmationDialog from "../ui/ConfirmationDialog.jsx";

function OptionRow({ checked, description, label, name, onChange, value }) {
  return <label className="status-transition-option"><input checked={checked} name={name} type="radio" value={value} onChange={onChange} /><span><strong>{label}</strong><small>{description}</small></span></label>;
}

export default function StatusTransitionDialog({ decision, errorMessage, isProcessing, onCancel, onConfirm }) {
  const [intent, setIntent] = useState(decision.defaultIntent);
  const [confirmedStage, setConfirmedStage] = useState(decision.defaultConfirmedStage);

  useEffect(() => {
    setIntent(decision.defaultIntent);
    setConfirmedStage(decision.defaultConfirmedStage);
  }, [decision]);

  const isTerminal = decision.type === "terminal_submission";
  const needsStage = isTerminal ? intent === "submitted" : intent === "correct";
  const title = isTerminal ? "Close this application?" : `Change status to ${decision.nextStatus}?`;
  const prompt = isTerminal
    ? "Was this application submitted before it was closed?"
    : "This status is earlier than the highest confirmed stage.";

  return <ConfirmationDialog
    cancelLabel="Cancel"
    confirmLabel="Update status"
    description={<div className="status-transition-dialog"><p>{prompt}</p><fieldset><legend>{isTerminal ? "Submission history" : "Confirmed history"}</legend>{isTerminal ? <><OptionRow checked={intent === "not_submitted"} description="Keep the highest confirmed stage at Saved. This application will not be included in Outcome Insights." label="Not submitted" name="status-transition-intent" value="not_submitted" onChange={() => setIntent("not_submitted")} /><OptionRow checked={intent === "submitted"} description="Choose the highest stage the application genuinely reached." label="Submitted" name="status-transition-intent" value="submitted" onChange={() => setIntent("submitted")} /></> : <><OptionRow checked={intent === "preserve"} description={`The application genuinely reached ${decision.existingConfirmedStage}.`} label="Preserve confirmed history" name="status-transition-intent" value="preserve" onChange={() => setIntent("preserve")} /><OptionRow checked={intent === "correct"} description="The later stage was recorded by mistake." label="Correct confirmed history" name="status-transition-intent" value="correct" onChange={() => setIntent("correct")} /></>}</fieldset>{needsStage ? <label className="status-transition-stage">Highest confirmed stage<select value={confirmedStage} onChange={(event) => setConfirmedStage(event.target.value)}>{decision.validConfirmedStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select><small>This stage determines historical Outcome Insights.</small></label> : null}</div>}
    errorMessage={errorMessage}
    isOpen
    isProcessing={isProcessing}
    processingLabel="Updating..."
    title={title}
    onCancel={onCancel}
    onConfirm={() => onConfirm(intent, confirmedStage)}
  />;
}
