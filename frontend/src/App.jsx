import React, { useState } from "react";

import AppLayout from "./components/layout/AppLayout.jsx";
import ApplicationsPage from "./pages/ApplicationsPage.jsx";
import PipelinePage from "./pages/PipelinePage.jsx";

export default function App() {
  const [activePage, setActivePage] = useState("applications");

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === "pipeline" ? <PipelinePage /> : <ApplicationsPage />}
    </AppLayout>
  );
}
