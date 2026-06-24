import React from "react";

import "./AppLayout.css";

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary">
        <div>
          <p className="app-brand-kicker">Career Pipeline</p>
          <h1>Applications</h1>
        </div>
        <nav className="app-nav" aria-label="Current section">
          <span className="app-nav-item app-nav-item-active">Applications</span>
        </nav>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
