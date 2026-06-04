import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  User,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { API_BASE_URL } from "../domain-expert/constants";
import { supabase, supabaseConfigured } from "../../lib/supabase";

type AuthMode = "login" | "register";
export type UserRole = "general-user" | "domain-expert" | "admin";
export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
};

const roleOptions: {
  id: UserRole;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "general-user",
    label: "General User",
    description: "View risk explanations, lifestyle actions, goals, and health reminders.",
    icon: User,
  },
  {
    id: "domain-expert",
    label: "Domain Expert",
    description: "Review CVD assessments, XAI reports, and rationale summaries.",
    icon: Stethoscope,
  },
  {
    id: "admin",
    label: "Admin",
    description: "Manage access, model settings, and system-level oversight.",
    icon: UserCog,
  },
];

export function AuthPage({
  onAuthenticated,
}: {
  onAuthenticated?: (role: UserRole, user: AuthenticatedUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>("general-user");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isRegister = mode === "register";

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-slate-200 bg-white/85 px-5 py-4 shadow-sm backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-cyan-200">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">CardioXAI</h1>
                <p className="text-sm font-medium text-slate-500">
                  Health intelligence access portal
                </p>
              </div>
            </div>
            <Badge tone="cyan">Secure Access</Badge>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[760px]">
            <Card className="p-6 sm:p-8 lg:p-10">
              <div className="flex rounded-[18px] bg-slate-100 p-1">
                <AuthTab
                  active={mode === "login"}
                  label="Login"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setNotice(null);
                  }}
                />
                <AuthTab
                  active={mode === "register"}
                  label="Register"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setNotice(null);
                  }}
                />
              </div>

              <CardHeader
                className="mt-8"
                title={isRegister ? "Create your account" : "Welcome back"}
                subtitle={
                  isRegister
                    ? "Choose a role and enter your details."
                    : "Select your role and sign in."
                }
                action={
                  <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 sm:flex">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                }
              />

              <div className="mt-7">
                <p className="text-sm font-semibold text-slate-700">
                  Workspace role
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {roleOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = role === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setRole(option.id)}
                        className={`rounded-[20px] border p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-cyan-100 ${
                          selected
                            ? "border-cyan-300 bg-cyan-50 text-cyan-950 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                              selected
                                ? "bg-cyan-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="text-sm font-bold">
                            {option.label}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form className="mt-7 space-y-5">
                {isRegister ? (
                  <AuthField
                    label="Full name"
                    type="text"
                    placeholder="Dr. Amina Rahman"
                    icon={User}
                    value={fullName}
                    onChange={setFullName}
                  />
                ) : null}
                <AuthField
                  label="Email address"
                  type="email"
                  placeholder="name@cardioxai.org"
                  icon={Mail}
                  value={email}
                  onChange={setEmail}
                />
                <AuthField
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  icon={Lock}
                  value={password}
                  onChange={setPassword}
                />
                {isRegister ? (
                  <AuthField
                    label="Confirm password"
                    type="password"
                    placeholder="Re-enter your password"
                    icon={Lock}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                  />
                ) : null}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-100"
                    />
                    Remember this device
                  </label>
                  {!isRegister ? (
                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800"
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>

                {error ? (
                  <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                  </p>
                ) : null}
                {notice ? (
                  <p className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
                    {notice}
                  </p>
                ) : null}

                <Button
                  className="mt-2 w-full"
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    setError(null);
                    setNotice(null);
                    try {
                      const result = await authenticate({
                        mode,
                        role,
                        fullName,
                        email,
                        password,
                        confirmPassword,
                      });
                      if (result.status === "confirmation_required") {
                        setNotice(result.message);
                        setMode("login");
                        setPassword("");
                        setConfirmPassword("");
                        return;
                      }
                      onAuthenticated?.(result.user.role, result.user);
                    } catch (authError) {
                      setError(authError instanceof Error ? authError.message : "Authentication failed.");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  {isLoading ? "Working..." : isRegister ? "Create Account" : "Login"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-7 rounded-[20px] border border-cyan-100 bg-gradient-to-br from-cyan-50/80 via-white to-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <p className="text-sm leading-6 text-cyan-900">
                    {role === "general-user"
                      ? "General users land in a personal monitoring workspace with risk explanations, action plans, goals, and reminders."
                      : role === "domain-expert"
                        ? "Domain experts land in the assessment and XAI review dashboard after authentication."
                        : "Admins land in a system management workspace for users, roles, and model configuration."}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-2xl px-4 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-cyan-100 ${
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-500 hover:text-slate-950"
      }`}
    >
      {label}
    </button>
  );
}

function AuthField({
  label,
  type,
  placeholder,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          className="min-h-11 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

async function authenticate({
  mode,
  role,
  fullName,
  email,
  password,
  confirmPassword,
}: {
  mode: AuthMode;
  role: UserRole;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "confirmation_required"; message: string }
> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  if (!email || !password) {
    throw new Error("Enter your email and password.");
  }

  if (mode === "register" && password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const dbRole = role === "admin" ? "ADMIN" : role === "domain-expert" ? "DOMAIN_EXPERT" : "PATIENT";
  if (mode === "register") {
    const authResponse = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: dbRole,
        },
      },
    });

    if (authResponse.error) {
      throw authResponse.error;
    }

    const user = authResponse.data.user;
    if (user) {
      try {
        await upsertProfile({
          userId: user.id,
          fullName: fullName || email,
          email: user.email ?? email,
          role: dbRole,
        });
      } catch {
        // Registration should still show the confirmation prompt. The profile
        // can be repaired on first confirmed login.
      }
    }

    return {
      status: "confirmation_required",
      message: "Account created. Please check your email and confirm your account before logging in.",
    };
  }

  const authResponse = await supabase.auth.signInWithPassword({ email, password });
  if (authResponse.error) {
    throw authResponse.error;
  }

  const user = authResponse.data.user;
  if (!user) {
    throw new Error("No Supabase user was returned. Check your email verification status.");
  }

  let profile = await loadProfile(user.id);
  if (!profile) {
    await upsertProfile({
      userId: user.id,
      fullName: user.user_metadata?.full_name ?? email,
      email: user.email ?? email,
      role: user.user_metadata?.role ?? dbRole,
    });
    profile = await loadProfile(user.id);
  }
  const roleFromProfile = profile?.role ?? user.user_metadata?.role ?? dbRole;
  const appRole =
    roleFromProfile === "ADMIN"
      ? "admin"
      : roleFromProfile === "DOMAIN_EXPERT"
        ? "domain-expert"
        : "general-user";

  return {
    status: "authenticated",
    user: {
      id: user.id,
      email: user.email ?? email,
      fullName: profile?.full_name ?? user.user_metadata?.full_name,
      role: appRole,
    },
  };
}

async function upsertProfile({
  userId,
  fullName,
  email,
  role,
}: {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}) {
  const profileResponse = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      full_name: fullName,
      email,
      role,
    }),
  });

  if (!profileResponse.ok) {
    throw new Error("Profile setup failed. Check server-api and Supabase database connection.");
  }
}

async function loadProfile(userId: string): Promise<{ role?: string; full_name?: string } | null> {
  const response = await fetch(`${API_BASE_URL}/api/profile/${userId}`);
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { profile?: { role?: string; full_name?: string } };
  return data.profile ?? null;
}
