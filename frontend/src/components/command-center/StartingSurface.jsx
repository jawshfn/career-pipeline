import React, { useState } from "react";

import {
  getStoredOnboardingDismissal,
  storeOnboardingDismissal,
} from "./onboardingState.js";

const panelContent = {
  empty: {
    title: "Start your job search workspace",
    description: "PursuitHQ is a local job-search workspace. Your saved information stays in your local FastAPI and SQLite workspace. Begin with one opportunity or migrate an existing tracker.",
  },
  "getting-started": {
    title: "Keep your first opportunity moving",
    description: "Open your application to add a next action or follow-up date, then build out the rest of your search.",
  },
  demo: {
    title: "Explore the PursuitHQ demo",
    description: "This workspace contains fictional sample data. Ordinary changes are temporary and reload resets the demo; real local use persists through FastAPI and SQLite.",
  },
};

export default function StartingSurface({ application, isDemoMode, onNavigate, onOpenApplication }) {
  const [isDismissed, setIsDismissed] = useState(() => getStoredOnboardingDismissal(isDemoMode));
  if (isDismissed) return null;

  const variant = isDemoMode ? "demo" : application ? "getting-started" : "empty";
  const content = panelContent[variant];
  const dismiss = () => {
    storeOnboardingDismissal(isDemoMode);
    setIsDismissed(true);
  };

  return (
    <section aria-labelledby="starting-surface-title" className="starting-surface">
      <div className="starting-surface-heading">
        <div>
          <p className="eyebrow">{isDemoMode ? "Demo guide" : "Getting started"}</p>
          <h3 id="starting-surface-title">{content.title}</h3>
          <p>{content.description}</p>
        </div>
        <button aria-label="Dismiss getting started panel" className="quiet-button starting-surface-dismiss" onClick={dismiss} type="button">Dismiss</button>
      </div>
      <div className="starting-surface-actions">
        {isDemoMode ? <>
          <button className="primary-small-button" onClick={() => onOpenApplication(application.id)} type="button">Explore featured application</button>
          <button className="secondary-button" onClick={() => onNavigate("insights")} type="button">View Outcome Insights</button>
          <button className="secondary-button" onClick={() => onNavigate("pipeline")} type="button">Open Status Board</button>
          <button className="secondary-button" onClick={() => onNavigate("support")} type="button">Learn how PursuitHQ works</button>
        </> : variant === "empty" ? <>
          <button className="primary-small-button" onClick={() => onNavigate("quick-add")} type="button">Add one job</button>
          <button className="secondary-button" onClick={() => onNavigate("data")} type="button">Import a tracker</button>
          <button className="secondary-button" onClick={() => onNavigate("support")} type="button">Learn how PursuitHQ works</button>
        </> : <>
          <button className="primary-small-button" onClick={() => onOpenApplication(application.id)} type="button">Open your application</button>
          <button className="secondary-button" onClick={() => onNavigate("quick-add")} type="button">Add another job</button>
          <button className="secondary-button" onClick={() => onNavigate("resume-versions")} type="button">Create a resume version</button>
        </>}
      </div>
    </section>
  );
}
