import { useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FeatureContribution, GlobalShapExplanation, XaiExplanation } from '../types';
import { xaiTabs, type XaiTab } from '../constants';
import { displayContributions, percent, sortedByMagnitude } from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardHeader } from '../../../components/ui/Card';

type DisplayContribution = FeatureContribution & { featureLabel: string };
type DirectionLabel = "Increases Risk" | "Reduces Risk";
type AgreementLevel = "High" | "Moderate" | "Low" | "Unavailable";
type AgreementStatus = "Match" | "Conflict" | "Missing";

/** Full SHAP / LIME detail for one assessment, shown under "Technical details" on the Clinical Review. */
export function TechnicalXai({
  xai,
  riskScore,
  patientFeatureValues,
}: {
  xai: XaiExplanation;
  riskScore: number;
  patientFeatureValues: Record<string, string>;
}) {
  const [tab, setTab] = useState<XaiTab>("shap");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {xaiTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-10 rounded-2xl px-4 text-sm font-semibold transition ${
              tab === item.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "shap" ? (
        <ContributionPanel
          method="SHAP"
          rows={displayContributions(sortedByMagnitude(xai.shap.contributions))}
          patientFeatureValues={patientFeatureValues}
          note={`SHAP starts from the average risk (${percent(xai.shap.base_value)}) and shows how each value moved this patient to ${percent(riskScore)}.`}
        />
      ) : null}
      {tab === "lime" ? (
        <ContributionPanel
          method="LIME"
          rows={displayContributions(sortedByMagnitude(xai.lime.contributions))}
          patientFeatureValues={patientFeatureValues}
          note="LIME fits a simple local model around this patient. Use it as a cross-check on SHAP rather than on its own."
        />
      ) : null}
      {tab === "comparison" ? <ComparisonPanel xai={xai} /> : null}
    </div>
  );
}

