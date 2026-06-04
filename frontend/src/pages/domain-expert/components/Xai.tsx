import { BarChart3, Brain, ClipboardList, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AssessmentModel, BatchApiResponse, BatchApiRow, PredictionResult, XaiTab } from '../types';
import { featureLabels, globalImportance, iceData, pdpData, xaiTabs } from '../constants';
import { batchAggregateContributions, buildLimeSummary, buildShapSummary, displayContributions, riskLabel, sortedByMagnitude } from '../utils';
import { Card, CardHeader } from '../../../components/ui/Card';
import { AssessmentEmptyState, ChartCard, MetricCard, MetricGrid, ScenarioCard, XaiSummaryCard, RiskBadge } from './Shared';

export function XaiWorkspace({
  activeXaiTab,
  setActiveXaiTab,
  prediction,
  onGoToNewAssessment,
}: {
  activeXaiTab: XaiTab;
  setActiveXaiTab: (tab: XaiTab) => void;
  prediction: PredictionResult | null;
  onGoToNewAssessment: () => void;
}) {
  if (!prediction) {
    return (
      <AssessmentEmptyState
        icon={BarChart3}
        title="No assessment has been run yet."
        description="Run a single-patient assessment first to generate SHAP and LIME explanations."
        actionLabel="Go to New Assessment"
        onAction={onGoToNewAssessment}
      />
    );
  }

  const displayPrediction = prediction;

  return (
    <div className="space-y-6">
      <MetricGrid prediction={displayPrediction} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {xaiTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveXaiTab(tab.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeXaiTab === tab.id
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {activeXaiTab === "overview" ? <OverviewPanel prediction={displayPrediction} /> : null}
      {activeXaiTab === "shap" ? <ShapPanel prediction={displayPrediction} /> : null}
      {activeXaiTab === "lime" ? <LimePanel prediction={displayPrediction} /> : null}
      {activeXaiTab === "whatif" ? <WhatIfPanel /> : null}
      {activeXaiTab === "global" ? <GlobalPanel /> : null}
    </div>
  );
}

export function BatchXaiWorkspace({
  selectedModel,
  selectedRow,
  batchResult,
  onGoToBatchUpload,
}: {
  selectedModel: AssessmentModel;
  selectedRow: BatchApiRow | null;
  batchResult: BatchApiResponse | null;
  onGoToBatchUpload: () => void;
}) {
  if (!batchResult) {
    return (
      <AssessmentEmptyState
        icon={FileSpreadsheet}
        title="Upload and run a CSV batch assessment to view results."
        description="Batch XAI summaries are generated after the uploaded CSV has been processed successfully."
        actionLabel="Go to Batch Upload"
        onAction={onGoToBatchUpload}
      />
    );
  }

  const successfulRows = batchResult?.results.filter((row) => row.status === "success") ?? [];
  const aggregateData = batchAggregateContributions(successfulRows);
  const selectedSummary = selectedRow?.xai?.summary ?? selectedRow?.explanation ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={FileSpreadsheet} label="Batch Rows" value={`${batchResult?.summary.total_rows ?? 0}`} />
        <MetricCard icon={ShieldCheck} label="High Priority" value={`${successfulRows.filter((row) => row.risk_level === "high").length}`} tone="red" />
        <MetricCard icon={Brain} label="Model Used" value={selectedModel} tone="purple" />
        <MetricCard icon={ClipboardList} label="Review Focus" value={selectedRow ? `Row ${selectedRow.row_number}` : "None"} tone="cyan" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader
              title="Batch Explanation Overview"
              subtitle="Aggregated explanation patterns across successful rows."
            />
            <div className="mt-6 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregateData} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="featureLabel"
                    type="category"
                    width={180}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f172a" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              This chart averages absolute SHAP contribution magnitudes across successful batch rows to surface repeated model drivers.
            </p>
          </Card>

          <Card className="p-6">
            <CardHeader title="High-Risk Pattern Summary" />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {(selectedSummary.length ? selectedSummary : ["Select a successful row to inspect patient-level XAI rationale."]).map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="h-fit p-6">
          <CardHeader
            title="Row Detail Review"
            subtitle="Open a high-priority row to inspect patient-level explanation."
          />
          {selectedRow ? (
            <>
              <div className="mt-5 rounded-[22px] bg-red-50 p-5 ring-1 ring-red-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-red-950">
                      Row {selectedRow.row_number}
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                      Selected from the batch result table.
                    </p>
                  </div>
                  <RiskBadge category={riskLabel(selectedRow.risk_level ?? "")} />
                </div>
                <p className="mt-5 text-5xl font-bold text-red-950">
                  {(selectedRow.risk_score ?? 0).toFixed(2)}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {(selectedRow.explanation ?? []).map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Select a successful row from the batch result table to review row-level XAI.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
export function OverviewPanel({ prediction }: { prediction: PredictionResult }) {
  const data = displayContributions(prediction.xai.shap.contributions);
  const topPositive = [...data].sort((a, b) => b.value - a.value).slice(0, 3);
  const topReducing = [...data].sort((a, b) => a.value - b.value).slice(0, 2);

  return (
    <Card className="p-6">
      <CardHeader title="Top Contributing Factors" />
      <div className="mt-6 h-[540px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis
              dataKey="featureLabel"
              type="category"
              width={220}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar dataKey="value" radius={[10, 10, 10, 10]}>
              {data.map((entry) => (
                <Cell
                  key={entry.feature}
                  fill={entry.value >= 0 ? "#f97316" : "#14b8a6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Positive values push the model output toward higher predicted risk.
        Negative values reduce the predicted risk score. The largest upward
        signals are {topPositive.map((item) => item.featureLabel).join(", ")}.
        The strongest reducing signals are {topReducing.map((item) => item.featureLabel).join(", ")}.
      </p>
    </Card>
  );
}

export function ShapPanel({ prediction }: { prediction: PredictionResult }) {
  const { shap } = prediction.xai;
  const summary = buildShapSummary(prediction);
  const shapSteps = [
    { label: "Base value", value: shap.base_value, tone: "slate" },
    ...sortedByMagnitude(shap.contributions).map((item) => ({
      label: featureLabels[item.feature] ?? item.feature,
      value: item.value,
      tone: item.value >= 0 ? "orange" : "green",
    })),
    { label: "Final output", value: shap.final_value, tone: "cyan" },
  ];

  return (
    <Card className="p-6">
      <CardHeader
        title="SHAP Waterfall Explanation"
        subtitle={`Base value: ${shap.base_value.toFixed(2)} to final output: ${shap.final_value.toFixed(2)}`}
      />
      <div className="mt-6 space-y-4">
        {shapSteps.map((step, index) => (
          <div
            key={step.label}
            className="grid gap-3 rounded-[20px] bg-slate-50 p-4 md:grid-cols-[220px_1fr_70px] md:items-center"
          >
            <span className="text-sm font-semibold text-slate-700">
              {step.label}
            </span>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full ${
                  step.tone === "green"
                    ? "bg-emerald-500"
                    : step.tone === "cyan"
                      ? "bg-cyan-500"
                      : step.tone === "purple"
                        ? "bg-purple-500"
                        : step.tone === "slate"
                          ? "bg-slate-400"
                          : "bg-orange-500"
                }`}
                style={{ width: `${Math.max(Math.abs(step.value) * 100, 9)}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-950">
              {index === 0 || index === shapSteps.length - 1
                ? step.value.toFixed(2)
                : `${step.value > 0 ? "+" : ""}${step.value.toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <XaiSummaryCard title="How to read this" tone="purple">
          {summary.howToRead}
        </XaiSummaryCard>
        <XaiSummaryCard title="Patient-specific meaning" tone="purple">
          {summary.patientMeaning}
        </XaiSummaryCard>
      </div>
    </Card>
  );
}

export function LimePanel({ prediction }: { prediction: PredictionResult }) {
  const data = displayContributions(sortedByMagnitude(prediction.xai.lime.contributions));
  const summary = buildLimeSummary(prediction);

  return (
    <Card className="p-6">
      <CardHeader title="LIME Local Explanation" />
      <div className="mt-6 h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="featureLabel" tick={{ fontSize: 12 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[12, 12, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.feature}
                  fill={entry.value >= 0 ? "#ef4444" : "#10b981"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <XaiSummaryCard title="How to read this" tone="amber">
          {summary.howToRead}
        </XaiSummaryCard>
        <XaiSummaryCard title="Patient-specific meaning" tone="amber">
          {summary.patientMeaning}
        </XaiSummaryCard>
        <XaiSummaryCard title="Agreement with SHAP" tone="amber">
          {summary.agreement}
        </XaiSummaryCard>
      </div>
    </Card>
  );
}

export function WhatIfPanel() {
  return (
    <Card className="p-6">
      <CardHeader title="Counterfactual / What-if Simulation" />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ScenarioCard
          title="Current"
          tone="red"
          rows={[
            ["Cholesterol", "242 mg/dL"],
            ["Resting BP", "145 mmHg"],
            ["Risk Score", "82%"],
          ]}
        />
        <ScenarioCard
          title="Simulated"
          tone="amber"
          rows={[
            ["Cholesterol", "200 mg/dL"],
            ["Resting BP", "130 mmHg"],
            ["Simulated Risk Score", "69%"],
          ]}
        />
      </div>
      <p className="mt-5 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Simulation only — not a treatment recommendation.
      </p>
    </Card>
  );
}

export function GlobalPanel() {
  const importanceData = globalImportance.map((item) => ({
    ...item,
    featureLabel: featureLabels[item.feature] ?? item.feature,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <ChartCard title="Global Feature Importance">
        <ResponsiveContainer width="100%" height={520}>
          <BarChart data={importanceData} layout="vertical" margin={{ left: 24, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 0.4]} />
            <YAxis
              dataKey="featureLabel"
              type="category"
              width={220}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar dataKey="importance" fill="#06b6d4" radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Global importance summarizes which variables tend to influence the model across the training data. It is not patient-specific; use SHAP and LIME tabs for this individual assessment.
        </p>
      </ChartCard>
      <div className="grid gap-6">
        <ChartCard title="PDP Preview for Serum Cholesterol">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={pdpData} margin={{ left: 4, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="cholesterol"
                label={{ value: "Serum Cholesterol (mg/dL)", position: "insideBottom", offset: -4 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
              <Tooltip formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Predicted risk"]} />
              <Line
                type="monotone"
                dataKey="risk"
                stroke="#7c3aed"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            PDP shows the average model response as cholesterol changes while other features are averaged over the dataset.
          </p>
        </ChartCard>
        <ChartCard title="ICE Preview for Serum Cholesterol">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={iceData} margin={{ left: 4, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="cholesterol"
                label={{ value: "Serum Cholesterol (mg/dL)", position: "insideBottom", offset: -4 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
              <Tooltip formatter={(value, name) => [`${Math.round(Number(value) * 100)}%`, `Case ${String(name).replace("p", "")}`]} />
              <Line type="monotone" dataKey="p1" stroke="#06b6d4" strokeWidth={2} />
              <Line type="monotone" dataKey="p2" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="p3" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            ICE shows example patient-level response curves. Different slopes indicate that the same cholesterol change may affect cases differently.
          </p>
        </ChartCard>
      </div>
    </div>
  );
}

