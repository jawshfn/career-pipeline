import React, { useEffect, useRef, useState } from "react";

import { getStoredSidebarCollapsed, removeStoredSidebarCollapsed, storeSidebarCollapsed } from "./sidebarPreference.js";
import "./AppLayout.css";

const MOBILE_NAVIGATION_QUERY = "(max-width: 780px)";

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

function ChevronIcon() {
  return <svg aria-hidden="true" className="app-sidebar-toggle-icon" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>;
}

function isMobileNavigation() {
  return typeof window !== "undefined" && window.matchMedia?.(MOBILE_NAVIGATION_QUERY).matches;
}

export default function AppLayout({ activePage, children, isDemoMode = false, onNavigate }) {
  const [isCollapsed, setIsCollapsed] = useState(() => getStoredSidebarCollapsed());
  const [isMobile, setIsMobile] = useState(isMobileNavigation);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [compactLabel, setCompactLabel] = useState(null);
  const [sidebarTransition, setSidebarTransition] = useState(null);
  const menuButtonRef = useRef(null);
  const currentPage = navigationItems.find((item) => item.id === activePage)?.label || "Applications";
  const expanded = !isCollapsed;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia(MOBILE_NAVIGATION_QUERY);
    const handleChange = (event) => {
      setIsMobile(event.matches);
      setIsMobileMenuOpen(false);
    };
    handleChange(mediaQuery);
    if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", handleChange);
    else mediaQuery.addListener?.(handleChange);
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener("change", handleChange);
      else mediaQuery.removeListener?.(handleChange);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activePage]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsMobileMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  const toggleSidebar = () => {
    setCompactLabel(null);
    const nextCollapsed = !isCollapsed;
    if (nextCollapsed) storeSidebarCollapsed(); else removeStoredSidebarCollapsed();
    if (!isMobileNavigation() && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setSidebarTransition(nextCollapsed ? "collapsing" : "expanding");
    } else {
      setSidebarTransition(null);
    }
    setIsCollapsed(nextCollapsed);
  };
  const handleSidebarTransitionEnd = (event) => {
    if (event.target === event.currentTarget && event.propertyName === "flex-basis") setSidebarTransition(null);
  };
  const showCompactLabel = (event, label) => {
    if (!isCollapsed || isMobile) return;
    const { right, top, height } = event.currentTarget.getBoundingClientRect();
    setCompactLabel({ label, left: right + 12, top: top + height / 2 });
  };
  const handleNavigation = (itemId) => {
    if (onNavigate(itemId)) setIsMobileMenuOpen(false);
  };

  return (
    <div className={`app-shell ${isCollapsed ? "app-shell-sidebar-collapsed" : ""} ${sidebarTransition ? `app-shell-sidebar-${sidebarTransition}` : ""}`}>
      <header className="app-mobile-header">
        <div>
          <p className="app-mobile-brand">PursuitHQ</p>
          <p className="app-mobile-page">{currentPage}</p>
        </div>
        <button aria-controls="primary-navigation" aria-expanded={isMobileMenuOpen} aria-label={`${isMobileMenuOpen ? "Close" : "Open"} navigation menu`} className="app-mobile-menu-toggle" onClick={() => setIsMobileMenuOpen((open) => !open)} ref={menuButtonRef} type="button">Menu</button>
      </header>
      <aside className="app-sidebar" aria-label="PursuitHQ navigation" onTransitionEnd={handleSidebarTransitionEnd}>
        <div className="app-brand" aria-label="PursuitHQ">
          <p className="app-brand-name"><span aria-hidden="true" className="app-brand-mark">P</span><span className="app-brand-full">PursuitHQ</span></p>
          <p className="app-brand-description">Job-search command center</p>
        </div>
        <nav aria-hidden={isMobile && !isMobileMenuOpen ? "true" : undefined} className="app-nav" hidden={isMobile && !isMobileMenuOpen} aria-label="Primary navigation" id="primary-navigation">
          {navigationGroups.map((group) => (
            <section aria-labelledby={`nav-group-${group.label.replace(/\s/g, "-").toLowerCase()}`} className="app-nav-group" key={group.label}>
              <p id={`nav-group-${group.label.replace(/\s/g, "-").toLowerCase()}`} className="app-nav-group-heading">{group.label}</p>
              <ul className="app-nav-list">
                {group.items.map((item) => <li key={item.id}><button aria-current={activePage === item.id ? "page" : undefined} className={`app-nav-item ${activePage === item.id ? "app-nav-item-active" : ""}`} onBlur={() => setCompactLabel(null)} onClick={() => handleNavigation(item.id)} onFocus={(event) => showCompactLabel(event, item.label)} onMouseEnter={(event) => showCompactLabel(event, item.label)} onMouseLeave={() => setCompactLabel(null)} type="button"><NavigationIcon name={item.icon} /><span className="app-nav-label">{item.label}</span></button></li>)}
              </ul>
            </section>
          ))}
        </nav>
        <button aria-label={`${expanded ? "Collapse" : "Expand"} sidebar`} className="app-sidebar-toggle" onClick={toggleSidebar} type="button"><ChevronIcon /><span className="app-sidebar-toggle-label">{expanded ? "Collapse" : "Expand"}</span></button>
      </aside>
      {compactLabel ? <span aria-hidden="true" className="app-compact-nav-label" style={{ left: compactLabel.left, top: compactLabel.top }}>{compactLabel.label}</span> : null}
      <main className="app-main">
        {isDemoMode ? <div className="demo-mode-banner" role="status">Demo mode: sample data is fictional and resets when the page reloads.</div> : null}
        {children}
      </main>
    </div>
  );
}
