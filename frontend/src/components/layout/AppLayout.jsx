import React from "react";

import "./AppLayout.css";

const navigationItems = [
  { id: "command-center", label: "Reminders" },
  { id: "dashboard", label: "Dashboard" },
  { id: "quick-add", label: "Add Job" },
  { id: "applications", label: "Applications" },
  { id: "pipeline", label: "Status Board" },
  { id: "resume-versions", label: "Resumes" },
];

const pageTitles = {
  "command-center": "Reminders",
  dashboard: "Dashboard",
  "quick-add": "Add Job",
  applications: "Applications",
  pipeline: "Status Board",
  "resume-versions": "Resumes",
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
