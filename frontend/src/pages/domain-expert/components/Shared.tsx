import type { ReactNode } from 'react';
import { AlertCircle, ClipboardList, Loader2 } from 'lucide-react';
import type { DataSource, ModelPerformance, RiskLevel } from '../types';
import { riskBands, sourceLabels } from '../constants';
import { ageLabel, percent, riskLabel, riskTone } from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "cyan",
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  detail?: string;
  tone?: "cyan" | "purple" | "red" | "amber" | "green" | "slate";
}) {
  const colors = {
    cyan: "bg-cyan-50 text-cyan-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colors[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
          {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
        </div>
      </div>
    </Card>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  unit,
  step,
  placeholder,
  helperText,
  validationMessage,
  validationTone,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  unit?: string;
  step?: string;
  placeholder?: string;
  helperText?: ReactNode;
  validationMessage?: string;
  validationTone?: "error" | "warning";
  disabled?: boolean;
}) {
  const fieldTone = validationTone === "error"
    ? "border-red-300 bg-red-50/30 focus-within:border-red-400 focus-within:ring-red-100"
    : validationTone === "warning"
      ? "border-amber-300 bg-amber-50/30 focus-within:border-amber-400 focus-within:ring-amber-100"
      : "border-slate-200 bg-white focus-within:border-cyan-400 focus-within:ring-cyan-100";
  const messageTone = validationTone === "error" ? "text-red-700" : "text-amber-700";

  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className={`mt-2 flex overflow-hidden rounded-2xl border focus-within:ring-4 ${fieldTone}`}>
        <input
          className="min-h-12 w-full bg-transparent px-4 text-sm font-medium text-slate-900 outline-none"
          type={type}
          step={step}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit ? (
          <span className="flex items-center border-l border-slate-100 px-3 text-xs font-semibold text-slate-400">
            {unit}
          </span>
        ) : null}
      </div>
      {helperText ? <div className="mt-2 text-xs font-medium leading-5 text-slate-500">{helperText}</div> : null}
      {validationMessage ? <p className={`mt-2 text-xs font-bold leading-5 ${messageTone}`}>{validationMessage}</p> : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  helperText,
  validationMessage,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  placeholder?: string;
  helperText?: ReactNode;
  validationMessage?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        className={`mt-2 min-h-12 w-full rounded-2xl border px-4 text-sm font-medium text-slate-900 outline-none transition focus:ring-4 ${
          validationMessage
            ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 bg-white focus:border-cyan-400 focus:ring-cyan-100"
        }`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
      {helperText ? <div className="mt-2 text-xs font-medium leading-5 text-slate-500">{helperText}</div> : null}
      {validationMessage ? <p className="mt-2 text-xs font-bold leading-5 text-red-700">{validationMessage}</p> : null}
    </label>
  );
}

export function RiskGauge({ riskScore, riskLevel }: { riskScore: number; riskLevel: RiskLevel }) {
  const degrees = Math.round(riskScore * 360);
  const toneColor = riskLevel === "high" ? "#ef4444" : riskLevel === "moderate" ? "#f59e0b" : "#10b981";

  return (
    <div className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-full bg-slate-100">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${toneColor} 0deg ${degrees}deg, #e2e8f0 ${degrees}deg 360deg)` }}
      />
      <div className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-4xl font-bold text-slate-950">{percent(riskScore)}</span>
        <span className="mt-1 text-sm font-semibold text-slate-600">{riskLabel(riskLevel)} risk</span>
        <span className="text-xs text-slate-400">10-year CHD</span>
      </div>
    </div>
  );
}

export function RiskBandLegend() {
  const dot = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" } as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {riskBands.map((band) => (
        <div key={band.level} className="rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dot[band.tone]}`} />
            <span className="text-sm font-bold text-slate-900">{band.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{band.range}</p>
        </div>
      ))}
    </div>
  );
}

export function RiskPill({ level, score }: { level?: RiskLevel | null; score?: number | null }) {
  if (!level) {
    return <Badge tone="slate">No assessment</Badge>;
  }
  return (
    <Badge tone={riskTone(level)}>
      {riskLabel(level)}
      {score !== null && score !== undefined ? ` · ${percent(score)}` : ""}
    </Badge>
  );
}

