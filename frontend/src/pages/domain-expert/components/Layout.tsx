import { Activity, LogOut, Stethoscope } from 'lucide-react';
import type { DomainExpertUser, MainTab } from '../types';
import { tabMeta } from '../constants';
import { Button } from '../../../components/ui/Button';

export function Sidebar({
  activeTab,
  onChange,
}: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const items = Object.entries(tabMeta) as [MainTab, (typeof tabMeta)[MainTab]][];

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="rounded-[22px] bg-slate-950 p-5 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
          <Activity className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">CardioXAI</h1>
        <p className="mt-1 text-sm text-slate-300">Domain Expert Workspace</p>
      </div>

      <nav className="mt-5 space-y-2">
        {items.map(([id, item]) => {
          const Icon = item.icon;
          const selected = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                selected
                  ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.title
                .replace("New CVD Risk Assessment", "New Assessment")
                .replace("XAI Visualization Workspace", "XAI Visualization")
                .replace("XAI Rationale Summary", "Rationale Summary")}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function TopHeader({
  title,
  subtitle,
  currentUser,
  onLogout,
}: {
  title: string;
  subtitle: string;
  currentUser?: DomainExpertUser;
  onLogout?: () => void;
}) {
  const displayName = currentUser?.fullName || currentUser?.email || "Signed-in user";

  return (
    <header className="flex flex-col gap-4 rounded-[24px] border border-white bg-white/80 px-5 py-5 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          <Stethoscope className="h-4 w-4" />
          Research Interface
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm">
          {displayName}
        </div>
        {onLogout ? (
          <Button variant="secondary" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        ) : null}
      </div>
    </header>
  );
}

