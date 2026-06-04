import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  DatabaseZap,
  Gauge,
  LogOut,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";

type AdminTab = "performance" | "fairness" | "drift" | "errors";

const tabMeta: Record<
  AdminTab,
  { title: string; subtitle: string; icon: LucideIcon }
> = {
  performance: {
    title: "Model Performance Monitoring",
    subtitle:
      "Track live model quality, calibration, throughput, and retraining readiness across deployed CVD risk models.",
    icon: Gauge,
  },
  fairness: {
    title: "Fairness and Bias Monitoring",
    subtitle:
      "Compare prediction behavior across protected and clinical cohorts before bias becomes operational risk.",
    icon: Scale,
  },
  drift: {
    title: "Data Drift Monitoring",
    subtitle:
      "Watch feature distribution shifts against the training baseline for incoming cardiovascular assessments.",
    icon: DatabaseZap,
  },
  errors: {
    title: "Error or Failed Assessment Tracking",
    subtitle:
      "Review failed scoring requests, explanation generation errors, and records requiring admin intervention.",
    icon: ShieldAlert,
  },
};

const performanceTrend = [
  { day: "May 15", auc: 0.91, f1: 0.84, calibration: 0.07 },
  { day: "May 16", auc: 0.92, f1: 0.85, calibration: 0.06 },
  { day: "May 17", auc: 0.9, f1: 0.83, calibration: 0.08 },
  { day: "May 18", auc: 0.93, f1: 0.86, calibration: 0.05 },
  { day: "May 19", auc: 0.92, f1: 0.85, calibration: 0.06 },
  { day: "May 20", auc: 0.91, f1: 0.84, calibration: 0.07 },
  { day: "May 21", auc: 0.94, f1: 0.87, calibration: 0.05 },
];

const modelComparison = [
  { model: "RF v1.2", auc: 94, precision: 89, recall: 86 },
  { model: "XGB v2.0", auc: 93, precision: 88, recall: 85 },
  { model: "LR v1.4", auc: 86, precision: 81, recall: 78 },
  { model: "NN v1.1", auc: 90, precision: 84, recall: 83 },
];

const fairnessGroups = [
  {
    group: "Female patients",
    sample: "2,184",
    tpr: "84.8%",
    fpr: "7.1%",
    gap: "+1.6%",
    status: "Within limit",
    tone: "green" as const,
  },
  {
    group: "Male patients",
    sample: "2,356",
    tpr: "83.2%",
    fpr: "7.9%",
    gap: "Baseline",
    status: "Reference",
    tone: "cyan" as const,
  },
  {
    group: "Age 65+",
    sample: "1,109",
    tpr: "79.4%",
    fpr: "9.8%",
    gap: "-3.8%",
    status: "Watch",
    tone: "amber" as const,
  },
  {
    group: "High cholesterol",
    sample: "948",
    tpr: "81.1%",
    fpr: "8.5%",
    gap: "-2.1%",
    status: "Within limit",
    tone: "green" as const,
  },
];

const fairnessChart = [
  { cohort: "Female", disparity: 1.6 },
  { cohort: "Male", disparity: 0 },
  { cohort: "Age 65+", disparity: -3.8 },
  { cohort: "High chol.", disparity: -2.1 },
  { cohort: "Diabetes", disparity: -2.9 },
];

const driftFeatures = [
  { feature: "Resting BP", psi: 0.18, status: "Moderate", tone: "amber" as const },
  { feature: "Cholesterol", psi: 0.11, status: "Stable", tone: "green" as const },
  { feature: "Max heart rate", psi: 0.24, status: "Investigate", tone: "red" as const },
  { feature: "Oldpeak", psi: 0.08, status: "Stable", tone: "green" as const },
  { feature: "Chest pain type", psi: 0.15, status: "Moderate", tone: "amber" as const },
];

const driftTrend = [
  { day: "May 15", bp: 0.08, hr: 0.12, cholesterol: 0.09 },
  { day: "May 16", bp: 0.1, hr: 0.15, cholesterol: 0.1 },
  { day: "May 17", bp: 0.11, hr: 0.18, cholesterol: 0.1 },
  { day: "May 18", bp: 0.13, hr: 0.2, cholesterol: 0.11 },
  { day: "May 19", bp: 0.15, hr: 0.22, cholesterol: 0.1 },
  { day: "May 20", bp: 0.17, hr: 0.23, cholesterol: 0.12 },
  { day: "May 21", bp: 0.18, hr: 0.24, cholesterol: 0.11 },
];

