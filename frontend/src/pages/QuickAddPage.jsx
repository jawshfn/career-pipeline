import React, { useState } from "react";

import QuickAddApplicationForm from "../components/applications/QuickAddApplicationForm.jsx";

export default function QuickAddPage({ onCreateApplication, onViewApplications, resumeVersions }) {
  const [createdApplication, setCreatedApplication] = useState(null);

  function handleAddAnother() {
    setCreatedApplication(null);
  }

  return (
    <div className="quick-add-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fast capture</p>
          <h2>Quick Add</h2>
          <p>Capture a job opportunity quickly. You can add richer details later.</p>
        </div>
      </header>

      {createdApplication ? (
        <section className="panel quick-add-success-panel" aria-labelledby="quick-add-success-title">
          <div>
            <h2 id="quick-add-success-title">Added successfully</h2>
            <p>
              {createdApplication.role_title} at {createdApplication.company_name} is now in your application list.
            </p>
          </div>
          <div className="quick-add-success-actions">
            <button className="secondary-button" type="button" onClick={handleAddAnother}>
              Add another
            </button>
            <button className="primary-small-button" type="button" onClick={onViewApplications}>
              View applications
            </button>
          </div>
        </section>
      ) : null}

      <QuickAddApplicationForm
        resumeVersions={resumeVersions}
        onCreateApplication={onCreateApplication}
        onCreateSuccess={setCreatedApplication}
      />
    </div>
  );
}
