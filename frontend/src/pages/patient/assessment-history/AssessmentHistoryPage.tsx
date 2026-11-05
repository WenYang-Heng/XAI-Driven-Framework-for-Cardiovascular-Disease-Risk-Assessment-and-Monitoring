import { ArrowRight, Eye, Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { RiskScoreCard } from "../risk-explorer/RiskScoreCard";
import { TopRiskFactors } from "../risk-explorer/TopRiskFactors";
import type { RiskCategory, RiskFactor } from "../risk-explorer/types";

type StatusTone = "green" | "amber" | "red";

export type AssessmentHistoryItem = {
  assessment_id: string;
  created_at?: string;
  assessed_at?: string;
  risk_score: number;
  risk_category: "low" | "moderate" | "high";
  confidence_level: "low" | "medium" | "high";
  prediction_method?: string;
  age?: number | null;
  sex?: number | string | null;
  height_cm?: number | null;
  weight?: number | null;
  estimated_inputs?: {
    systolic_bp?: number | null;
    total_cholesterol?: number | null;
  };
  missing_inputs?: string[];
  bp_input_type?: string;
  systolic_bp?: number | null;
  bp_category?: string | null;
  cholesterol_input_type?: string;
  total_cholesterol?: number | null;
  cholesterol_category?: string | null;
  glucose_input_type?: string | null;
  glucose?: number | null;
  glucose_category?: string | null;
  diabetes_history?: string | null;
  smoking_status?: string | null;
  activity_level?: string | null;
  alcohol_intake?: string | null;
  explanation?: PatientExplanation;
};

export type PatientExplanation =
  | string[]
  | {
      summary?: string[];
      xai?: {
        method?: string;
        top_factors?: XaiTopFactor[];
        supporting_method?: string;
        lime_top_factors?: XaiTopFactor[];
        consistency_note?: string;
        fallback_reason?: string;
        lime_fallback_reason?: string;
      };
      disclaimer?: string;
    };

export type XaiTopFactor = {
  feature: string;
  user_friendly_label: string;
  direction: "increased_risk" | "decreased_risk";
  importance: number;
  importance_percentage?: number;
  plain_language: string;
  input_value: number;
};

type AssessmentHistoryPageProps = {
  items: AssessmentHistoryItem[];
  currentRisk: number;
  currentCategory: RiskCategory;
  selectedAssessmentId?: string | null;
  hasAssessment: boolean;
  isAssessmentHistoryLoading?: boolean;
  riskFactors: RiskFactor[];
  onStartAssessment: () => void;
  onViewAssessment: (item: AssessmentHistoryItem) => void;
  onDeleteAssessment: (item: AssessmentHistoryItem) => void;
};

export function AssessmentHistoryPage({
  items,
  currentRisk,
  currentCategory,
  selectedAssessmentId,
  hasAssessment,
  isAssessmentHistoryLoading = false,
  riskFactors,
  onStartAssessment,
  onViewAssessment,
  onDeleteAssessment,
}: AssessmentHistoryPageProps) {
  const currentAssessment = items.find((item) => item.assessment_id === selectedAssessmentId) ?? items[0];
  const sortedItems = [...items].sort(
    (a, b) =>
      new Date(a.assessed_at ?? a.created_at ?? 0).getTime() -
      new Date(b.assessed_at ?? b.created_at ?? 0).getTime(),
  );
  const chartData = sortedItems.map((item, index) => ({
    label: formatShortDate(item.assessed_at ?? item.created_at),
    risk: Math.round(Number(item.risk_score ?? 0) * 1000) / 10,
    category: riskLevelLabel(item.risk_category),
    index: index + 1,
  }));

  if (isAssessmentHistoryLoading) {
    return (
      <section className="grid gap-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Risk Explorer</h2>
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-950">
                Loading your latest assessment
              </h3>
              <p className="mt-3 leading-7 text-slate-600">
                Checking your saved assessment history before showing your result.
              </p>
            </div>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Risk Explorer</h2>
        {hasAssessment && items.length > 0 ? (
          <Button onClick={onStartAssessment}>
            Retake assessment
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {!hasAssessment || items.length === 0 ? (
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-950">No saved assessments yet</h3>
              <p className="mt-2 leading-7 text-slate-600">
                Complete the guided assessment to save your first result.
              </p>
            </div>
            <Button onClick={onStartAssessment}>
              Start assessment
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <RiskScoreCard
              score={currentRisk}
              category={currentCategory}
              lastAssessedAt={currentAssessment?.assessed_at ?? currentAssessment?.created_at}
            />
            <TopRiskFactors factors={riskFactors} />
          </div>

          <Card className="p-6">
            <CardHeader
              title="Risk score trend"
              subtitle="Track how the estimated risk percentage changes across saved assessments."
            />
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 18, top: 12, bottom: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value, name, props) =>
                      name === "risk"
                        ? [`${value}%`, props.payload.category]
                        : [value, name]
                    }
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload ? `Assessment ${payload[0].payload.index}` : "Assessment"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="#0891b2"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <CardHeader title="Assessment records" subtitle="Compare saved patient assessment results." />
            <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200">
              <table className="w-full min-w-[760px] border-collapse bg-white text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-bold">Date</th>
                    <th className="px-5 py-4 font-bold">Time</th>
                    <th className="px-5 py-4 font-bold">Risk Score</th>
                    <th className="px-5 py-4 font-bold">Risk Category</th>
                    <th className="px-5 py-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...items].map((item) => (
                    <tr key={item.assessment_id} className="align-middle hover:bg-slate-50/70">
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(item.assessed_at ?? item.created_at)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatTime(item.assessed_at ?? item.created_at)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        {Math.round(Number(item.risk_score ?? 0) * 1000) / 10}%
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={riskTone(item.risk_category)}>{riskLevelLabel(item.risk_category)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <AssessmentRecordActionButton
                            tone="view"
                            label="View"
                            onClick={() => onViewAssessment(item)}
                          />
                          <AssessmentRecordActionButton
                            tone="delete"
                            label="Delete"
                            onClick={() => onDeleteAssessment(item)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}

function riskTone(level?: string): StatusTone {
  if (level === "high") {
    return "red";
  }
  if (level === "moderate") {
    return "amber";
  }
  return "green";
}

function riskLevelLabel(level?: string) {
  if (!level) {
    return "Pending";
  }
  return `${level.charAt(0).toUpperCase()}${level.slice(1)} Risk`;
}

function formatDate(value?: string) {
  if (!value) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatTime(value?: string) {
  if (!value) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value?: string) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function AssessmentRecordActionButton({
  tone,
  label,
  onClick,
}: {
  tone: "view" | "delete";
  label: string;
  onClick: () => void;
}) {
  const Icon = tone === "view" ? Eye : Trash2;
  const toneClassName =
    tone === "view"
      ? "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100"
      : "border-red-100 bg-red-50 text-red-700 hover:border-red-200 hover:bg-red-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${toneClassName}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
