import React, { useEffect, useRef, useState } from "react";

import JobPostingSnapshotDialog from "./JobPostingSnapshotDialog.jsx";

export default function JobPostingTab({ formData, onApplySnapshot }) {
  const hasSnapshot = Boolean(formData.job_description?.trim());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const triggerRef = useRef(null);
  const shouldReturnFocusRef = useRef(false);

  useEffect(() => {
    if (!isDialogOpen && shouldReturnFocusRef.current) {
      triggerRef.current?.focus();
      shouldReturnFocusRef.current = false;
    }
  }, [isDialogOpen]);

  function closeDialog() {
    shouldReturnFocusRef.current = true;
    setIsDialogOpen(false);
  }

  function applySnapshot(value) {
    onApplySnapshot(value);
    closeDialog();
  }

  return (
    <section className="detail-tab-content job-posting-tab">
      <div className="detail-tab-heading">
        <div>
          <h3>Job Posting Snapshot</h3>
          <p>Saved posting content for this opportunity. Personal notes remain under Job Details.</p>
        </div>
        <button className="secondary-button" ref={triggerRef} type="button" onClick={() => setIsDialogOpen(true)}>
          {hasSnapshot ? "View / edit snapshot" : "Add snapshot"}
        </button>
      </div>

      {hasSnapshot ? (
        <div className="job-posting-snapshot">{formData.job_description}</div>
      ) : (
        <div className="job-posting-empty-state">
          <h4>No job posting saved</h4>
          <p>Saving the posting keeps it available if the original listing disappears.</p>
        </div>
      )}

      <JobPostingSnapshotDialog
        description="Apply changes updates the application draft. Save changes is still required."
        isOpen={isDialogOpen}
        onApply={applySnapshot}
        onClose={closeDialog}
        value={formData.job_description}
      />
    </section>
  );
}
