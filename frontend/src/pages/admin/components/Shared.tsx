import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import type { DriftStatus, FairnessStatus, ModelName, Tone } from "../types";

export const MODEL_OPTIONS: { value: ModelName; label: string }[] = [
  { value: "xgboost", label: "XGBoost" },
  { value: "random_forest", label: "Random Forest" },
  { value: "neural_network", label: "Neural Network" },
  { value: "logistic_regression", label: "Logistic Regression" },
];

export const MODEL_COLORS: Record<string, string> = {
  xgboost: "#0891b2",
  random_forest: "#22c55e",
  neural_network: "#f59e0b",
  logistic_regression: "#7c3aed",
};

export const RISK_COLORS = { low: "#10b981", moderate: "#f59e0b", high: "#ef4444" };

const toneClasses: Record<Tone, string> = {
  cyan: "bg-cyan-50 text-cyan-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-700",
  purple: "bg-purple-50 text-purple-700",
};

export function modelLabel(model: string) {
  return MODEL_OPTIONS.find((option) => option.value === model)?.label ?? model;
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">{detail}</p>
    </Card>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function ScoreBar({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target?: number;
}) {
  const percent = Math.round(value * 100);
  const passes = target === undefined || value >= target;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className={passes ? "" : "text-red-600"}>
          {percent}%{target !== undefined ? ` / ${Math.round(target * 100)}%` : ""}
        </span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${passes ? "bg-cyan-600" : "bg-red-500"}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
        {target !== undefined ? (
          <div className="absolute top-0 h-full w-0.5 bg-slate-900" style={{ left: `${target * 100}%` }} />
        ) : null}
      </div>
    </div>
  );
}

export function SubPanel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[20px] border border-slate-200 bg-slate-50 p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">{title}</p>
          {subtitle ? <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Loading and error states shared by every admin tab. */
export function LoadState({
  isLoading,
  error,
  onRetry,
  hasData,
  children,
}: {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  hasData: boolean;
  children: ReactNode;
}) {
  if (!hasData && isLoading) {
    return (
      <Card className="flex items-center justify-center gap-3 p-12 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
        Loading monitoring data...
      </Card>
    );
  }
  if (!hasData && error) {
    return (
      <Card className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <p className="font-bold text-slate-950">Data unavailable</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{error}</p>
        </div>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </Card>
    );
  }
  return (
    <>
      {error ? <Notice tone="amber">Refresh failed: {error}. Showing the last loaded data.</Notice> : null}
      {children}
    </>
  );
}

export function Notice({ tone = "amber", children }: { tone?: "amber" | "cyan" | "red"; children: ReactNode }) {
  const classes = {
    amber: "border-amber-100 bg-amber-50 text-amber-900",
    cyan: "border-cyan-100 bg-cyan-50 text-cyan-900",
    red: "border-red-100 bg-red-50 text-red-900",
  };
  return (
    <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3 text-sm leading-6 ${classes[tone]}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm font-semibold text-slate-400">
      {message}
    </div>
  );
}

export const fairnessStatusMeta: Record<FairnessStatus, { label: string; tone: Tone }> = {
  within_limit: { label: "Within limit", tone: "green" },
  watch: { label: "Watch", tone: "amber" },
  investigate: { label: "Investigate", tone: "red" },
};

export const driftStatusMeta: Record<DriftStatus, { label: string; tone: Tone }> = {
  stable: { label: "Stable", tone: "green" },
  moderate: { label: "Moderate", tone: "amber" },
  significant: { label: "Significant", tone: "red" },
  no_data: { label: "No data", tone: "slate" },
};

export function formatPercent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "–" : `${(value * 100).toFixed(digits)}%`;
}

export function formatGap(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "–";
  }
  const points = value * 100;
  return `${points > 0 ? "+" : ""}${points.toFixed(1)} pp`;
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}

export function formatDay(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
