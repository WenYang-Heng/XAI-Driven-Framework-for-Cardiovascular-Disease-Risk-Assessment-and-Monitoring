import { Activity, LogOut, Stethoscope } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DomainExpertUser, NavKey } from '../types';
import { navMeta } from '../constants';
import { Button } from '../../../components/ui/Button';

export function Sidebar({
  active,
  onChange,
}: {
  active: NavKey | null;
  onChange: (key: NavKey) => void;
}) {
  const items = Object.entries(navMeta) as [NavKey, (typeof navMeta)[NavKey]][];

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="rounded-[22px] bg-slate-950 p-5 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
          <Activity className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">CardioXAI</h1>
        <p className="mt-1 text-sm text-slate-300">Clinician Workspace</p>
      </div>

      <nav className="mt-5 space-y-2">
        {items.map(([id, item]) => {
          const Icon = item.icon;
          const selected = active === id;

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
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/** Compact nav for screens narrower than the sidebar breakpoint. */
export function MobileNav({ active, onChange }: { active: NavKey | null; onChange: (key: NavKey) => void }) {
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
      {(Object.entries(navMeta) as [NavKey, (typeof navMeta)[NavKey]][]).map(([id, item]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold ${
            active === id ? "bg-cyan-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function TopHeader({
  title,
  subtitle,
  currentUser,
  onLogout,
  breadcrumb,
}: {
  title: string;
  subtitle: string;
  breadcrumb?: ReactNode;
  currentUser?: DomainExpertUser;
  onLogout?: () => void;
}) {
  const displayName = currentUser?.fullName || currentUser?.email || "Signed-in user";

  return (
    <header className="flex flex-col gap-4 rounded-[24px] border border-white bg-white/80 px-5 py-5 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        {breadcrumb}
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          <Stethoscope className="h-4 w-4" />
          Clinician workspace
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

