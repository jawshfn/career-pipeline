import React from "react";

import AppLayout from "./components/layout/AppLayout.jsx";
import ApplicationsPage from "./pages/ApplicationsPage.jsx";

export default function App() {
  return (
    <AppLayout>
      <ApplicationsPage />
    </AppLayout>
  );
}
