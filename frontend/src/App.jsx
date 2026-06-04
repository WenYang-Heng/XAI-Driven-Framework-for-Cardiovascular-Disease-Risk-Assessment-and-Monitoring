import { useEffect, useState } from "react";
import { AdminAIMonitoringPanel } from "./pages/admin";
import { AuthPage } from "./pages/auth";
import { DomainExpertDashboard } from "./pages/domain-expert";
import { PatientDashboard } from "./pages/patient";
import { supabase } from "./lib/supabase";
import { API_BASE_URL } from "./pages/domain-expert/constants";

function App() {
  const [currentPage, setCurrentPage] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const sessionResponse = await supabase?.auth.getSession();
      const user = sessionResponse?.data?.session?.user;
      if (!mounted || !user) {
        return;
      }

      const profile = await loadProfile(user.id);
      const role = toAppRole(profile?.role ?? user.user_metadata?.role);
      const restoredUser = {
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name ?? user.user_metadata?.full_name,
        role,
      };
      setCurrentUser(restoredUser);
      setCurrentPage(pageForRole(role));

      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await supabase?.auth.signOut();
    setCurrentUser(null);
    setCurrentPage("login");
  }

  if (currentPage === "domain-expert") {
    return <DomainExpertDashboard currentUser={currentUser} onLogout={logout} />;
  }

  if (currentPage === "admin") {
    return <AdminAIMonitoringPanel onLogout={logout} />;
  }

  if (currentPage === "patient") {
    return <PatientDashboard onLogout={logout} />;
  }

  return (
    <AuthPage
      onAuthenticated={(role, user) => {
        setCurrentUser(user);
        setCurrentPage(pageForRole(role));
      }}
    />
  );
}

function pageForRole(role) {
  return role === "general-user" ? "patient" : role === "admin" ? "admin" : "domain-expert";
}

function toAppRole(role) {
  return role === "ADMIN" || role === "admin"
    ? "admin"
    : role === "DOMAIN_EXPERT" || role === "domain-expert"
      ? "domain-expert"
      : "general-user";
}

async function loadProfile(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/${userId}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export default App;
