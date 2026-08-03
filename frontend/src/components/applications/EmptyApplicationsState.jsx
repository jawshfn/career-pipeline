import React from "react";

export default function EmptyApplicationsState({ isFiltered = false, onNavigate, selectedViewEmpty = "" }) {
  if (selectedViewEmpty === "active") {
    return <div className="empty-state"><h3>No active applications</h3><p>Your closed application history is still available.</p><div className="empty-state-actions"><button className="secondary-button" type="button" onClick={() => onNavigate("closed")}>View closed applications</button></div></div>;
  }

  if (selectedViewEmpty === "closed") {
    return <div className="empty-state"><h3>No closed applications yet</h3><p>Rejected and withdrawn opportunities will appear here.</p><div className="empty-state-actions"><button className="secondary-button" type="button" onClick={() => onNavigate("active")}>View active applications</button></div></div>;
  }

  return (
    <div className="empty-state">
      <h3>{isFiltered ? "No applications match your current filters." : "No applications yet"}</h3>
      <p>
        {isFiltered
          ? "Adjust or clear filters to see more opportunities."
          : "Add one opportunity or import an existing tracker to start building your workspace."}
      </p>
      {!isFiltered ? <div className="empty-state-actions"><button className="primary-small-button" type="button" onClick={() => onNavigate("quick-add")}>Add one job</button><button className="secondary-button" type="button" onClick={() => onNavigate("data")}>Import a tracker</button></div> : null}
    </div>
  );
}
