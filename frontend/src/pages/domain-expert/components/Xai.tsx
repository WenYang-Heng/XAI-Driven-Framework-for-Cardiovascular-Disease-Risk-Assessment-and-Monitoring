import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  ClipboardList,
  FileSpreadsheet,
  Info,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AssessmentModel, BatchApiResponse, BatchApiRow, FeatureContribution, GlobalShapExplanation, GlobalShapFeatureImportance, PredictionResult, XaiTab } from '../types';
import { xaiTabs } from '../constants';
import {
  batchAggregateContributions,
  displayContributions,
  riskLabel,
  sortedByMagnitude,
} from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';
import { AssessmentEmptyState, MetricCard, RiskBadge } from './Shared';

type DisplayContribution = FeatureContribution & { featureLabel: string };
type DirectionLabel = "Increases Risk" | "Reduces Risk";
type AgreementLevel = "High" | "Moderate" | "Low" | "Unavailable";
type AgreementStatus = "Match" | "Partial" | "Conflict" | "Missing";

function normaliseGlobalRows(rows: GlobalShapFeatureImportance[] = []) {
  return rows
    .map((row) => ({
      ...row,
      rank: Number(row.rank),
      display_name: row.display_name || row.feature,
      mean_abs_shap: Number(row.mean_abs_shap),
    }))
    .filter((row) => Number.isFinite(row.rank) && Number.isFinite(row.mean_abs_shap))
    .sort((a, b) => a.rank - b.rank);
}

