import React from "react";

import AutoGrowingTextarea from "../ui/AutoGrowingTextarea.jsx";

export default function RedFlagsTab({ formData, redFlagOptions, updateField }) {
  return (
    <div className="detail-field-group detail-field-group-wide red-flags-group">
      <h3>Red flags</h3>
      <div className="red-flags-checklist">
        {redFlagOptions.map((option) => (
          <label
            className={`checkbox-field${formData[option.name] ? " is-selected" : ""}`}
            key={option.name}
          >
            <span className="checkbox-field-heading">
              <input
                checked={formData[option.name]}
                name={option.name}
                onChange={updateField}
                type="checkbox"
              />
              <strong>{option.label}</strong>
            </span>
            {option.description ? (
              <span className="checkbox-field-description">
                <small>{option.description}</small>
              </span>
            ) : null}
          </label>
        ))}
      </div>

      <label className="detail-notes-field">
        Red flag notes
        <span className="field-helper">Explain why you marked the selected flags or what you want to verify.</span>
        <AutoGrowingTextarea
          maxRows={4}
          name="red_flags_notes"
          value={formData.red_flags_notes}
          onChange={updateField}
          rows={1}
          placeholder="Add context about anything that seems suspicious or worth verifying"
        />
      </label>
    </div>
  );
}
