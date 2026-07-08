import React from "react";

export default function ApplicationDetailOverview({
  attentionItems,
  onOpenTab,
  openableJobLink,
  overviewSnapshotItems,
}) {
  return (
    <div className="detail-overview-panel">
      <h3>Overview</h3>
      <p className="detail-tab-helper">
        A read-only command snapshot. Use the shortcuts to edit details in the focused tabs.
      </p>

      <div className="detail-overview-grid" aria-label="Opportunity snapshot">
        {overviewSnapshotItems.map(([label, value]) => (
          <div className="detail-overview-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {label === "Job link" && openableJobLink ? (
              <a href={openableJobLink} rel="noreferrer" target="_blank">
                Open posting
              </a>
            ) : null}
          </div>
        ))}
      </div>

      <div className="detail-overview-section">
        <div className="detail-overview-section-heading">
          <h4>Needs attention</h4>
          <span>
            {attentionItems.length === 1 ? "1 suggestion" : `${attentionItems.length} suggestions`}
          </span>
        </div>
        {attentionItems.length > 0 ? (
          <div className="detail-attention-list">
            {attentionItems.map(([title, description, tabId]) => (
              <button
                className="detail-attention-item"
                key={title}
                type="button"
                onClick={() => onOpenTab(tabId)}
              >
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <em>Open</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="detail-overview-empty-state">
            <strong>Looks organized</strong>
            <p>All key details have been filled in. Use the tabs above if you want to make changes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