export function XaiWorkspace({
  activeXaiTab,
  setActiveXaiTab,
  prediction,
  selectedModel,
  globalShap,
  isGlobalShapLoading,
  globalShapError,
  patientFeatureValues,
  onBackToResult,
  onGoToNewAssessment,
}: {
  activeXaiTab: XaiTab;
  setActiveXaiTab: (tab: XaiTab) => void;
  prediction: PredictionResult | null;
  selectedModel: AssessmentModel;
  globalShap: GlobalShapExplanation | null;
  isGlobalShapLoading: boolean;
  globalShapError: string | null;
  patientFeatureValues?: Record<string, string> | null;
  onBackToResult: () => void;
  onGoToNewAssessment: () => void;
}) {
  if (!prediction && !globalShap && !isGlobalShapLoading) {
    return (
      <AssessmentEmptyState
        icon={BarChart3}
        title="XAI visualisation data is not available."
        description={globalShapError ?? "Saved Global SHAP data was not found for the selected model. Run an assessment to generate patient-level SHAP and LIME explanations."}
        actionLabel="Go to New Assessment"
        onAction={onGoToNewAssessment}
      />
    );
  }

  const shapRows = prediction ? displayContributions(sortedByMagnitude(prediction.xai.shap.contributions)) : [];
  const limeRows = prediction ? displayContributions(sortedByMagnitude(prediction.xai.lime.contributions)) : [];
  const hasShap = shapRows.length > 0;
  const hasLime = limeRows.length > 0;
  const agreement = prediction ? deriveAgreement(prediction) : null;

  return (
    <div className="space-y-6">
      {!globalShap && !isGlobalShapLoading && !hasShap && !hasLime ? (
        <XaiEmptyMessage />
      ) : (
        <>
          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              {xaiTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveXaiTab(tab.id)}
                  className={`min-h-10 rounded-2xl px-4 text-sm font-semibold transition ${
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

          {activeXaiTab === "overview" ? (
            <OverviewPanel
              prediction={prediction}
              selectedModel={selectedModel}
              globalShap={globalShap}
              isGlobalShapLoading={isGlobalShapLoading}
              globalShapError={globalShapError}
              patientFeatureValues={patientFeatureValues}
            />
          ) : null}
          {activeXaiTab === "shap" ? (
            prediction ? <ShapPanel prediction={prediction} patientFeatureValues={patientFeatureValues} /> : <PatientXaiRequired method="SHAP" />
          ) : null}
          {activeXaiTab === "lime" ? (
            prediction ? <LimePanel prediction={prediction} patientFeatureValues={patientFeatureValues} /> : <PatientXaiRequired method="LIME" />
          ) : null}
          {activeXaiTab === "comparison" ? (
            prediction && agreement ? <ComparisonPanel prediction={prediction} agreement={agreement} /> : <PatientXaiRequired method="comparison" />
          ) : null}

          {prediction ? <TechnicalDetails prediction={prediction} /> : null}

          <Card className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm leading-6 text-slate-600">
                {prediction
                  ? "Want to validate or comment on this assessment? Return to the Assessment Result page to submit assessment feedback."
                  : "Global SHAP explains model-level behaviour across the saved dataset. Run a patient assessment to unlock local SHAP, LIME, and consistency review."}
              </p>
              <Button variant="secondary" onClick={prediction ? onBackToResult : onGoToNewAssessment}>
                {prediction ? "Back to Assessment Result" : "Go to New Assessment"}
              </Button>
            </div>
          </Card>
        </>
      )}
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

  const successfulRows = batchResult.results.filter((row) => row.status === "success");
  const aggregateData = batchAggregateContributions(successfulRows);
  const selectedSummary = selectedRow?.xai?.summary ?? selectedRow?.explanation ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={FileSpreadsheet} label="Batch Rows" value={`${batchResult.summary.total_rows}`} />
        <MetricCard icon={ShieldCheck} label="High Priority" value={`${successfulRows.filter((row) => row.risk_level === "high").length}`} tone="red" />
        <MetricCard icon={Brain} label="Model Used" value={selectedModel} tone="purple" />
        <MetricCard icon={ClipboardList} label="Review Focus" value={selectedRow ? `Row ${selectedRow.row_number}` : "None"} tone="cyan" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-6">
          <CardHeader title="Batch Explanation Overview" subtitle="Average absolute SHAP contribution across successful rows." />
          <div className="mt-6 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregateData} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="featureLabel" type="category" width={190} interval={0} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [Number(value).toFixed(4), "Mean absolute SHAP"]} />
                <Bar dataKey="value" fill="#0f172a" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Use this view to spot repeated drivers across the uploaded file. Open a row to review patient-level SHAP and LIME details.
          </p>
        </Card>

        <Card className="h-fit p-6">
          <CardHeader title="Selected Row Review" subtitle="Patient-level explanation summary." />
          {selectedRow ? (
            <>
              <div className="mt-5 rounded-[22px] bg-red-50 p-5 ring-1 ring-red-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-red-950">Row {selectedRow.row_number}</p>
                    <p className="mt-1 text-sm text-red-700">Risk score {(selectedRow.risk_score ?? 0).toFixed(2)}</p>
                  </div>
                  <RiskBadge category={riskLabel(selectedRow.risk_level ?? "")} />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {(selectedSummary.length ? selectedSummary : ["No row-level summary was returned."]).slice(0, 5).map((item) => (
                  <p key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {item}
                  </p>
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

export function OverviewPanel({
  prediction,
  selectedModel,
  globalShap,
  isGlobalShapLoading,
  globalShapError,
  patientFeatureValues,
}: {
  prediction: PredictionResult | null;
  selectedModel: AssessmentModel;
  globalShap: GlobalShapExplanation | null;
  isGlobalShapLoading: boolean;
  globalShapError: string | null;
  patientFeatureValues?: Record<string, string> | null;
}) {
  const globalRows = normaliseGlobalRows(globalShap?.feature_importance).slice(0, 13);
  const topRows = globalRows.slice(0, 5);
  const topFeature = topRows[0];
  const maxImportance = Math.max(...globalRows.map((row) => row.mean_abs_shap), 0);
  const patientFactors = prediction ? deriveMainFactors(prediction, patientFeatureValues).slice(0, 5) : [];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <CardHeader
            title="Global SHAP Overview"
            subtitle="Saved dataset-level feature importance from public.model_global_explanations."
          />
          <div className="flex flex-wrap gap-2">
            <Badge tone={globalShap?.generation_status === "completed" ? "green" : "amber"}>
              {globalShap?.generation_status ?? (isGlobalShapLoading ? "loading" : "unavailable")}
            </Badge>
            <Badge tone="purple">{selectedModel}</Badge>
          </div>
        </div>

        {globalShapError ? (
          <p className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {globalShapError}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryPill label="Dataset" value={globalShap?.dataset_name ?? "UCI Heart Disease"} />
          <SummaryPill label="Samples Explained" value={globalShap?.samples_explained ? `${globalShap.samples_explained}` : isGlobalShapLoading ? "Loading" : "Unavailable"} />
          <SummaryPill label="Explainer" value={globalShap?.explainer_type ?? "Unavailable"} />
          <SummaryPill label="Top Driver" value={topFeature?.display_name ?? "Unavailable"} />
        </div>

        {globalShap?.summary_text ? (
          <div className="mt-6 rounded-[18px] border border-cyan-100 bg-cyan-50 p-5">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-6 text-cyan-950">{globalShap.summary_text}</p>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="p-6">
          <CardHeader
            title="Mean Absolute SHAP by Feature"
            subtitle="Higher values indicate stronger average influence across the explained dataset."
          />
          {globalRows.length ? (
            <div className="mt-6 h-[460px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={globalRows} layout="vertical" margin={{ left: 16, right: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="display_name" type="category" width={230} interval={0} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [Number(value).toFixed(6), "Mean |SHAP|"]} />
                  <Bar dataKey="mean_abs_shap" radius={[7, 7, 7, 7]}>
                    {globalRows.map((entry) => (
                      <Cell key={entry.feature} fill={entry.rank <= 3 ? "#0e7490" : entry.rank <= 8 ? "#6366f1" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <GlobalShapLoadingState isLoading={isGlobalShapLoading} />
          )}
        </Card>

        <Card className="p-6">
          <CardHeader title="Influence Profile" subtitle="Ranked Global SHAP values saved for this model." />
          <div className="mt-5 space-y-3">
            {topRows.length ? topRows.map((row) => (
              <div key={row.feature} className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Rank {row.rank}</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{row.display_name}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{row.feature}</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-cyan-700">{row.mean_abs_shap.toFixed(6)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-cyan-600"
                    style={{ width: `${maxImportance ? Math.max((row.mean_abs_shap / maxImportance) * 100, 4) : 0}%` }}
                  />
                </div>
              </div>
            )) : (
              <GlobalShapLoadingState isLoading={isGlobalShapLoading} />
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader title="Feature Importance Table" subtitle="Raw fields from feature_importance JSONB." />
        <div className="mt-5 overflow-x-auto rounded-[18px] border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Rank</th>
                <th className="px-4 py-3 font-bold">Display Name</th>
                <th className="px-4 py-3 font-bold">Feature</th>
                <th className="px-4 py-3 font-bold">Mean Absolute SHAP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {globalRows.map((row) => (
                <tr key={row.feature}>
                  <td className="px-4 py-3 font-bold text-slate-800">{row.rank}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.display_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.feature}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-700">{row.mean_abs_shap.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!globalRows.length ? <GlobalShapLoadingState isLoading={isGlobalShapLoading} /> : null}
        </div>
      </Card>

      {prediction ? (
        <Card className="p-6">
          <CardHeader
            title="Current Patient Context"
            subtitle="Local factors from the active assessment, shown for comparison with global model behaviour."
          />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryPill label="Risk Category" value={`${riskLabel(prediction.risk_level)} Risk`} />
            <SummaryPill label="Risk Probability" value={formatProbability(prediction.risk_score)} />
            <SummaryPill label="Model Used" value={selectedModel} />
          </div>
          <div className="mt-6 overflow-hidden rounded-[18px] border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Feature</th>
                  <th className="px-4 py-3 font-bold">Patient Value</th>
                  <th className="px-4 py-3 font-bold">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patientFactors.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.featureLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{row.patientValue ?? "Unavailable"}</td>
                    <td className="px-4 py-3"><DirectionBadge direction={row.direction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950">Patient-level XAI is not open yet</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This overview is loaded from the precomputed global explanation. Run a single-patient assessment to compare these global drivers with local SHAP and LIME outputs.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export function ShapPanel({
  prediction,
  patientFeatureValues,
}: {
  prediction: PredictionResult;
  patientFeatureValues?: Record<string, string> | null;
}) {
  const { shap } = prediction.xai;
  const ranked = displayContributions(sortedByMagnitude(shap.contributions));

  if (!ranked.length) {
    return <MethodEmptyState title="No SHAP values available" description="SHAP values were not returned for this assessment." />;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="SHAP Visualisation"
          subtitle="SHAP shows how each feature pushed the prediction above or below the model's baseline risk."
        />
        <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          How to read this chart: Longer bars mean stronger influence. Bars increasing risk pushed the prediction toward a higher CVD risk.
          Bars reducing risk pushed the prediction toward a lower CVD risk.
        </p>
        <div className="mt-6 h-[470px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ranked} layout="vertical" margin={{ left: 12, right: 28 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="featureLabel" type="category" width={220} interval={0} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [directionLabel(Number(value)), "Direction"]} />
              <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                {ranked.map((entry) => (
                  <Cell key={entry.feature} fill={entry.value >= 0 ? "#f97316" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <ExplanationTable
        title="SHAP Explanation Table"
        method="SHAP"
        rows={ranked}
        patientFeatureValues={patientFeatureValues}
      />
    </div>
  );
}

export function LimePanel({
  prediction,
  patientFeatureValues,
}: {
  prediction: PredictionResult;
  patientFeatureValues?: Record<string, string> | null;
}) {
  const ranked = displayContributions(sortedByMagnitude(prediction.xai.lime.contributions));

  if (!ranked.length) {
    return <MethodEmptyState title="No LIME explanation available" description="LIME values were not returned for this assessment." />;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="LIME Visualisation"
          subtitle="LIME explains this individual prediction using a simpler local model around this patient case."
        />
        <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          LIME focuses on this individual patient case. It approximates the model's behaviour near this case using simpler rules.
        </p>
        <div className="mt-6 h-[430px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ranked} layout="vertical" margin={{ left: 12, right: 28 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="featureLabel" type="category" width={220} interval={0} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [directionLabel(Number(value)), "Direction"]} />
              <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                {ranked.map((entry) => (
                  <Cell key={entry.feature} fill={entry.value >= 0 ? "#f97316" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <ExplanationTable
        title="LIME Explanation Table"
        method="LIME"
        rows={ranked}
        patientFeatureValues={patientFeatureValues}
      />
    </div>
  );
}

function ComparisonPanel({
  prediction,
  agreement,
}: {
  prediction: PredictionResult;
  agreement: ReturnType<typeof deriveAgreement>;
}) {
  const rows = deriveComparisonRows(prediction);

  if (agreement.level === "Unavailable") {
    return (
      <MethodEmptyState
        title="Unable to compare SHAP and LIME"
        description="Unable to compare SHAP and LIME because one explanation is missing."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="SHAP vs LIME Consistency"
          subtitle="Compare whether both XAI techniques identify similar risk factors."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <SummaryPill label="Agreement Level" value={agreement.level} />
          <SummaryPill label="Matching Factors" value={`${agreement.matchCount}`} />
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Meaning</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              High agreement means both techniques identify similar main contributors.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader title="Comparison Table" subtitle="Direction and agreement across top SHAP and LIME factors." />
        <div className="mt-5 overflow-x-auto rounded-[20px] border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Feature</th>
                <th className="px-4 py-3 font-bold">SHAP Direction</th>
                <th className="px-4 py-3 font-bold">LIME Direction</th>
                <th className="px-4 py-3 font-bold">Agreement</th>
                <th className="px-4 py-3 font-bold">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.feature}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.featureLabel}</td>
                  <td className="px-4 py-3">{row.shapDirection ? <DirectionBadge direction={row.shapDirection} /> : "Missing"}</td>
                  <td className="px-4 py-3">{row.limeDirection ? <DirectionBadge direction={row.limeDirection} /> : "Missing"}</td>
                  <td className="px-4 py-3"><AgreementBadge status={row.agreement} /></td>
                  <td className="px-4 py-3 text-slate-600">{comparisonComment(row.agreement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ExplanationTable({
  title,
  method,
  rows,
  patientFeatureValues,
}: {
  title: string;
  method: "SHAP" | "LIME";
  rows: DisplayContribution[];
  patientFeatureValues?: Record<string, string> | null;
}) {
  return (
    <Card className="p-6">
      <CardHeader title={title} subtitle="Template-based interpretation of each returned feature contribution." />
      <div className="mt-5 overflow-x-auto rounded-[20px] border border-slate-200">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">{method === "SHAP" ? "Feature" : "Feature or Feature Condition"}</th>
              <th className="px-4 py-3 font-bold">Patient Value</th>
              <th className="px-4 py-3 font-bold">Direction</th>
              <th className="px-4 py-3 font-bold">Interpretation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const direction = directionLabel(row.value);
              return (
                <tr key={row.feature}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.featureLabel}</td>
                  <td className="px-4 py-3 text-slate-600">{patientFeatureValues?.[row.feature] ?? "Unavailable"}</td>
                  <td className="px-4 py-3"><DirectionBadge direction={direction} /></td>
                  <td className="px-4 py-3 text-slate-600">{interpretation(method, row.featureLabel, direction)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TechnicalDetails({ prediction }: { prediction: PredictionResult }) {
  return (
    <details className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-soft">
      <summary className="cursor-pointer text-base font-bold text-slate-950">Technical Details</summary>
      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <RawContributionList title="Raw SHAP Values" rows={displayContributions(prediction.xai.shap.contributions)} />
        <RawContributionList title="Raw LIME Weights" rows={displayContributions(prediction.xai.lime.contributions)} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryPill label="Model Prediction Probability" value={formatProbability(prediction.risk_score)} />
        <SummaryPill label="Baseline Probability" value={Number.isFinite(prediction.xai.shap.base_value) ? formatProbability(prediction.xai.shap.base_value) : "Unavailable"} />
        <SummaryPill label="Final SHAP Output" value={Number.isFinite(prediction.xai.shap.final_value) ? prediction.xai.shap.final_value.toFixed(4) : "Unavailable"} />
        <SummaryPill label="Feature Encoding" value="Unavailable" />
      </div>
    </details>
  );
}

function RawContributionList({ title, rows }: { title: string; rows: DisplayContribution[] }) {
  return (
    <div className="rounded-[20px] border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <div className="mt-4 max-h-72 overflow-auto">
        {rows.length ? rows.map((row) => (
          <div key={row.feature} className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
            <span className="font-semibold text-slate-700">{row.featureLabel}</span>
            <span className="font-mono text-xs text-slate-500">{signed(row.value)}</span>
          </div>
        )) : (
          <p className="text-sm text-slate-500">Unavailable</p>
        )}
      </div>
    </div>
  );
}

function MethodEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-6">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </Card>
  );
}

function PatientXaiRequired({ method }: { method: "SHAP" | "LIME" | "comparison" }) {
  return (
    <Card className="p-6">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-950">Run a patient assessment to view {method}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The Overview tab uses saved global SHAP data. This tab needs a current prediction because it explains one patient-level model output.
          </p>
        </div>
      </div>
    </Card>
  );
}

function GlobalShapLoadingState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="p-5">
      <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        {isLoading
          ? "Loading saved Global SHAP feature importance..."
          : "No Global SHAP feature_importance values are available for this model."}
      </p>
    </div>
  );
}

function XaiEmptyMessage() {
  return (
    <MethodEmptyState
      title="Loading XAI visualisation data"
      description="XAI visualisation data is not available for this assessment. Please ensure that SHAP and LIME generation has completed successfully."
    />
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function GuideItem({ title, text, tone }: { title: string; text: string; tone: "amber" | "green" }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <Badge tone={tone}>{title}</Badge>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: DirectionLabel }) {
  return (
    <Badge tone={direction === "Increases Risk" ? "amber" : "green"}>
      {direction === "Increases Risk" ? <ArrowUp className="mr-1 h-3 w-3" /> : <ArrowDown className="mr-1 h-3 w-3" />}
      {direction}
    </Badge>
  );
}

function AgreementBadge({ status }: { status: AgreementStatus }) {
  const tone = status === "Match" ? "green" : status === "Partial" ? "amber" : status === "Conflict" ? "red" : "slate";
  return <Badge tone={tone}>{status}</Badge>;
}

function deriveMainFactors(prediction: PredictionResult, patientFeatureValues?: Record<string, string> | null) {
  const byFeature = new Map<string, DisplayContribution>();
  [...displayContributions(prediction.xai.shap.contributions), ...displayContributions(prediction.xai.lime.contributions)].forEach((row) => {
    const existing = byFeature.get(row.feature);
    if (!existing || Math.abs(row.value) > Math.abs(existing.value)) {
      byFeature.set(row.feature, row);
    }
  });

  const rows = sortedByMagnitude([...byFeature.values()]);
  return rows.map((row) => ({
    ...row,
    patientValue: patientFeatureValues?.[row.feature],
    direction: directionLabel(row.value),
  }));
}

function deriveAgreement(prediction: PredictionResult) {
  const rows = deriveComparisonRows(prediction);

  if (!rows.some((row) => row.shapDirection) || !rows.some((row) => row.limeDirection)) {
    return { level: "Unavailable" as AgreementLevel, matchCount: 0 };
  }

  const comparableCount = rows.filter((row) => row.shapDirection && row.limeDirection).length;
  const matchCount = rows.filter((row) => row.agreement === "Match").length;
  const matchRatio = comparableCount > 0 ? matchCount / comparableCount : 0;

  const level: AgreementLevel = matchRatio >= 0.75 ? "High" : matchRatio >= 0.4 ? "Moderate" : "Low";
  return { level, matchCount };
}

function deriveComparisonRows(prediction: PredictionResult) {
  const shapTop = displayContributions(sortedByMagnitude(prediction.xai.shap.contributions));
  const limeTop = displayContributions(sortedByMagnitude(prediction.xai.lime.contributions));
  const shapMap = new Map(shapTop.map((row) => [row.feature, row]));
  const limeMap = new Map(limeTop.map((row) => [row.feature, row]));
  const features = Array.from(new Set([...shapTop.map((row) => row.feature), ...limeTop.map((row) => row.feature)]));

  return features.map((feature) => {
    const shap = shapMap.get(feature);
    const lime = limeMap.get(feature);
    const shapDirection = shap ? directionLabel(shap.value) : null;
    const limeDirection = lime ? directionLabel(lime.value) : null;
    const agreement: AgreementStatus = !shap || !lime
      ? "Missing"
      : shapDirection !== limeDirection
        ? "Conflict"
        : "Match";

    return {
      feature,
      featureLabel: shap?.featureLabel ?? lime?.featureLabel ?? feature,
      shapDirection,
      limeDirection,
      agreement,
    };
  });
}

function interpretation(method: "SHAP" | "LIME", feature: string, direction: DirectionLabel) {
  if (method === "SHAP") {
    return direction === "Increases Risk"
      ? `${feature} pushed the prediction toward a higher CVD risk.`
      : `${feature} pushed the prediction toward a lower CVD risk.`;
  }

  return direction === "Increases Risk"
    ? "This feature supported the higher-risk prediction."
    : "This feature reduced support for the higher-risk prediction.";
}

function comparisonComment(status: AgreementStatus) {
  if (status === "Match") {
    return "Both techniques identify this feature in the same direction.";
  }
  if (status === "Partial") {
    return "Both techniques mention this feature, but the direction may differ.";
  }
  if (status === "Conflict") {
    return "The techniques disagree on how this feature influenced the prediction.";
  }
  return "This feature appears in one explanation method but not the other.";
}

function directionLabel(value: number): DirectionLabel {
  return value >= 0 ? "Increases Risk" : "Reduces Risk";
}

function formatProbability(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "Unavailable";
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(4)}`;
}
