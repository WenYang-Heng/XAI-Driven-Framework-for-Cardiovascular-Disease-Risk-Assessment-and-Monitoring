import { ArrowRight } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";

type StatusTone = "green" | "amber" | "red";

export type AssessmentHistoryItem = {
  assessment_id: string;
  created_at?: string;
  assessed_at?: string;
  risk_score: number;
  risk_category: "low" | "moderate" | "high";
  confidence_level: "low" | "medium" | "high";
  bp_input_type?: string;
  systolic_bp?: number | null;
  bp_category?: string | null;
  cholesterol_input_type?: string;
  total_cholesterol?: number | null;
  cholesterol_category?: string | null;
  explanation?: string[];
};

type AssessmentHistoryPageProps = {
  items: AssessmentHistoryItem[];
  onStartAssessment: () => void;
};

const confidenceScores = {
  low: 1,
  medium: 2,
  high: 3,
};

export function AssessmentHistoryPage({ items, onStartAssessment }: AssessmentHistoryPageProps) {
  const sortedItems = [...items].sort(
    (a, b) =>
      new Date(a.assessed_at ?? a.created_at ?? 0).getTime() -
      new Date(b.assessed_at ?? b.created_at ?? 0).getTime(),
  );
  const chartData = sortedItems.map((item, index) => ({
    label: formatShortDate(item.assessed_at ?? item.created_at),
    confidence: confidenceScores[item.confidence_level],
    confidenceLabel: labelize(item.confidence_level),
    risk: Math.round(Number(item.risk_score ?? 0) * 1000) / 10,
    index: index + 1,
  }));

  return (
    <section className="grid gap-6">
      <SectionTitle
        label="Assessment history"
        title="Previous patient risk estimates"
        description="Saved assessments are shown as a confidence trend and a detailed table for comparison."
      />

      {items.length === 0 ? (
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
          <Card className="p-6">
            <CardHeader
              title="Confidence trend"
              subtitle="Higher values mean the assessment had more exact or complete inputs."
            />
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 18, top: 12, bottom: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis
                    domain={[1, 3]}
                    ticks={[1, 2, 3]}
                    tickFormatter={confidenceTick}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    width={76}
                  />
                  <Tooltip
                    formatter={(value, name, props) =>
                      name === "confidence"
                        ? [props.payload.confidenceLabel, "Confidence"]
                        : [value, name]
                    }
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload ? `Assessment ${payload[0].payload.index}` : "Assessment"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="confidence"
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
            <CardHeader title="Assessment records" subtitle="Compare risk, confidence, and the values used." />
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">Date</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">Risk</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">Confidence</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">Blood pressure</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">Cholesterol</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {[...items].map((item) => (
                    <tr key={item.assessment_id} className="align-top">
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                        {formatDateTime(item.assessed_at ?? item.created_at)}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <div className="grid gap-2">
                          <strong className="text-slate-950">
                            {Math.round(Number(item.risk_score ?? 0) * 1000) / 10}%
                          </strong>
                          <Badge tone={riskTone(item.risk_category)}>{riskLevelLabel(item.risk_category)}</Badge>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <Badge tone={confidenceTone(item.confidence_level)}>
                          {labelize(item.confidence_level)}
                        </Badge>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                        {historyInputLabel(item.bp_input_type, item.systolic_bp, item.bp_category, "mmHg")}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                        {historyInputLabel(
                          item.cholesterol_input_type,
                          item.total_cholesterol,
                          item.cholesterol_category,
                          "mg/dL",
                        )}
                      </td>
                      <td className="max-w-md border-b border-slate-100 px-4 py-4 leading-6 text-slate-600">
                        {item.explanation?.[0] ?? "No explanation saved."}
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

function confidenceTick(value: number) {
  return value === 3 ? "High" : value === 2 ? "Medium" : "Low";
}

function confidenceTone(level: string): "green" | "amber" | "red" {
  if (level === "high") {
    return "green";
  }
  if (level === "medium") {
    return "amber";
  }
  return "red";
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

function labelize(value: string) {
  return value
    .split("_")
    .join(" ")
    .split("-")
    .join(" ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
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

function historyInputLabel(inputType?: string, exactValue?: number | null, category?: string | null, unit?: string) {
  if (inputType === "exact" && exactValue != null) {
    return `${exactValue} ${unit ?? ""}`.trim();
  }
  if (inputType === "category" && category) {
    return labelize(category);
  }
  return "Not sure";
}

function SectionTitle({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-cyan-700">{label}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}
