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
  prediction_method?: string;
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
  explanation?: string[];
};

type AssessmentHistoryPageProps = {
  items: AssessmentHistoryItem[];
  onStartAssessment: () => void;
};

export function AssessmentHistoryPage({ items, onStartAssessment }: AssessmentHistoryPageProps) {
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

  return (
    <section className="grid gap-6">
      <SectionTitle
        label="Assessment history"
        title="Previous patient risk estimates"
        description="Saved assessments are shown as a risk-score trend and a detailed table for comparison."
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
              <table className="w-full min-w-[900px] border-collapse bg-white text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-bold">Date</th>
                    <th className="px-5 py-4 font-bold">Risk Score</th>
                    <th className="px-5 py-4 font-bold">Risk Category</th>
                    <th className="px-5 py-4 font-bold">Confidence</th>
                    <th className="px-5 py-4 font-bold">Method</th>
                    <th className="px-5 py-4 font-bold">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...items].map((item) => (
                    <tr key={item.assessment_id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(item.assessed_at ?? item.created_at)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        {Math.round(Number(item.risk_score ?? 0) * 1000) / 10}%
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={riskTone(item.risk_category)}>{riskLevelLabel(item.risk_category)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={confidenceTone(item.confidence_level)}>{labelize(item.confidence_level)}</Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {methodLabel(item.prediction_method)}
                      </td>
                      <td className="max-w-lg px-5 py-4 leading-6 text-slate-600">
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

function formatDate(value?: string) {
  if (!value) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
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

function methodLabel(value?: string) {
  if (!value) {
    return "Patient screening";
  }
  if (value.includes("simulation")) {
    return "Lifestyle simulation";
  }
  return "Patient screening";
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
