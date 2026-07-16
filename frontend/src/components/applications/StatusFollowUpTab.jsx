import React from "react";

import AutoGrowingTextarea from "../ui/AutoGrowingTextarea.jsx";

export default function StatusFollowUpTab({
  followUpPresets,
  formData,
  getPresetDate,
  setFollowUpDate,
  updateField,
}) {
  return (
    <div className="detail-field-group detail-field-group-wide">
      <h3>Follow-up</h3>
      <p className="detail-tab-helper">
        Track application dates, reminders, and the next thing to do.
      </p>
      <div className="detail-field-grid detail-dates-grid">
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
          <AutoGrowingTextarea
            className="detail-next-action-field"
            maxRows={4}
            name="next_action"
            rows={1}
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
