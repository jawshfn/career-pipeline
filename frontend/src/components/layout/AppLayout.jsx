import React, { useState } from "react";

import { getStoredSidebarCollapsed, removeStoredSidebarCollapsed, storeSidebarCollapsed } from "./sidebarPreference.js";
import "./AppLayout.css";

export const navigationGroups = [
  { label: "Overview", items: [{ id: "command-center", label: "Reminders", icon: "checklist" }, { id: "dashboard", label: "Dashboard", icon: "grid" }, { id: "insights", label: "Insights", icon: "trend" }] },
  { label: "Job search", items: [{ id: "quick-add", label: "Add Job", icon: "plus" }, { id: "applications", label: "Applications", icon: "briefcase" }, { id: "pipeline", label: "Status Board", icon: "columns" }] },
  { label: "Resources", items: [{ id: "resume-versions", label: "Resumes", icon: "file" }, { id: "data", label: "Data", icon: "database" }] },
  { label: "Support", items: [{ id: "support", label: "Help", icon: "help" }] },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items.map(({ id, label }) => ({ id, label })));

function NavigationIcon({ name }) {
  const paths = {
    checklist: <><path d="M9 6h10M9 12h10M9 18h10" /><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    trend: <><path d="M4 18V6m0 12h16" /><path d="m7 14 4-4 3 2 5-6" /></>,
    plus: <path d="M12 5v14m-7-7h14" />,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2m-13 6h18M10 13v2h4v-2" /></>,
    columns: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="16" rx="1" /><rect x="17" y="4" width="4" height="16" rx="1" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6m-6 4h6" /></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5m-14 7v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.2 1-1.9 1.5-1.9 3.1m.02 3h.01" /></>,
  };
  return <svg aria-hidden="true" className="app-nav-icon" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function ChevronIcon({ expanded }) {
  return <svg aria-hidden="true" className="app-sidebar-toggle-icon" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d={expanded ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>;
}

export default function AppLayout({ activePage, children, isDemoMode = false, onNavigate }) {
  const [isCollapsed, setIsCollapsed] = useState(() => getStoredSidebarCollapsed());
  const [compactLabel, setCompactLabel] = useState(null);
  const toggleSidebar = () => {
    setCompactLabel(null);
    setIsCollapsed((collapsed) => {
      if (collapsed) removeStoredSidebarCollapsed(); else storeSidebarCollapsed();
      return !collapsed;
    });
  };
  const expanded = !isCollapsed;
  const showCompactLabel = (event, label) => {
    if (!isCollapsed) return;
    const { right, top, height } = event.currentTarget.getBoundingClientRect();
    setCompactLabel({ label, left: right + 12, top: top + height / 2 });
  };

  return (
    <div className={`app-shell ${isCollapsed ? "app-shell-sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar" aria-label="PursuitHQ navigation">
        <div className="app-brand" aria-label="PursuitHQ">
          <p className="app-brand-name"><span aria-hidden="true" className="app-brand-mark">P</span><span className="app-brand-full">PursuitHQ</span></p>
          <p className="app-brand-description">Job-search command center</p>
        </div>
        <nav className="app-nav" aria-label="Primary navigation" id="primary-navigation">
          {navigationGroups.map((group) => (
            <section aria-labelledby={`nav-group-${group.label.replace(/\s/g, "-").toLowerCase()}`} className="app-nav-group" key={group.label}>
              <p id={`nav-group-${group.label.replace(/\s/g, "-").toLowerCase()}`} className="app-nav-group-heading">{group.label}</p>
              <ul className="app-nav-list">
                {group.items.map((item) => <li key={item.id}><button aria-current={activePage === item.id ? "page" : undefined} className={`app-nav-item ${activePage === item.id ? "app-nav-item-active" : ""}`} onBlur={() => setCompactLabel(null)} onClick={() => onNavigate(item.id)} onFocus={(event) => showCompactLabel(event, item.label)} onMouseEnter={(event) => showCompactLabel(event, item.label)} onMouseLeave={() => setCompactLabel(null)} type="button"><NavigationIcon name={item.icon} /><span className="app-nav-label">{item.label}</span></button></li>)}
              </ul>
            </section>
          ))}
        </nav>
        <button aria-controls="primary-navigation" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} sidebar`} className="app-sidebar-toggle" onClick={toggleSidebar} type="button"><ChevronIcon expanded={expanded} /><span className="app-sidebar-toggle-label">{expanded ? "Collapse" : "Expand"}</span></button>
      </aside>
      {compactLabel ? <span aria-hidden="true" className="app-compact-nav-label" style={{ left: compactLabel.left, top: compactLabel.top }}>{compactLabel.label}</span> : null}
      <main className="app-main">
        {isDemoMode ? <div className="demo-mode-banner" role="status">Demo mode: sample data is fictional and resets when the page reloads.</div> : null}
        {children}
      </main>
    </div>
  );
}
