import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  Gauge,
  History,
  LogOut,
  RefreshCw,
  Scale,
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
  Legend,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { API_BASE_URL } from "../domain-expert/constants";

type AdminTab = "performance" | "fairness" | "drift" | "activity";
type Tone = "cyan" | "green" | "amber" | "red" | "slate" | "purple";

type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  icon: string | LucideIcon;
  tone: Tone;
};

type AdminMonitoringDashboard = {
  performance: {
    metrics: DashboardMetric[];
    trend: { day: string; auc: number; f1: number; calibration: number }[];
    model_comparison: {
      model: string;
      accuracy: number;
      auc: number;
      precision: number;
      recall: number;
      f1: number;
    }[];
  };
  fairness: {
    cohorts: {
      group: string;
      sample: string;
      tpr: string;
      fpr: string;
      gap: string;
      disparity: number;
      status: string;
      tone: Tone;
    }[];
    chart: { cohort: string; disparity: number }[];
    watch_count: number;
  };
  drift: {
    metrics: DashboardMetric[];
    trend: { day: string; bp: number; hr: number; cholesterol: number }[];
    features: {
      feature: string;
      psi: number;
      status: string;
      tone: Tone;
    }[];
    active_alerts: number;
  };
  last_updated?: string;
};

type ActivityLogEntry = {
  log_id: string;
  timestamp: string;
  actor?: string | null;
  event_type: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  status: "success" | "warning" | "failed";
};

type ActivityLogResponse = {
  success: boolean;
  items: ActivityLogEntry[];
  total: number;
  page: number;
  page_size: number;
};

const metricIconMap: Record<string, LucideIcon> = {
  Activity,
  AlertTriangle,
  BarChart3,
  DatabaseZap,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
};

