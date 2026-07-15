import React from "react";

export default function EmptyApplicationsState({ isFiltered = false }) {
  return (
    <div className="empty-state">
      <h3>{isFiltered ? "No applications match your current filters." : "No applications yet"}</h3>
      <p>
        {isFiltered
          ? "Adjust or clear filters to see more opportunities."
          : "Add your first opportunity with Add Job, then open Details when you need more context."}
      </p>
    </div>
  );
}
