import { useEffect, useState } from "react";
import { AdminAIMonitoringPanel } from "./pages/admin";
import { AuthPage } from "./pages/auth";
import { DomainExpertDashboard } from "./pages/domain-expert";
import { PatientDashboard } from "./pages/patient";
import { supabase } from "./lib/supabase";
import { API_BASE_URL } from "./pages/domain-expert/constants";

function App() {
  const [currentPage, setCurrentPage] = useState(() =>
    isPasswordRecoveryUrl() ? "reset-password" : "login",
  );
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    function handleRecoveryUrl() {
      if (isPasswordRecoveryUrl()) {
        setCurrentUser(null);
        setCurrentPage("reset-password");
      }
    }

    async function restoreSession() {
      if (isPasswordRecoveryUrl()) {
        setCurrentPage("reset-password");
        return;
      }

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
    window.addEventListener("hashchange", handleRecoveryUrl);
    window.addEventListener("popstate", handleRecoveryUrl);
    const authListener = supabase?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setCurrentUser(null);
        setCurrentPage("reset-password");
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener("hashchange", handleRecoveryUrl);
      window.removeEventListener("popstate", handleRecoveryUrl);
      authListener?.data.subscription.unsubscribe();
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
      initialMode={currentPage === "reset-password" ? "reset-password" : "login"}
      onAuthenticated={(role, user) => {
        setCurrentUser(user);
        setCurrentPage(pageForRole(role));
      }}
      onPasswordResetComplete={() => {
        setCurrentUser(null);
        setCurrentPage("login");
        window.history.replaceState(null, "", window.location.pathname);
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

function isPasswordRecoveryUrl() {
  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`);
  return params.get("type") === "recovery";
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
