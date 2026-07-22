import React, { useEffect, useId, useState } from "react";

import StatusBadge from "../applications/StatusBadge.jsx";
import AutoGrowingTextarea from "../ui/AutoGrowingTextarea.jsx";
import ConfirmationDialog from "../ui/ConfirmationDialog.jsx";
import { formatDisplayDate } from "../../utils/dateFormatting.js";

const actionOptions = [
  { value: "complete", label: "Mark complete", copy: "Record that this follow-up was completed and remove the current reminder date.", confirmLabel: "Mark complete", successMessage: "Follow-up marked complete." },
  { value: "complete_and_schedule", label: "Complete & schedule next", copy: "Record this follow-up as completed and set the next reminder.", confirmLabel: "Complete & schedule", successMessage: "Follow-up completed and next reminder scheduled." },
  { value: "reschedule", label: "Reschedule", copy: "Move this reminder without marking the follow-up complete.", confirmLabel: "Reschedule", successMessage: "Follow-up rescheduled." },
  { value: "clear", label: "Clear reminder", copy: "Remove the reminder date without marking the follow-up complete.", confirmLabel: "Clear reminder", successMessage: "Follow-up cleared.", danger: true },
];

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function initialState(application) { return { action: "", date: "", nextActionDraft: application?.next_action || "", nextActionMode: "keep", validation: "" }; }

export default function FollowUpActionDialog({ application, errorMessage, hasStateConflict = false, isOpen, isProcessing = false, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => initialState(application));
  const actionGroupId = useId(); const nextActionGroupId = useId(); const validationId = useId();
  useEffect(() => { if (isOpen) setForm(initialState(application)); }, [application?.id, isOpen]);
  if (!application) return null;

  const selectedAction = actionOptions.find((option) => option.value === form.action);
  const needsDate = form.action === "complete_and_schedule" || form.action === "reschedule";
  const today = formatLocalDate(new Date());
  const hasNextAction = Boolean(application.next_action?.trim());
  const mutableDisabled = isProcessing || hasStateConflict;
  const updateForm = (values) => setForm((current) => ({ ...current, validation: "", ...values }));

  function handleSubmit() {
    if (!selectedAction || hasStateConflict) return;
    const validation = [];
    if (needsDate) {
      if (!form.date) validation.push("Choose a follow-up date.");
      else if (form.action === "complete_and_schedule" && form.date <= today) validation.push("Choose a date after today for the next reminder.");
      else if (form.action === "reschedule" && form.date < today) validation.push("Choose today or a future date.");
      else if (form.action === "reschedule" && form.date === application.follow_up_date) validation.push("Choose a date different from the current reminder.");
    }
    const nextAction = form.nextActionDraft.trim();
    if (form.nextActionMode === "update") {
      if (!nextAction) validation.push("Enter a Next Action or choose Keep current.");
      else if (nextAction === (application.next_action || "").trim()) validation.push("Edit the Next Action or choose Keep current.");
    }
    if (validation.length) { setForm((current) => ({ ...current, validation: validation.join(" ") })); return; }
    const payload = { action: form.action, expected_follow_up_date: application.follow_up_date };
    if (needsDate) payload.follow_up_date = form.date;
    if (form.nextActionMode === "update") payload.next_action = nextAction;
    if (form.nextActionMode === "clear") payload.next_action = null;
    onSubmit(payload, selectedAction.successMessage);
  }

  const content = <div className="follow-up-action-dialog-content">
    <div className="follow-up-action-context"><div className="follow-up-action-context-heading"><div><strong>{application.company_name}</strong><span>{application.role_title}</span></div><StatusBadge status={application.status} /></div><p><strong>Current follow-up:</strong> {formatDisplayDate(application.follow_up_date)}</p><p><strong>Next action:</strong> {hasNextAction ? application.next_action : "No next action"}</p></div>
    {hasStateConflict ? <p className="follow-up-action-conflict">This reminder changed after it was loaded. Close and reopen it before making another change.</p> : null}
    <fieldset className="follow-up-action-fieldset" disabled={mutableDisabled}>
      <legend id={actionGroupId}>Choose an action</legend>
      <div aria-labelledby={actionGroupId} className="follow-up-action-choice-grid" role="radiogroup">
        {actionOptions.map((option) => <label className={`follow-up-action-choice${form.action === option.value ? " follow-up-action-choice-selected" : ""}${option.danger ? " follow-up-action-choice-danger" : ""}`} key={option.value}><input checked={form.action === option.value} name="follow-up-action" type="radio" value={option.value} onChange={() => updateForm({ action: option.value })} /><span><strong>{option.label}</strong><small>{option.copy}</small></span></label>)}
      </div>
      {needsDate ? <div className="follow-up-action-fields"><span className="follow-up-action-label">Next reminder date</span><div className="follow-up-action-quick-dates"><button type="button" onClick={() => updateForm({ date: formatLocalDate(addDays(new Date(), 3)) })}>In 3 days</button><button type="button" onClick={() => updateForm({ date: formatLocalDate(addDays(new Date(), 7)) })}>In 1 week</button></div><label>Custom date<input aria-describedby={form.validation ? validationId : undefined} min={form.action === "complete_and_schedule" ? formatLocalDate(addDays(new Date(), 1)) : today} type="date" value={form.date} onChange={(event) => updateForm({ date: event.target.value })} /></label></div> : null}
      <div className="follow-up-action-fields"><span className="follow-up-action-label" id={nextActionGroupId}>Next Action</span><div aria-labelledby={nextActionGroupId} className="follow-up-action-next-mode" role="radiogroup"><label><input checked={form.nextActionMode === "keep"} name="next-action-mode" type="radio" onChange={() => updateForm({ nextActionMode: "keep" })} /> Keep current</label><label><input checked={form.nextActionMode === "update"} name="next-action-mode" type="radio" onChange={() => updateForm({ nextActionMode: "update" })} /> Update</label>{hasNextAction ? <label><input checked={form.nextActionMode === "clear"} name="next-action-mode" type="radio" onChange={() => updateForm({ nextActionMode: "clear" })} /> Clear</label> : null}</div>{form.nextActionMode === "update" ? <label>New Next Action<AutoGrowingTextarea maxRows={4} value={form.nextActionDraft} onChange={(event) => updateForm({ nextActionDraft: event.target.value })} /></label> : null}</div>
      {form.validation ? <p className="follow-up-action-validation" id={validationId} role="alert">{form.validation}</p> : null}
    </fieldset>
  </div>;

  return <ConfirmationDialog cancelLabel={hasStateConflict ? "Close" : "Cancel"} confirmDisabled={!selectedAction || hasStateConflict} confirmLabel={selectedAction?.confirmLabel || "Choose an action"} description={content} errorMessage={errorMessage} isOpen={isOpen} isProcessing={isProcessing} processingLabel="Updating..." size="wide" title="Manage reminder" onCancel={onCancel} onConfirm={handleSubmit} />;
}
