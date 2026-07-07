import React from "react";

import QuickAddApplicationForm from "../components/applications/QuickAddApplicationForm.jsx";

export default function QuickAddPage({ onCreateApplication, resumeVersions }) {
  return (
    <div className="quick-add-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fast capture</p>
          <h2>Quick Add</h2>
          <p>Capture a job opportunity quickly. You can add richer details later.</p>
        </div>
      </header>

      <QuickAddApplicationForm
        resumeVersions={resumeVersions}
        onCreateApplication={onCreateApplication}
      />
    </div>
  );
}
