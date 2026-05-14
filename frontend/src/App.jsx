import { useState } from "react";
import { AuthPage } from "./pages/auth";
import { DomainExpertDashboard } from "./pages/domain-expert";
import { PatientDashboard } from "./pages/patient";

function App() {
  const [currentPage, setCurrentPage] = useState("login");

  if (currentPage === "domain-expert") {
    return <DomainExpertDashboard onLogout={() => setCurrentPage("login")} />;
  }

  if (currentPage === "patient") {
    return <PatientDashboard onLogout={() => setCurrentPage("login")} />;
  }

  return (
    <AuthPage
      onAuthenticated={(role) =>
        setCurrentPage(role === "general-user" ? "patient" : "domain-expert")
      }
    />
  );
}

export default App;