const errorRows = [
  {
    id: "ERR-2401",
    patient: "PT-0842",
    issue: "Missing cholesterol value",
    source: "Risk assessment",
    time: "Today, 10:42",
    status: "Needs review",
    tone: "amber" as const,
  },
  {
    id: "ERR-2402",
    patient: "PT-0763",
    issue: "SHAP service timeout",
    source: "XAI explanation",
    time: "Today, 09:18",
    status: "Retry queued",
    tone: "cyan" as const,
  },
  {
    id: "ERR-2403",
    patient: "PT-0690",
    issue: "Feature range validation failed",
    source: "Data quality",
    time: "Yesterday, 16:55",
    status: "Blocked",
    tone: "red" as const,
  },
  {
    id: "ERR-2404",
    patient: "PT-0614",
    issue: "LLM rationale generation failed",
    source: "Summary service",
    time: "Yesterday, 14:20",
    status: "Resolved",
    tone: "green" as const,
  },
];

const errorTrend = [
  { day: "May 15", failed: 7, resolved: 5 },
  { day: "May 16", failed: 6, resolved: 6 },
  { day: "May 17", failed: 9, resolved: 7 },
  { day: "May 18", failed: 5, resolved: 6 },
  { day: "May 19", failed: 8, resolved: 8 },
  { day: "May 20", failed: 11, resolved: 9 },
  { day: "May 21", failed: 4, resolved: 7 },
];

