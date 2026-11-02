import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../../components/ui/Badge";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { ModelMetrics, ModelName, PerformanceResponse } from "../types";
import { useAdminData } from "../useAdminData";
import {
  EmptyChart,
  LoadState,
  MODEL_COLORS,
  Notice,
  ScoreBar,
  SubPanel,
  formatDateTime,
  formatDay,
  formatPercent,
  modelLabel,
} from "./Shared";

const METRICS = [
  { key: "accuracy", label: "Accuracy", color: "#0891b2" },
  { key: "precision", label: "Precision", color: "#22c55e" },
  { key: "sensitivity_recall", label: "Sensitivity", color: "#f59e0b" },
  { key: "specificity", label: "Specificity", color: "#ec4899" },
  { key: "f1_score", label: "F1-score", color: "#7c3aed" },
  { key: "auc_roc", label: "AUC-ROC", color: "#0f172a" },
] as const;

type HistoryMetric = "auc_roc" | "sensitivity_recall" | "specificity" | "accuracy";

export function Performance({ days }: { days: number }) {
  const { data, error, isLoading, reload } = useAdminData<PerformanceResponse>(`/performance?days=${days}`);

  return (
    <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={Boolean(data)}>
      {data ? <PerformanceContent data={data} days={days} /> : null}
    </LoadState>
  );
}

export function PerformanceContent({
  data,
  days,
  compact = false,
}: {
  data: PerformanceResponse;
  days: number;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<ModelName>(data.models[0]?.model_name ?? "xgboost");
  const [historyMetric, setHistoryMetric] = useState<HistoryMetric>("auc_roc");
  const selectedModel = data.models.find((model) => model.model_name === selected) ?? data.models[0];
  const passing = data.models.filter((model) => model.meets_targets).length;
  const comparison = data.models.map((model) => ({
    model: modelLabel(model.model_name),
    ...Object.fromEntries(METRICS.map((metric) => [metric.key, Math.round(model[metric.key] * 1000) / 10])),
  }));

  return (
    <div className="space-y-6">
      {data.source === "snapshot" ? (
        <Notice>
          Live metrics could not be retrieved from server-ml. Showing the latest stored snapshot
          {selectedModel?.snapshot_at ? ` from ${formatDateTime(selectedModel.snapshot_at)}` : ""}.
        </Notice>
      ) : null}

      <Card className="p-6">
        <CardHeader
          title="Model Performance Comparison"
          subtitle={`Evaluated on the ${data.dataset}. Acceptance targets (NFR-02): AUC-ROC ≥ ${data.targets.auc_roc}, sensitivity ≥ ${data.targets.sensitivity_recall}, specificity ≥ ${data.targets.specificity}.`}
          action={
            <Badge tone={passing === data.models.length ? "green" : passing ? "amber" : "red"}>
              {passing}/{data.models.length} meet targets
            </Badge>
          }
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.models.map((model) => (
            <button
              key={model.model_name}
              type="button"
              onClick={() => setSelected(model.model_name)}
              className={`rounded-[20px] border p-4 text-left transition ${
                selected === model.model_name
                  ? "border-cyan-300 bg-cyan-50 ring-4 ring-cyan-100"
                  : "border-slate-200 bg-slate-50 hover:border-cyan-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-slate-950">{modelLabel(model.model_name)}</p>
                {model.meets_targets ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Meets targets" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" aria-label="Below targets" />
                )}
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-950">{model.auc_roc.toFixed(3)}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">AUC-ROC</p>
            </button>
          ))}
        </div>

        <div className={`mt-6 grid gap-6 ${compact ? "" : "xl:grid-cols-[1.2fr_0.8fr]"}`}>
          <SubPanel title="Metric Comparison" subtitle="Percentage score by model and metric" action={<Badge tone="slate">Higher is better</Badge>}>
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="model" stroke="#64748b" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  {METRICS.map((metric) => (
                    <Bar
                      key={metric.key}
                      dataKey={metric.key}
                      name={metric.label}
                      fill={metric.color}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!compact}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SubPanel>

          {selectedModel ? <ModelDetail model={selectedModel} targets={data.targets} /> : null}
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Performance History"
          subtitle={`Daily metric snapshots over the last ${days} days. A change indicates the model was retrained or replaced.`}
          action={
            compact ? null : (
              <select
                value={historyMetric}
                onChange={(event) => setHistoryMetric(event.target.value as HistoryMetric)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
              >
                <option value="auc_roc">AUC-ROC</option>
                <option value="sensitivity_recall">Sensitivity</option>
                <option value="specificity">Specificity</option>
                <option value="accuracy">Accuracy</option>
              </select>
            )
          }
        />
        <div className="mt-6 h-[260px]">
          <HistoryChart history={data.history} metric={historyMetric} animate={!compact} />
        </div>
      </Card>
    </div>
  );
}

function ModelDetail({ model, targets }: { model: ModelMetrics; targets: PerformanceResponse["targets"] }) {
  const matrix = model.confusion_matrix;
  const cells = [
    { label: "True negative", value: matrix.true_negative, good: true },
    { label: "False positive", value: matrix.false_positive, good: false },
    { label: "False negative", value: matrix.false_negative, good: false },
    { label: "True positive", value: matrix.true_positive, good: true },
  ];

  return (
    <SubPanel
      title={`${modelLabel(model.model_name)} detail`}
      subtitle="Bars show score against the NFR-02 target marker"
      action={<Badge tone={model.meets_targets ? "green" : "red"}>{model.meets_targets ? "Meets targets" : "Below target"}</Badge>}
    >
      <div className="mt-4 space-y-3">
        <ScoreBar label="AUC-ROC" value={model.auc_roc} target={targets.auc_roc} />
        <ScoreBar label="Sensitivity" value={model.sensitivity_recall} target={targets.sensitivity_recall} />
        <ScoreBar label="Specificity" value={model.specificity} target={targets.specificity} />
        <ScoreBar label="Accuracy" value={model.accuracy} />
        <ScoreBar label="Precision" value={model.precision} />
        <ScoreBar label="F1-score" value={model.f1_score} />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Confusion matrix (held-out test set)</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={`rounded-xl px-3 py-2 ${cell.good ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          >
            <p className="text-lg font-bold">{cell.value ?? "–"}</p>
            <p className="text-xs font-semibold">{cell.label}</p>
          </div>
        ))}
      </div>
    </SubPanel>
  );
}

function HistoryChart({
  history,
  metric,
  animate,
}: {
  history: PerformanceResponse["history"];
  metric: HistoryMetric;
  animate: boolean;
}) {
  if (!history.length) {
    return <EmptyChart message="No metric snapshots in this period." />;
  }

  const models = [...new Set(history.map((row) => row.model_name))];
  const byDay = new Map<string, Record<string, string | number>>();
  history.forEach((row) => {
    const point = byDay.get(row.day) ?? { day: row.day };
    point[row.model_name] = Number(row[metric]);
    byDay.set(row.day, point);
  });
  const points = [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="day" tickFormatter={formatDay} stroke="#64748b" fontSize={12} />
        <YAxis domain={[0.5, 1]} tickFormatter={(value) => formatPercent(value, 0)} stroke="#64748b" fontSize={12} />
        <Tooltip labelFormatter={(value) => formatDay(String(value))} formatter={(value) => formatPercent(Number(value))} />
        <Legend formatter={(value) => modelLabel(String(value))} />
        {models.map((model) => (
          <Line
            key={model}
            type="monotone"
            dataKey={model}
            stroke={MODEL_COLORS[model] ?? "#64748b"}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={animate}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