export function ReviewStatusBadge({ status }: { status?: string | null }) {
  if (status === "signed_off") {
    return <Badge tone="green">Signed off</Badge>;
  }
  if (status === "draft") {
    return <Badge tone="cyan">Draft review</Badge>;
  }
  return <Badge tone="amber">Needs review</Badge>;
}

export function SourceTag({
  source,
  daysOld,
  stale,
}: {
  source?: DataSource | null;
  daysOld?: number | null;
  stale?: boolean;
}) {
  if (!source) {
    return <span className="text-xs font-semibold text-red-600">Not recorded</span>;
  }
  const age = ageLabel(daysOld);
  return (
    <span className={`text-xs font-medium ${stale ? "text-amber-700" : "text-slate-500"}`}>
      {sourceLabels[source]}
      {age ? ` · ${age}` : ""}
      {stale ? " · out of date" : ""}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof ClipboardList;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="p-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-slate-950">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
        {actionLabel && onAction ? (
          <Button className="mt-6" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function LoadingCard({ label = "Loading…" }: { label?: string }) {
  return (
    <Card className="flex items-center gap-3 p-6 text-sm font-semibold text-slate-600">
      <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
      {label}
    </Card>
  );
}

export function ErrorBanner({ message, details = [] }: { message: string; details?: string[] }) {
  const extra = details.filter((detail) => detail !== message);
  return (
    <div className="flex gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{message}</p>
        {extra.length ? (
          <ul className="mt-1 list-disc pl-5">
            {extra.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function ModelPerformancePanel({
  modelLabel,
  performance,
  isLoading,
  error,
}: {
  modelLabel: string;
  performance: ModelPerformance | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (!performance) {
    return isLoading ? <LoadingCard label="Loading model metrics…" /> : <ErrorBanner message={error ?? "Model metrics are unavailable."} />;
  }

  const confusion = performance.confusion_matrix;
  const cv = performance.cross_validation;
  const metrics: [string, string, string][] = [
    ["AUC-ROC", performance.auc_roc.toFixed(2), cv ? `5-fold CV ${cv.auc_roc_mean.toFixed(2)} ± ${cv.auc_roc_std.toFixed(2)}` : "Held-out test set"],
    ["Brier score", performance.brier_score?.toFixed(3) ?? "–", "Calibration error, lower is better"],
    ["Sensitivity", percent(performance.sensitivity_recall), "High-risk patients correctly flagged"],
    ["Specificity", percent(performance.specificity), "Lower-risk patients correctly not flagged"],
    ["Precision", percent(performance.precision), "Flagged patients who went on to develop CHD"],
  ];

  return (
    <Card className="p-6">
      <CardHeader
        title="How well the model performs"
        subtitle={`Framingham Heart Study held-out test set. "Flagged" means predicted risk ≥ ${percent(performance.decision_threshold ?? 0.2)}.`}
        action={<Badge tone="purple">{modelLabel}</Badge>}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, detail]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[20px] border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-950">Confusion matrix (test set)</h3>
          <div className="mt-4 grid grid-cols-[110px_1fr_1fr] overflow-hidden rounded-2xl border border-slate-200 text-center text-sm">
            <div className="bg-slate-100 p-3" />
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Not flagged</div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Flagged</div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">No CHD</div>
            <div className="bg-emerald-50 p-4 font-bold text-emerald-700">{confusion.true_negative}</div>
            <div className="bg-red-50 p-4 font-bold text-red-700">{confusion.false_positive}</div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">CHD in 10 yrs</div>
            <div className="bg-red-50 p-4 font-bold text-red-700">{confusion.false_negative}</div>
            <div className="bg-emerald-50 p-4 font-bold text-emerald-700">{confusion.true_positive}</div>
          </div>
        </div>
        <div className="space-y-3 rounded-[20px] border border-slate-200 p-4 text-sm leading-6 text-slate-600">
          <h3 className="text-sm font-bold text-slate-950">Reading these numbers</h3>
          <p>
            An AUC around 0.70 means the model ranks a patient who develops CHD above one who doesn't about 70% of the time,
            which is typical for 10-year risk scores built on routine clinical data.
          </p>
          <p>
            The score is a probability. A Brier score near 0.12 against a 15% event rate means the predicted percentages are
            reasonably calibrated, but individual estimates still carry wide uncertainty.
          </p>
          <p>Use the score to support, not replace, clinical judgement.</p>
        </div>
      </div>
    </Card>
  );
}