export function AdminAIMonitoringPanel({
  onLogout,
}: {
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>("performance");
  const current = tabMeta[activeTab];

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onChange={setActiveTab} />

        <section className="min-w-0 flex-1 px-5 py-5 lg:px-8">
          <TopHeader
            title={current.title}
            subtitle={current.subtitle}
            onLogout={onLogout}
          />

          <div className="mt-7">
            {activeTab === "performance" ? <PerformanceMonitoring /> : null}
            {activeTab === "fairness" ? <FairnessMonitoring /> : null}
            {activeTab === "drift" ? <DriftMonitoring /> : null}
            {activeTab === "errors" ? <ErrorTracking /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({
  activeTab,
  onChange,
}: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  const items = Object.entries(tabMeta) as [AdminTab, (typeof tabMeta)[AdminTab]][];

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
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
                .replace("Model Performance Monitoring", "Performance")
                .replace("Fairness and Bias Monitoring", "Fairness and Bias")
                .replace("Data Drift Monitoring", "Data Drift")
                .replace("Error or Failed Assessment Tracking", "Failed Tracking")}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function TopHeader({
  title,
  subtitle,
  onLogout,
}: {
  title: string;
  subtitle: string;
  onLogout?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-[24px] border border-white bg-white/80 px-5 py-5 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          <ShieldCheck className="h-4 w-4" />
          Administrative Oversight
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="purple" className="w-fit">
          Admin
        </Badge>
        <Badge tone="cyan" className="w-fit">
          Live Monitoring
        </Badge>
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

function PerformanceMonitoring() {
  return (
    <div className="space-y-6">
      <MetricGrid
        metrics={[
          {
            label: "Current AUC",
            value: "0.94",
            detail: "+0.03 from weekly baseline",
            icon: TrendingUp,
            tone: "cyan",
          },
          {
            label: "F1 score",
            value: "0.87",
            detail: "Production threshold: 0.82",
            icon: Gauge,
            tone: "green",
          },
          {
            label: "Calibration error",
            value: "0.05",
            detail: "Lower is better",
            icon: TrendingDown,
            tone: "green",
          },
          {
            label: "Assessments today",
            value: "1,284",
            detail: "99.2% completed",
            icon: Activity,
            tone: "slate",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="p-6">
          <CardHeader
            title="Seven-day Model Quality Trend"
            subtitle="AUC, F1 score, and calibration error for the active clinical assessment model."
            action={<Badge tone="green">Healthy</Badge>}
          />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis domain={[0, 1]} stroke="#64748b" />
                <Tooltip />
                <Line type="monotone" dataKey="auc" stroke="#0891b2" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="f1" stroke="#7c3aed" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="calibration" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="Deployment Readiness"
            subtitle="Model candidates ranked by validated clinical performance."
          />
          <div className="mt-6 space-y-4">
            {modelComparison.map((model) => (
              <div key={model.model} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-950">{model.model}</p>
                  <Badge tone={model.auc >= 90 ? "cyan" : "slate"}>{model.auc}% AUC</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <ScoreBar label="Precision" value={model.precision} />
                  <ScoreBar label="Recall" value={model.recall} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function FairnessMonitoring() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="p-6">
        <CardHeader
          title="Cohort Fairness Review"
          subtitle="True positive rate, false positive rate, and disparity gap by monitored cohort."
          action={<Badge tone="amber">1 cohort on watch</Badge>}
        />
        <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
          <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            <span>Cohort</span>
            <span>Sample</span>
            <span>TPR</span>
            <span>FPR</span>
            <span>Gap</span>
            <span>Status</span>
          </div>
          {fairnessGroups.map((row) => (
            <div
              key={row.group}
              className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr] items-center border-t border-slate-200 px-4 py-4 text-sm"
            >
              <span className="font-semibold text-slate-950">{row.group}</span>
              <span className="text-slate-500">{row.sample}</span>
              <span className="font-semibold text-slate-700">{row.tpr}</span>
              <span className="font-semibold text-slate-700">{row.fpr}</span>
              <span className="text-slate-500">{row.gap}</span>
              <Badge tone={row.tone}>{row.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Disparity Gap"
          subtitle="Percentage-point deviation from reference group."
        />
        <div className="mt-6 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fairnessChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[-5, 3]} stroke="#64748b" />
              <YAxis type="category" dataKey="cohort" width={86} stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="disparity" radius={[8, 8, 8, 8]}>
                {fairnessChart.map((entry) => (
                  <Cell
                    key={entry.cohort}
                    fill={Math.abs(entry.disparity) > 3 ? "#f59e0b" : "#0891b2"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-5 rounded-[20px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Age 65+ is approaching the review threshold. Schedule domain expert validation before the next model promotion.
        </div>
      </Card>
    </div>
  );
}

function DriftMonitoring() {
  return (
    <div className="space-y-6">
      <MetricGrid
        metrics={[
          {
            label: "Overall drift score",
            value: "0.16",
            detail: "Moderate shift from training data",
            icon: DatabaseZap,
            tone: "amber",
          },
          {
            label: "Features monitored",
            value: "13",
            detail: "5 high-impact clinical inputs",
            icon: BarChart3,
            tone: "slate",
          },
          {
            label: "Retrain trigger",
            value: "72%",
            detail: "Of policy threshold reached",
            icon: RefreshCw,
            tone: "cyan",
          },
          {
            label: "Active alerts",
            value: "1",
            detail: "Max heart rate distribution",
            icon: AlertTriangle,
            tone: "red",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="p-6">
          <CardHeader
            title="Population Stability Index Trend"
            subtitle="Feature drift for incoming assessment records over the last seven days."
          />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={driftTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis domain={[0, 0.3]} stroke="#64748b" />
                <Tooltip />
                <Area type="monotone" dataKey="hr" stroke="#dc2626" fill="#fee2e2" strokeWidth={3} />
                <Area type="monotone" dataKey="bp" stroke="#f59e0b" fill="#fef3c7" strokeWidth={3} />
                <Area type="monotone" dataKey="cholesterol" stroke="#0891b2" fill="#cffafe" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="Feature Drift Register"
            subtitle="PSI values above 0.20 require investigation."
          />
          <div className="mt-6 space-y-4">
            {driftFeatures.map((item) => (
              <div key={item.feature} className="rounded-[20px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-bold text-slate-950">{item.feature}</p>
                  <Badge tone={item.tone}>{item.status}</Badge>
                </div>
                <div className="mt-3">
                  <ScoreBar label={`PSI ${item.psi.toFixed(2)}`} value={Math.round(item.psi * 100)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ErrorTracking() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <Card className="p-6">
        <CardHeader
          title="Failed Assessment Queue"
          subtitle="Operational failures grouped by assessment, XAI, data quality, and rationale services."
          action={<Button variant="secondary"><RefreshCw className="h-4 w-4" />Retry queued</Button>}
        />
        <div className="mt-6 space-y-4">
          {errorRows.map((row) => (
            <div key={row.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-bold text-slate-950">{row.id}</p>
                    <Badge tone={row.tone}>{row.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {row.issue}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {row.patient} - {row.source}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-400">{row.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Failure Resolution"
          subtitle="Daily failed records versus resolved records."
          action={<Badge tone="cyan">SLA 94%</Badge>}
        />
        <div className="mt-6 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={errorTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="failed" fill="#dc2626" radius={[8, 8, 0, 0]} />
              <Bar dataKey="resolved" fill="#0891b2" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <StatusTile label="Open failures" value="4" tone="red" />
          <StatusTile label="Resolved today" value="7" tone="green" />
        </div>
      </Card>
    </div>
  );
}

function MetricGrid({
  metrics,
}: {
  metrics: {
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
    tone: "cyan" | "green" | "amber" | "red" | "slate";
  }[];
}) {
  const toneClasses = {
    cyan: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <Card key={metric.label} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">{metric.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {metric.value}
                </p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[metric.tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{metric.detail}</p>
          </Card>
        );
      })}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-cyan-600"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "green";
}) {
  const classes =
    tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : "border-emerald-100 bg-emerald-50 text-emerald-700";

  return (
    <div className={`rounded-[20px] border px-4 py-3 ${classes}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