const radarColors = ["#0891b2", "#22c55e", "#f59e0b", "#7c3aed"];

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
  activity: {
    title: "Activity Log",
    subtitle:
      "Review user actions, system events, assessment activity, and operational status across the platform.",
    icon: History,
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
  { model: "XGBoost", accuracy: 87, auc: 93, precision: 88, recall: 86, f1: 87 },
  { model: "Random Forest", accuracy: 85, auc: 91, precision: 86, recall: 84, f1: 85 },
  { model: "Neural Network", accuracy: 84, auc: 90, precision: 85, recall: 83, f1: 84 },
  { model: "Logistic Regression", accuracy: 81, auc: 86, precision: 82, recall: 81, f1: 81 },
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

const fallbackDashboard: AdminMonitoringDashboard = {
  performance: {
    metrics: [
      {
        label: "Current AUC",
        value: "0.94",
        detail: "+0.03 from weekly baseline",
        icon: "TrendingUp",
        tone: "cyan",
      },
      {
        label: "F1 score",
        value: "0.87",
        detail: "Production threshold: 0.82",
        icon: "Gauge",
        tone: "green",
      },
      {
        label: "Calibration error",
        value: "0.05",
        detail: "Lower is better",
        icon: "TrendingDown",
        tone: "green",
      },
      {
        label: "Assessments today",
        value: "1,284",
        detail: "99.2% completed",
        icon: "Activity",
        tone: "slate",
      },
    ],
    trend: performanceTrend,
    model_comparison: modelComparison,
  },
  fairness: {
    cohorts: fairnessGroups.map((row) => ({ ...row, disparity: Number.parseFloat(row.gap) || 0 })),
    chart: fairnessChart,
    watch_count: 1,
  },
  drift: {
    metrics: [
      {
        label: "Overall drift score",
        value: "0.16",
        detail: "Moderate shift from training data",
        icon: "DatabaseZap",
        tone: "amber",
      },
      {
        label: "Features monitored",
        value: "13",
        detail: "5 high-impact clinical inputs",
        icon: "BarChart3",
        tone: "slate",
      },
      {
        label: "Retrain trigger",
        value: "72%",
        detail: "Of policy threshold reached",
        icon: "RefreshCw",
        tone: "cyan",
      },
      {
        label: "Active alerts",
        value: "1",
        detail: "Max heart rate distribution",
        icon: "AlertTriangle",
        tone: "red",
      },
    ],
    trend: driftTrend,
    features: driftFeatures,
    active_alerts: 1,
  },
};

export function AdminAIMonitoringPanel({
  onLogout,
}: {
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>("performance");
  const [dashboard, setDashboard] = useState<AdminMonitoringDashboard>(fallbackDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const current = tabMeta[activeTab];

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      try {
        const monitoringResponse = await fetch(`${API_BASE_URL}/api/admin/monitoring`);
        if (!monitoringResponse.ok) {
          throw new Error(`Monitoring API returned ${monitoringResponse.status}`);
        }
        const payload = await monitoringResponse.json();
        if (mounted && payload?.dashboard) {
          setDashboard(payload.dashboard);
          setFetchError(null);
        }
      } catch (error) {
        if (mounted) {
          setDashboard(fallbackDashboard);
          setFetchError(error instanceof Error ? error.message : "Monitoring data unavailable");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();
    const refreshTimer = window.setInterval(loadDashboard, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onChange={setActiveTab} />

        <section className="min-w-0 flex-1 px-5 py-5 lg:px-8">
          <TopHeader
            title={current.title}
            subtitle={current.subtitle}
            onLogout={onLogout}
            isLoading={isLoading}
            fetchError={fetchError}
            lastUpdated={dashboard.last_updated}
          />

          <div className="mt-7">
            {activeTab === "performance" ? <PerformanceMonitoring data={dashboard.performance} /> : null}
            {activeTab === "fairness" ? <FairnessMonitoring data={dashboard.fairness} /> : null}
            {activeTab === "drift" ? <DriftMonitoring data={dashboard.drift} /> : null}
            {activeTab === "activity" ? <ActivityLog /> : null}
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
                .replace("Data Drift Monitoring", "Data Drift")}
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
  isLoading,
  fetchError,
  lastUpdated,
}: {
  title: string;
  subtitle: string;
  onLogout?: () => void;
  isLoading: boolean;
  fetchError: string | null;
  lastUpdated?: string;
}) {
  const connectionTone = fetchError ? "amber" : isLoading ? "slate" : "cyan";
  const connectionText = fetchError ? "Demo fallback" : isLoading ? "Loading" : "Live Monitoring";

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
        <Badge tone={connectionTone} className="w-fit" title={fetchError ?? undefined}>
          {connectionText}
        </Badge>
        {lastUpdated ? (
          <span className="text-xs font-semibold text-slate-400">
            Updated {formatTimestamp(lastUpdated)}
          </span>
        ) : null}
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

function PerformanceMonitoring({
  data,
}: {
  data: AdminMonitoringDashboard["performance"];
}) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
          <CardHeader
            title="Model Performance Comparison"
            subtitle="Compare all four cardiovascular risk models using accuracy, precision, recall, F1-score, and ROC-AUC."
            action={<Badge tone="cyan">4 models</Badge>}
          />
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-950">Metric Comparison</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Percentage score by model and metric
                  </p>
                </div>
                <Badge tone="slate">Higher is better</Badge>
              </div>
              <div className="mt-4 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.model_comparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="model" stroke="#64748b" />
                    <YAxis domain={[0, 100]} stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="accuracy" name="Accuracy" fill="#0891b2" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="precision" name="Precision" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="recall" name="Recall" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="f1" name="F1-score" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="auc" name="ROC-AUC" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-950">Overall Profile</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Balanced view across all tracked metrics
                  </p>
                </div>
                <Badge tone="cyan">Radar</Badge>
              </div>
              <div className="mt-4 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={comparisonRadarData(data.model_comparison)}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    {data.model_comparison.map((model, index) => (
                      <Radar
                        key={model.model}
                        name={model.model}
                        dataKey={model.model}
                        stroke={radarColors[index % radarColors.length]}
                        fill={radarColors[index % radarColors.length]}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {data.model_comparison.map((model) => (
              <div key={model.model} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-950">{model.model}</p>
                  <Badge tone={model.auc >= 90 ? "cyan" : "slate"}>{model.auc}% AUC</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <ScoreBar label="Accuracy" value={model.accuracy} />
                  <ScoreBar label="Precision" value={model.precision} />
                  <ScoreBar label="Recall" value={model.recall} />
                  <ScoreBar label="F1-score" value={model.f1} />
                </div>
              </div>
            ))}
          </div>
        </Card>
    </div>
  );
}

function comparisonRadarData(
  models: AdminMonitoringDashboard["performance"]["model_comparison"],
) {
  const metrics = [
    { key: "accuracy", label: "Accuracy" },
    { key: "precision", label: "Precision" },
    { key: "recall", label: "Recall" },
    { key: "f1", label: "F1" },
    { key: "auc", label: "ROC-AUC" },
  ] as const;

  return metrics.map((metric) => {
    const row: Record<string, string | number> = { metric: metric.label };
    models.forEach((model) => {
      row[model.model] = model[metric.key];
    });
    return row;
  });
}

function FairnessMonitoring({
  data,
}: {
  data: AdminMonitoringDashboard["fairness"];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="p-6">
        <CardHeader
          title="Cohort Fairness Review"
          subtitle="True positive rate, false positive rate, and disparity gap by monitored cohort."
          action={<Badge tone={data.watch_count ? "amber" : "green"}>{data.watch_count} cohort{data.watch_count === 1 ? "" : "s"} on watch</Badge>}
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
          {data.cohorts.map((row) => (
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
            <BarChart data={data.chart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[-5, 3]} stroke="#64748b" />
              <YAxis type="category" dataKey="cohort" width={86} stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="disparity" radius={[8, 8, 8, 8]}>
                {data.chart.map((entry) => (
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
          Cohorts marked Watch or Investigate should be reviewed before the next model promotion.
        </div>
      </Card>
    </div>
  );
}

function DriftMonitoring({
  data,
}: {
  data: AdminMonitoringDashboard["drift"];
}) {
  return (
    <div className="space-y-6">
      <MetricGrid metrics={data.metrics} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="p-6">
          <CardHeader
            title="Population Stability Index Trend"
            subtitle="Feature drift for incoming assessment records over the last seven days."
          />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
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
            {data.features.map((item) => (
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

function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total ? (page - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(page * pageSize, total);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
          search: query.trim(),
          sort_order: sortOrder === "newest" ? "desc" : "asc",
        });
        const response = await fetch(`${API_BASE_URL}/api/admin/activity-logs?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Activity log API returned ${response.status}`);
        }
        const payload = (await response.json()) as ActivityLogResponse;
        if (mounted) {
          setLogs(Array.isArray(payload.items) ? payload.items : []);
          setTotal(Number.isFinite(payload.total) ? payload.total : 0);
          setError(null);
        }
      } catch (fetchError) {
        if (mounted) {
          setLogs([]);
          setTotal(0);
          setError(fetchError instanceof Error ? fetchError.message : "Activity logs unavailable");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [page, pageSize, query, sortOrder]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="Platform Activity Log"
          subtitle="User actions, system events, assessment activity, and status records."
          action={<Badge tone={error ? "amber" : "cyan"}>{error ? "Unavailable" : `${total} records`}</Badge>}
        />

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search actor, action, entity, or status"
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(["newest", "oldest"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSortOrder(option);
                    setPage(1);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${
                    sortOrder === option
                      ? "bg-white text-cyan-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
          <div className="grid grid-cols-[1fr_0.9fr_1.5fr_0.9fr_0.9fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            <span>Timestamp</span>
            <span>Actor</span>
            <span>Event</span>
            <span>Entity</span>
            <span>Status</span>
          </div>
          {logs.length ? (
            logs.map((log) => (
              <div
                key={log.log_id}
                className="grid grid-cols-[1fr_0.9fr_1.5fr_0.9fr_0.9fr] items-center border-t border-slate-200 px-4 py-4 text-sm"
              >
                <span className="font-semibold text-slate-700">{formatDateTime(log.timestamp)}</span>
                <span className="truncate text-slate-500" title={log.actor ?? "System"}>
                  {shortActor(log.actor)}
                </span>
                <span>
                  <span className="font-bold text-slate-950">{formatAction(log.action)}</span>
                  <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {log.event_type}
                  </span>
                </span>
                <span className="truncate text-slate-500" title={log.entity_id ?? undefined}>
                  {log.entity_type ?? "system"}
                </span>
                <Badge tone={activityTone(log.status)}>{log.status}</Badge>
              </div>
            ))
          ) : (
            <div className="border-t border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-500">
              {isLoading ? "Loading activity logs..." : "No activity log records match the current search."}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 text-sm font-semibold text-slate-500 lg:flex-row lg:items-center lg:justify-between">
          <span>
            Showing {startRecord}-{endRecord} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="min-w-24 text-center text-slate-600">
              Page {page} of {pageCount}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= pageCount || isLoading}
              onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetricGrid({
  metrics,
}: {
  metrics: DashboardMetric[];
}) {
  const toneClasses = {
    cyan: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon =
          typeof metric.icon === "string"
            ? metricIconMap[metric.icon] ?? Activity
            : metric.icon;

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

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortActor(actor?: string | null) {
  if (!actor) {
    return "System";
  }
  if (actor.length <= 12) {
    return actor;
  }
  return `${actor.slice(0, 8)}...${actor.slice(-4)}`;
}

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activityTone(status: ActivityLogEntry["status"]): Tone {
  if (status === "failed") {
    return "red";
  }
  if (status === "warning") {
    return "amber";
  }
  return "green";
}
