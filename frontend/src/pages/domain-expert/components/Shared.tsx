import type { ReactNode } from 'react';
import { Brain, ClipboardList, Gauge, ShieldCheck } from 'lucide-react';
import type { AssessmentModel, ModelPerformance, PredictionResult } from '../types';
import { riskLabel, riskTone } from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';

export function MetricGrid({
  selectedModel = "Random Forest",
  prediction,
  patientReference = "Auto-generated",
}: {
  selectedModel?: AssessmentModel;
  prediction?: PredictionResult | null;
  patientReference?: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={ClipboardList} label="Patient Reference" value={patientReference} />
      <MetricCard
        icon={Gauge}
        label="Risk Score"
        value={prediction ? `${Math.round(prediction.risk_score * 100)}%` : "Pending"}
        tone={riskTone(prediction?.risk_level)}
      />
      <MetricCard
        icon={ShieldCheck}
        label="Risk Category"
        value={prediction ? `${riskLabel(prediction.risk_level)} Risk` : "Pending"}
        tone={riskTone(prediction?.risk_level)}
      />
      <MetricCard icon={Brain} label="Model Used" value={selectedModel} tone="purple" />
    </div>
  );
}

export function formatMetric(value: number) {
  return value.toFixed(2);
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "cyan",
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  tone?: "cyan" | "purple" | "red" | "amber" | "green";
}) {
  const colors = {
    cyan: "bg-cyan-50 text-cyan-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
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
      {helperText ? (
        <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
          {helperText}
        </p>
      ) : null}
      {validationMessage ? (
        <p className={`mt-2 text-xs font-bold leading-5 ${messageTone}`}>
          {validationMessage}
        </p>
      ) : null}
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
  validationTone,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  placeholder?: string;
  helperText?: ReactNode;
  validationMessage?: string;
  validationTone?: "error" | "warning";
  disabled?: boolean;
}) {
  const fieldTone = validationTone === "error"
    ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-red-100"
    : validationTone === "warning"
      ? "border-amber-300 bg-amber-50/30 focus:border-amber-400 focus:ring-amber-100"
      : "border-slate-200 bg-white focus:border-cyan-400 focus:ring-cyan-100";
  const messageTone = validationTone === "error" ? "text-red-700" : "text-amber-700";

  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        className={`mt-2 min-h-12 w-full rounded-2xl border px-4 text-sm font-medium text-slate-900 outline-none transition focus:ring-4 ${fieldTone}`}
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
      {helperText ? (
        <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
          {helperText}
        </p>
      ) : null}
      {validationMessage ? (
        <p className={`mt-2 text-xs font-bold leading-5 ${messageTone}`}>
          {validationMessage}
        </p>
      ) : null}
    </label>
  );
}

export function RiskGauge({ prediction }: { prediction: PredictionResult }) {
  const degrees = Math.round(prediction.risk_score * 360);
  const toneColor =
    prediction.risk_level === "high"
      ? "#ef4444"
      : prediction.risk_level === "moderate"
        ? "#f59e0b"
        : "#10b981";

  return (
    <div className="relative mx-auto flex h-64 w-64 items-center justify-center rounded-full bg-slate-100">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${toneColor} 0deg ${degrees}deg, #e2e8f0 ${degrees}deg 360deg)`,
        }}
      />
      <div className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-5xl font-bold text-slate-950">
          {Math.round(prediction.risk_score * 100)}%
        </span>
        <span className="mt-1 text-sm font-semibold text-slate-600">
          {riskLabel(prediction.risk_level)} Risk
        </span>
      </div>
    </div>
  );
}

export function Legend({
  tone,
  label,
  range,
}: {
  tone: "green" | "amber" | "red";
  label: string;
  range: string;
}) {
  const color =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="text-sm font-bold text-slate-900">{label}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{range}</p>
    </div>
  );
}

export function AssessmentEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof ClipboardList;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card className="p-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-slate-950">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
          {description}
        </p>
        <Button className="mt-6" onClick={onAction}>
          <ClipboardList className="h-4 w-4" />
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}

export function XaiSummaryCard({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone: "purple" | "amber";
}) {
  const styles =
    tone === "purple"
      ? "border-purple-100 bg-purple-50 text-purple-900"
      : "border-amber-100 bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-[20px] border p-4 ${styles}`}>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6">{children}</p>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
    >
      {children}
    </button>
  );
}

export function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select
        className="mt-1 min-h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function RiskBadge({ category }: { category: string }) {
  if (category === "High") {
    return <Badge tone="red">High</Badge>;
  }

  if (category === "Moderate") {
    return <Badge tone="amber">Moderate</Badge>;
  }

  if (category === "Failed") {
    return <Badge tone="slate">Failed</Badge>;
  }

  return <Badge tone="green">Low</Badge>;
}

export function ModelPerformancePanel({
  selectedModel,
  modelPerformance,
  isLoading,
  error,
}: {
  selectedModel: AssessmentModel;
  modelPerformance: ModelPerformance;
  isLoading: boolean;
  error: string | null;
}) {
  const confusion = modelPerformance.confusion_matrix;
  const metrics = [
    ["Precision", modelPerformance.precision],
    ["Sensitivity / Recall", modelPerformance.sensitivity_recall],
    ["Specificity", modelPerformance.specificity],
    ["F1 Score", modelPerformance.f1_score],
    ["AUC-ROC Score", modelPerformance.auc_roc],
  ];

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <CardHeader
          title="Model Performance"
          subtitle="Evaluation metrics from the UCI Heart Disease test split."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="purple">{selectedModel}</Badge>
          {isLoading ? <Badge tone="cyan">Loading metrics</Badge> : null}
          {error ? <Badge tone="amber">Sample values</Badge> : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {formatMetric(Number(value))}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[20px] border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-950">Confusion Matrix</h3>
          <div className="mt-4 grid grid-cols-[96px_1fr_1fr] overflow-hidden rounded-2xl border border-slate-200 text-center text-sm">
            <div className="bg-slate-100 p-3 font-bold text-slate-600" />
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Predicted 0</div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Predicted 1</div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Actual 0</div>
            <div className="bg-emerald-50 p-4 font-bold text-emerald-700">
              TN {confusion.true_negative}
            </div>
            <div className="bg-red-50 p-4 font-bold text-red-700">
              FP {confusion.false_positive}
            </div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Actual 1</div>
            <div className="bg-red-50 p-4 font-bold text-red-700">
              FN {confusion.false_negative}
            </div>
            <div className="bg-emerald-50 p-4 font-bold text-emerald-700">
              TP {confusion.true_positive}
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-950">Clinical Readout</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Sensitivity/recall shows how often patients with heart disease are
              correctly identified.
            </p>
            <p>
              Specificity shows how often patients without heart disease are
              correctly identified.
            </p>
            <p>
              AUC-ROC summarizes how well the model separates positive and
              negative cases across thresholds.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