function ContributionPanel({
  method,
  rows,
  patientFeatureValues,
  note,
}: {
  method: "SHAP" | "LIME";
  rows: DisplayContribution[];
  patientFeatureValues: Record<string, string>;
  note: string;
}) {
  if (!rows.length) {
    return <MethodEmptyState title={`No ${method} values`} description={`${method} values were not returned for this assessment.`} />;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-[18px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">{note}</p>
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 28 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="featureLabel" type="category" width={170} interval={0} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => [signed(Number(value)), directionLabel(Number(value))]} />
            <Bar dataKey="value" radius={[8, 8, 8, 8]}>
              {rows.map((entry) => (
                <Cell key={entry.feature} fill={entry.value >= 0 ? "#f97316" : "#10b981"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-[18px] border border-slate-200">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">Feature</th>
              <th className="px-4 py-3 font-bold">Patient value</th>
              <th className="px-4 py-3 font-bold">Direction</th>
              <th className="px-4 py-3 font-bold">{method === "SHAP" ? "SHAP value" : "LIME weight"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.feature}>
                <td className="px-4 py-3 font-semibold text-slate-800">{row.featureLabel}</td>
                <td className="px-4 py-3 text-slate-600">{patientFeatureValues[row.feature] ?? "–"}</td>
                <td className="px-4 py-3"><DirectionBadge direction={directionLabel(row.value)} /></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{signed(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonPanel({ xai }: { xai: XaiExplanation }) {
  const rows = deriveComparisonRows(xai);
  const agreement = deriveAgreement(xai);

  if (agreement.level === "Unavailable") {
    return <MethodEmptyState title="Cannot compare SHAP and LIME" description="One of the two explanations is missing." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryPill label="Agreement" value={agreement.level} />
        <SummaryPill label="Same direction" value={`${agreement.matchCount} of ${rows.length} features`} />
        <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Low agreement means the two methods tell different stories. Treat the drivers with caution.
        </div>
      </div>
      <div className="overflow-x-auto rounded-[18px] border border-slate-200">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">Feature</th>
              <th className="px-4 py-3 font-bold">SHAP</th>
              <th className="px-4 py-3 font-bold">LIME</th>
              <th className="px-4 py-3 font-bold">Agreement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.feature}>
                <td className="px-4 py-3 font-semibold text-slate-800">{row.featureLabel}</td>
                <td className="px-4 py-3">{row.shapDirection ? <DirectionBadge direction={row.shapDirection} /> : "–"}</td>
                <td className="px-4 py-3">{row.limeDirection ? <DirectionBadge direction={row.limeDirection} /> : "–"}</td>
                <td className="px-4 py-3"><AgreementBadge status={row.agreement} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Dataset-level feature importance for the default model (Model & Evidence page). */
export function GlobalShapPanel({
  globalShap,
  isLoading,
}: {
  globalShap: GlobalShapExplanation | null;
  isLoading: boolean;
}) {
  const rows = [...(globalShap?.feature_importance ?? [])]
    .map((row) => ({ ...row, display_name: row.display_name || row.feature, mean_abs_shap: Number(row.mean_abs_shap) }))
    .filter((row) => Number.isFinite(row.mean_abs_shap))
    .sort((a, b) => a.rank - b.rank);

  return (
    <Card className="p-6">
      <CardHeader
        title="What drives the model overall"
        subtitle="Average impact of each input across the dataset (mean |SHAP|). This is model behaviour, not one patient."
        action={globalShap ? <Badge tone="green">{globalShap.samples_explained ?? "–"} samples</Badge> : null}
      />
      {globalShap?.summary_text ? (
        <div className="mt-5 flex gap-3 rounded-[18px] border border-cyan-100 bg-cyan-50 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
          <p className="text-sm leading-6 text-cyan-950">{globalShap.summary_text}</p>
        </div>
      ) : null}
      {rows.length ? (
        <div className="mt-5 h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 28 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="display_name" type="category" width={170} interval={0} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [Number(value).toFixed(4), "Mean |SHAP|"]} />
              <Bar dataKey="mean_abs_shap" radius={[7, 7, 7, 7]}>
                {rows.map((entry) => (
                  <Cell key={entry.feature} fill={entry.rank <= 3 ? "#0e7490" : "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {isLoading
            ? "Loading global feature importance…"
            : "No global SHAP explanation has been generated for this model yet. Run server-ml/scripts/save_global_shap.py to create it."}
        </p>
      )}
    </Card>
  );
}

function MethodEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-4 rounded-[18px] border border-amber-100 bg-amber-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div>
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
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

function DirectionBadge({ direction }: { direction: DirectionLabel }) {
  return (
    <Badge tone={direction === "Increases Risk" ? "amber" : "green"}>
      {direction === "Increases Risk" ? <ArrowUp className="mr-1 h-3 w-3" /> : <ArrowDown className="mr-1 h-3 w-3" />}
      {direction}
    </Badge>
  );
}

function AgreementBadge({ status }: { status: AgreementStatus }) {
  const tone = status === "Match" ? "green" : status === "Conflict" ? "red" : "slate";
  return <Badge tone={tone}>{status}</Badge>;
}

export function deriveAgreement(xai: XaiExplanation): { level: AgreementLevel; matchCount: number } {
  const rows = deriveComparisonRows(xai);
  const comparable = rows.filter((row) => row.shapDirection && row.limeDirection).length;
  if (!comparable) {
    return { level: "Unavailable", matchCount: 0 };
  }
  const matchCount = rows.filter((row) => row.agreement === "Match").length;
  const ratio = matchCount / comparable;
  return { level: ratio >= 0.75 ? "High" : ratio >= 0.4 ? "Moderate" : "Low", matchCount };
}

function deriveComparisonRows(xai: XaiExplanation) {
  const shap = new Map(displayContributions(xai.shap.contributions).map((row) => [row.feature, row]));
  const lime = new Map(displayContributions(xai.lime.contributions).map((row) => [row.feature, row]));
  const features = sortedByMagnitude(xai.shap.contributions).map((row) => row.feature);
  lime.forEach((_, feature) => {
    if (!features.includes(feature)) {
      features.push(feature);
    }
  });

  return features.map((feature) => {
    const shapRow = shap.get(feature);
    const limeRow = lime.get(feature);
    const shapDirection = shapRow ? directionLabel(shapRow.value) : null;
    const limeDirection = limeRow ? directionLabel(limeRow.value) : null;
    const agreement: AgreementStatus = !shapRow || !limeRow ? "Missing" : shapDirection === limeDirection ? "Match" : "Conflict";
    return {
      feature,
      featureLabel: shapRow?.featureLabel ?? limeRow?.featureLabel ?? feature,
      shapDirection,
      limeDirection,
      agreement,
    };
  });
}

function directionLabel(value: number): DirectionLabel {
  return value >= 0 ? "Increases Risk" : "Reduces Risk";
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(4)}`;
}
