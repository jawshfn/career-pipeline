import React from "react";

export default function ApplicationDetailOverview({
  attentionItems,
  onOpenTab,
  overviewSnapshotItems,
}) {
  return (
    <div className="detail-overview-panel">
      <h3>Overview</h3>
      <p className="detail-tab-helper">
        Review the supporting details and quick context for this opportunity.
      </p>

      <div className="detail-overview-grid" aria-label="Opportunity snapshot">
        {overviewSnapshotItems.map(([label, value]) => (
          <div className={`detail-overview-card detail-overview-card-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="detail-overview-section">
        <div className="detail-overview-section-heading">
          <h4>Helpful next steps</h4>
          <span>
            {attentionItems.length === 1 ? "1 item" : `${attentionItems.length} items`}
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
            <p>All key details have been filled in.</p>
          </div>
        )}
      </div>
    </div>
  );
}
