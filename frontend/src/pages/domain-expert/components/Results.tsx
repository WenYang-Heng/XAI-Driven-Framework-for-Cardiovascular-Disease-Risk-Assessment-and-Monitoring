import { useEffect, useState } from 'react';
import { BarChart3, Brain, CheckCircle2, ClipboardList, Edit3, FileSpreadsheet, Gauge, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AssessmentModel, BatchApiResponse, BatchApiRow, DomainExpertUser, FeedbackForm, ModelPerformance, PredictionResult } from '../types';
import { API_BASE_URL } from '../constants';
import { buildOutcomeSummary, riskLabel, riskTone } from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';
import { AssessmentEmptyState, FilterSelect, Legend, MetricCard, MetricGrid, ModelPerformancePanel, RiskBadge, RiskGauge, SelectField, TextField } from './Shared';

export function BatchAssessmentResult({
  selectedModel,
  batchResult,
  selectedRow,
  onSelectRow,
  onGoToBatchUpload,
  onViewXai,
}: {
  selectedModel: AssessmentModel;
  batchResult: BatchApiResponse | null;
  selectedRow: BatchApiRow | null;
  onSelectRow: (row: BatchApiRow) => void;
  onGoToBatchUpload: () => void;
  onViewXai: (row: BatchApiRow) => void;
}) {
  const rows = batchResult?.results ?? [];
  const highCount = rows.filter((row) => row.risk_level === "high").length;
  const moderateCount = rows.filter((row) => row.risk_level === "moderate").length;
  const lowCount = rows.filter((row) => row.risk_level === "low").length;
  const distribution = [
    { level: "High", count: highCount, fill: "#ef4444" },
    { level: "Moderate", count: moderateCount, fill: "#f59e0b" },
    { level: "Low", count: lowCount, fill: "#10b981" },
    { level: "Failed", count: batchResult?.summary.failed_rows ?? 0, fill: "#94a3b8" },
  ];
  const priorityRows = [...rows]
    .filter((row) => row.status === "success")
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice(0, 4);

  if (!batchResult) {
    return (
      <AssessmentEmptyState
        icon={FileSpreadsheet}
        title="Upload and run a CSV batch assessment to view results."
        description="Batch results, risk distribution, row-level review, and batch XAI will appear after a CSV file has been processed."
        actionLabel="Go to Batch Upload"
        onAction={onGoToBatchUpload}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={FileSpreadsheet} label="Uploaded Rows" value={`${batchResult.summary.total_rows}`} />
        <MetricCard icon={CheckCircle2} label="Processed" value={`${batchResult.summary.successful_rows}`} tone="green" />
        <MetricCard icon={ShieldCheck} label="High Risk" value={`${highCount}`} tone="red" />
        <MetricCard icon={Gauge} label="Moderate Risk" value={`${moderateCount}`} tone="amber" />
        <MetricCard icon={Brain} label="Model Used" value={selectedModel} tone="purple" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <CardHeader
            title="Batch Risk Distribution"
            subtitle="Processed CSV rows grouped by model risk category."
          />
          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="level" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[12, 12, 0, 0]}>
                  {distribution.map((entry) => (
                    <Cell key={entry.level} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="Review Priority"
            subtitle="Highest-risk successful rows are surfaced first for domain expert review."
          />
          <div className="mt-5 space-y-3">
            {priorityRows.map((row, index) => (
              <div
                key={row.row_number}
                className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-[44px_1fr_auto] sm:items-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-950">
                    Row {row.row_number}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {row.explanation?.[0] ?? "Successful prediction"}
                  </p>
                </div>
                <RiskBadge category={riskLabel(row.risk_level ?? "")} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardHeader
              title="Batch Result Table"
              subtitle="Select a successful row to inspect its individual assessment result."
            />
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Risk" options={["All", "High", "Moderate", "Low", "Failed"]} />
              <FilterSelect label="Status" options={["All", "Success", "Failed"]} />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
            <table className="w-full min-w-[960px] border-collapse bg-white text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Row", "Patient Ref", "Risk Score", "Risk Level", "Status", "Key Signal", "Action"].map((heading) => (
                    <th key={heading} className="px-5 py-4 font-bold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const selected = selectedRow?.row_number === row.row_number;
                  const failed = row.status === "failed";

                  return (
                    <tr
                      key={row.row_number}
                      className={`transition ${
                        selected
                          ? "bg-cyan-50/70"
                          : !failed
                            ? "cursor-pointer hover:bg-slate-50/70"
                            : "bg-slate-50/50"
                      }`}
                      onClick={() => {
                        if (!failed) {
                          onSelectRow(row);
                        }
                      }}
                    >
                      <td className="px-5 py-4 font-bold text-slate-950">{row.row_number}</td>
                      <td className="px-5 py-4 text-slate-600">{row.patient_reference_id ?? row.request_id ?? `CSV-${row.row_number}`}</td>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        {failed ? "--" : (row.risk_score ?? 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
                        <RiskBadge category={failed ? "Failed" : riskLabel(row.risk_level ?? "")} />
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={!failed ? "cyan" : "amber"}>
                          {!failed ? "Success" : "Failed"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {row.explanation?.[0] ?? row.error_message ?? "No explanation available"}
                      </td>
                      <td className="px-5 py-4">
                        <Button
                          variant="secondary"
                          disabled={failed}
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewXai(row);
                          }}
                        >
                          Review XAI
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <BatchRowAssessmentDetail
          selectedModel={selectedModel}
          row={selectedRow}
          onViewXai={() => {
            if (selectedRow) {
              onViewXai(selectedRow);
            }
          }}
        />
      </div>
    </div>
  );
}

export function BatchRowAssessmentDetail({
  selectedModel,
  row,
  onViewXai,
}: {
  selectedModel: AssessmentModel;
  row: BatchApiRow | null;
  onViewXai: () => void;
}) {
  if (!row) {
    return (
      <Card className="h-fit p-6">
        <CardHeader
          title="Selected Row Assessment"
          subtitle="Select a successful row to inspect its individual assessment result."
        />
      </Card>
    );
  }

  const category = riskLabel(row.risk_level ?? "");
  const score = row.risk_score ?? 0;
  const explanations = row.explanation ?? ["No explanation available for this row."];
  const isHigh = row.risk_level === "high";
  const isModerate = row.risk_level === "moderate";
  const gaugeColor = isHigh ? "#ef4444" : isModerate ? "#f59e0b" : "#10b981";
  const gaugeDegrees = Math.round(score * 360);

  return (
    <Card className="h-fit p-6">
      <div className="flex items-start justify-between gap-4">
        <CardHeader
          title="Selected Row Assessment"
          subtitle={`Row ${row.row_number} from the uploaded batch.`}
        />
        <RiskBadge category={category} />
      </div>

      <div className="mt-6 flex flex-col items-center rounded-[22px] bg-slate-50 p-5">
        <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-slate-100">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${gaugeColor} 0deg ${gaugeDegrees}deg, #e2e8f0 ${gaugeDegrees}deg 360deg)`,
            }}
          />
          <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-4xl font-bold text-slate-950">
              {Math.round(score * 100)}%
            </span>
            <span className="mt-1 text-xs font-bold text-slate-500">
              Risk Score
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm font-bold text-slate-950">
          {row.patient_reference_id ?? row.request_id ?? `CSV-${row.row_number}`}
        </p>
        <p className="mt-1 text-sm text-slate-500">{selectedModel}</p>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-950">Key Risk Signals</h3>
        <div className="mt-3 space-y-2">
          {explanations.map((item) => (
            <div
              key={item}
              className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-950">Input Summary</h3>
        <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
          {[
            ["Row Number", `${row.row_number}`],
            ["Patient Reference", row.patient_reference_id ?? "Not mapped"],
            ["Request ID", row.request_id ?? "Not saved"],
            ["Result ID", row.result_id ?? "Not saved"],
            ["Model", selectedModel],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span className="text-slate-500">{label}</span>
              <span className="text-right font-semibold text-slate-900">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Button onClick={onViewXai}>
          <BarChart3 className="h-4 w-4" />
          Open Row XAI Review
        </Button>
      </div>
    </Card>
  );
}

export function AssessmentResult({
  patientSummary,
  prediction,
  selectedModel,
  modelPerformance,
  isPerformanceLoading,
  performanceError,
  onGoToNewAssessment,
  onViewXai,
  currentUser,
}: {
  patientSummary: string[][];
  prediction: PredictionResult | null;
  selectedModel: AssessmentModel;
  modelPerformance: ModelPerformance;
  isPerformanceLoading: boolean;
  performanceError: string | null;
  onGoToNewAssessment: () => void;
  onViewXai: () => void;
  currentUser?: DomainExpertUser;
}) {
  const defaultFeedback: FeedbackForm = {
    assessmentRiskLevel: "moderate",
    agreementLevel: "3",
    isClinicallyAcceptable: true,
    confidenceLevel: "3",
    feedbackComment: "",
    useForFutureRetraining: false,
  };
  const [feedback, setFeedback] = useState<FeedbackForm>(defaultFeedback);
  const [hasSavedFeedback, setHasSavedFeedback] = useState(false);
  const [isEditingFeedback, setIsEditingFeedback] = useState(true);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);

  useEffect(() => {
    setFeedback(defaultFeedback);
    setHasSavedFeedback(false);
    setIsEditingFeedback(true);
    setFeedbackStatus(null);

    if (!prediction?.result_id) {
      return;
    }

    const controller = new AbortController();

    async function loadFeedback() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/predictions/${prediction.result_id}/feedback`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          items: Array<{
            clinician_risk_level?: "low" | "moderate" | "high" | null;
            agreement_level?: number | null;
            confidence_level?: number | null;
            feedback_comment?: string | null;
          }>;
        };
        const latest = data.items[0];
        if (!latest) {
          return;
        }

        setFeedback({
          assessmentRiskLevel: latest.clinician_risk_level ?? "moderate",
          agreementLevel: String(latest.agreement_level ?? 3),
          isClinicallyAcceptable: true,
          confidenceLevel: String(latest.confidence_level ?? 3),
          feedbackComment: latest.feedback_comment ?? "",
          useForFutureRetraining: false,
        });
        setHasSavedFeedback(true);
        setIsEditingFeedback(false);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setFeedbackStatus("Unable to load saved feedback for this assessment.");
        }
      }
    }

    loadFeedback();
    return () => controller.abort();
  }, [prediction?.result_id]);

  if (!prediction) {
    return (
      <AssessmentEmptyState
        icon={Gauge}
        title="No assessment has been run yet."
        description="Run a single-patient assessment first to view the risk result, rationale summary, model metrics, and XAI visualizations."
        actionLabel="Go to New Assessment"
        onAction={onGoToNewAssessment}
      />
    );
  }

  const displayPrediction = prediction;
  const outcomeSummary = buildOutcomeSummary(displayPrediction);
  const rationaleCards = displayPrediction.xai.summary.length
    ? displayPrediction.xai.summary.slice(1, 5)
    : outcomeSummary.cards;

  return (
    <div className="space-y-6">
      <MetricGrid
        selectedModel={selectedModel}
        prediction={displayPrediction}
        patientReference={displayPrediction.patient_reference_id ?? patientSummary.find(([label]) => label === "Patient Reference ID")?.[1] ?? "Auto-generated"}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <CardHeader title="Risk Assessment Output" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr] lg:items-center">
            <RiskGauge prediction={displayPrediction} />
            <div>
              <Badge tone={riskTone(displayPrediction.risk_level)}>
                {riskLabel(displayPrediction.risk_level)} Risk
              </Badge>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                Risk probability
              </p>
              <p className="mt-1 text-4xl font-bold text-slate-950">
                {displayPrediction.risk_score.toFixed(2)}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Legend tone="green" label="Low" range="0.00-0.34" />
                <Legend tone="amber" label="Moderate" range="0.35-0.69" />
                <Legend tone="red" label="High" range="0.70-1.00" />
              </div>
            </div>
          </div>
          <div className="mt-7 rounded-[20px] border border-cyan-100 bg-cyan-50 p-5">
            <h3 className="text-sm font-bold text-cyan-950">Rationale Summary</h3>
            <p className="mt-3 rounded-2xl bg-white/90 px-4 py-3 text-base font-semibold leading-7 text-cyan-950">
              {outcomeSummary.headline}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {rationaleCards.map((item) => (
                <p key={item} className="rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-cyan-900">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title="Patient Input Summary" />
          <div className="mt-5 divide-y divide-slate-100">
            {patientSummary.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <ModelPerformancePanel
        selectedModel={selectedModel}
        modelPerformance={modelPerformance}
        isLoading={isPerformanceLoading}
        error={performanceError}
      />

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Next Step</h3>
            <p className="mt-1 text-sm text-slate-500">
              Generate explainable AI outputs to inspect which features
              contributed to this risk assessment.
            </p>
            <p className="mt-3 text-xs font-medium text-slate-400">
              Risk score is generated by the trained ML model and should be
              reviewed by a qualified domain expert.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onViewXai} disabled={!prediction}>
              <BarChart3 className="h-4 w-4" />
              View XAI Visualization
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardHeader
            title="Assessment Feedback"
            subtitle="Capture expert judgement for validation and future retraining evidence."
          />
          {hasSavedFeedback && !isEditingFeedback ? (
            <Button variant="secondary" onClick={() => setIsEditingFeedback(true)}>
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label="Assessment Risk Level"
            value={feedback.assessmentRiskLevel}
            disabled={!isEditingFeedback}
            onChange={(value) => setFeedback((current) => ({ ...current, assessmentRiskLevel: value as FeedbackForm["assessmentRiskLevel"] }))}
            options={[
              ["low", "Low"],
              ["moderate", "Moderate"],
              ["high", "High"],
            ]}
          />
          <SliderField
            label="Agreement Level"
            value={feedback.agreementLevel}
            disabled={!isEditingFeedback}
            onChange={(value) => setFeedback((current) => ({ ...current, agreementLevel: value }))}
          />
          <SliderField
            label="Confidence Level"
            value={feedback.confidenceLevel}
            disabled={!isEditingFeedback}
            onChange={(value) => setFeedback((current) => ({ ...current, confidenceLevel: value }))}
          />
        </div>
        <div className="mt-4">
          <TextField
            label="Feedback Comment"
            value={feedback.feedbackComment}
            disabled={!isEditingFeedback}
            onChange={(value) => setFeedback((current) => ({ ...current, feedbackComment: value }))}
          />
        </div>
        {feedbackStatus ? (
          <p className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
            {feedbackStatus}
          </p>
        ) : null}
        {isEditingFeedback ? (
          <Button
            className="mt-5"
            disabled={!displayPrediction.result_id || !currentUser?.id}
            onClick={async () => {
              if (!displayPrediction.result_id || !currentUser?.id) {
                setFeedbackStatus("Sign in as a domain expert before submitting feedback.");
                return;
              }
              const response = await fetch(`${API_BASE_URL}/api/predictions/${displayPrediction.result_id}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  expert_id: currentUser.id,
                  clinician_risk_level: feedback.assessmentRiskLevel,
                  agreement_level: Number(feedback.agreementLevel),
                  is_clinically_acceptable: null,
                  confidence_level: Number(feedback.confidenceLevel),
                  feedback_comment: feedback.feedbackComment,
                  use_for_future_retraining: false,
                }),
              });
              if (response.ok) {
                setHasSavedFeedback(true);
                setIsEditingFeedback(false);
              }
              setFeedbackStatus(response.ok ? "Feedback saved for this assessment." : "Unable to save feedback.");
            }}
          >
            <ClipboardList className="h-4 w-4" />
            {hasSavedFeedback ? "Save Feedback" : "Submit Feedback"}
          </Button>
        ) : null}
      </Card>
    </div>
  );
}

function SliderField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{value}/5</span>
      </div>
      <input
        className="mt-4 w-full accent-cyan-600 disabled:opacity-50"
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="mt-1 flex justify-between text-xs font-semibold text-slate-400">
        <span>1</span>
        <span>3</span>
        <span>5</span>
      </div>
    </label>
  );
}

