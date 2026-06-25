import React from "react";

import "./AppLayout.css";

const navigationItems = [
  { id: "command-center", label: "Command Center" },
  { id: "applications", label: "Applications" },
  { id: "pipeline", label: "Pipeline" },
  { id: "resume-versions", label: "Resume Versions" },
];

const pageTitles = {
  "command-center": "Command Center",
  applications: "Applications",
  pipeline: "Pipeline",
  "resume-versions": "Resume Versions",
};

export default function AppLayout({ activePage, children, onNavigate }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary">
        <div>
          <p className="app-brand-kicker">Career Pipeline</p>
          <h1>{pageTitles[activePage] || "Applications"}</h1>
        </div>
        <nav className="app-nav" aria-label="Current section">
          {navigationItems.map((item) => (
            <button
              aria-current={activePage === item.id ? "page" : undefined}
              className={`app-nav-item ${activePage === item.id ? "app-nav-item-active" : ""}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
