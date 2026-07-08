import React from "react";

export default function StatusFollowUpTab({
  followUpPresets,
  formData,
  getPresetDate,
  setFollowUpDate,
  statusOptions,
  updateField,
}) {
  return (
    <div className="detail-field-group detail-field-group-wide">
      <h3>Status & Follow-up</h3>
      <p className="detail-tab-helper">
        Saved Date is when the job was added. Applied Date is when you submitted the application.
      </p>
      <div className="detail-field-grid detail-dates-grid">
        <label>
          Status
          <select name="status" value={formData.status} onChange={updateField}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          Saved date
          <input
            name="date_saved"
            type="date"
            value={formData.date_saved}
            onChange={updateField}
            required
          />
        </label>

        <label>
          Date applied
          <input
            name="date_applied"
            type="date"
            value={formData.date_applied}
            onChange={updateField}
          />
          <span className="field-helper">Use the date you actually submitted the application.</span>
        </label>

        <label>
          Follow-up date
          <input
            name="follow_up_date"
            type="date"
            value={formData.follow_up_date}
            onChange={updateField}
          />
          <div className="follow-up-presets" aria-label="Follow-up date presets">
            {followUpPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setFollowUpDate(getPresetDate(preset.daysFromToday))}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" onClick={() => setFollowUpDate("")}>
              Clear
            </button>
          </div>
        </label>

        <label className="detail-field-grid-span">
          Next Action
          <input
            name="next_action"
            value={formData.next_action}
            onChange={updateField}
            placeholder="Follow up with recruiter, prepare for interview, check portal..."
          />
          <span className="field-helper">The next thing you plan to do for this opportunity.</span>
        </label>
      </div>
    </div>
  );
}
