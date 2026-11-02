import { useState } from "react";
import {
  Activity,
  DatabaseZap,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ActivityLog } from "./components/ActivityLog";
import { Drift } from "./components/Drift";
import { Fairness } from "./components/Fairness";
import { Overview } from "./components/Overview";
import { Performance } from "./components/Performance";
import { Reports } from "./components/Reports";
import type { AdminTab } from "./types";

const RANGE_OPTIONS = [7, 30, 90];

const tabMeta: Record<AdminTab, { label: string; title: string; subtitle: string; icon: LucideIcon }> = {
  overview: {
    label: "Assessment Activity",
    title: "Assessment Activity",
    subtitle: "Total assessments, risk category distribution and daily usage across the platform.",
    icon: LayoutDashboard,
  },
  performance: {
    label: "Model Performance",
    title: "Model Performance Monitoring",
    subtitle: "Accuracy, AUC-ROC, sensitivity and specificity of every deployed CVD risk model against the acceptance targets.",
    icon: Gauge,
  },
  fairness: {
    label: "Fairness and Bias",
    title: "Fairness and Bias Monitoring",
    subtitle: "Compare error rates across patient cohorts on labelled data, and outcome rates on live assessments.",
    icon: Scale,
  },
  drift: {
    label: "Data Drift",
    title: "Input Trends and Data Drift",
    subtitle: "Compare the distribution of incoming clinical inputs with the data the models were trained on.",
    icon: DatabaseZap,
  },
  activity: {
    label: "Activity Log",
    title: "Activity Log",
    subtitle: "Review logins, assessments, inference requests and administrative actions with timestamps and users.",
    icon: History,
  },
  reports: {
    label: "Reports",
    title: "Monitoring Reports",
    subtitle: "Compile performance, activity, fairness and drift findings into a report to print or export.",
    icon: FileText,
  },
};

type CurrentUser = { fullName?: string; email?: string } | null;

export function AdminAIMonitoringPanel({
  currentUser,
  onLogout,
}: {
  currentUser?: CurrentUser;
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [days, setDays] = useState(30);
  const current = tabMeta[activeTab];

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onChange={setActiveTab} />

        <section className="min-w-0 flex-1 px-4 py-5 lg:px-8">
          <header className="no-print flex flex-col gap-4 rounded-[24px] border border-white bg-white/80 px-5 py-5 shadow-soft backdrop-blur xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                <ShieldCheck className="h-4 w-4" />
                Administrative Oversight
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{current.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{current.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {activeTab !== "reports" ? (
                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Time range">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDays(option)}
                      className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                        days === option ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-950"
                      }`}
                    >
                      {option}d
                    </button>
                  ))}
                </div>
              ) : null}
              <Badge tone="purple">{currentUser?.fullName || currentUser?.email || "Admin"}</Badge>
              {onLogout ? (
                <Button variant="secondary" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              ) : null}
            </div>
          </header>

          <MobileTabs activeTab={activeTab} onChange={setActiveTab} />

          <div className="mt-6">
            {activeTab === "overview" ? <Overview days={days} /> : null}
            {activeTab === "performance" ? <Performance days={days} /> : null}
            {activeTab === "fairness" ? <Fairness days={days} /> : null}
            {activeTab === "drift" ? <Drift days={days} /> : null}
            {activeTab === "activity" ? <ActivityLog days={days} /> : null}
            {activeTab === "reports" ? <Reports defaultDays={days} /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({ activeTab, onChange }: { activeTab: AdminTab; onChange: (tab: AdminTab) => void }) {
  const items = Object.entries(tabMeta) as [AdminTab, (typeof tabMeta)[AdminTab]][];

  return (
    <aside className="no-print hidden w-[260px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="rounded-[22px] bg-slate-950 p-5 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
          <Activity className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">CardioXAI</h1>
        <p className="mt-1 text-sm text-slate-300">Admin AI Monitoring</p>
      </div>

      <nav className="mt-5 space-y-2">
        {items.map(([id, item]) => {
          const Icon = item.icon;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                activeTab === id
                  ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileTabs({ activeTab, onChange }: { activeTab: AdminTab; onChange: (tab: AdminTab) => void }) {
  return (
    <div className="no-print mt-4 flex gap-2 overflow-x-auto lg:hidden">
      {(Object.entries(tabMeta) as [AdminTab, (typeof tabMeta)[AdminTab]][]).map(([id, item]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${
            activeTab === id ? "bg-cyan-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
