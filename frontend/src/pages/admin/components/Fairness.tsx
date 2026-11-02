import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../../components/ui/Badge";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { FairnessAttribute, FairnessGroup, FairnessResponse, ModelName, Tone } from "../types";
import { useAdminData } from "../useAdminData";
import {
  LoadState,
  MODEL_OPTIONS,
  Notice,
  SubPanel,
  fairnessStatusMeta,
  formatGap,
  formatPercent,
  modelLabel,
} from "./Shared";

export function Fairness({ days }: { days: number }) {
  const [model, setModel] = useState<ModelName>("xgboost");
  const { data, error, isLoading, reload } = useAdminData<FairnessResponse>(`/fairness?model_name=${model}&days=${days}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-slate-500">Model</span>
        <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
          {MODEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setModel(option.value)}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                model === option.value ? "bg-cyan-50 text-cyan-700" : "text-slate-500 hover:text-slate-950"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {isLoading && data ? <span className="text-xs font-semibold text-slate-400">Updating...</span> : null}
      </div>
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={Boolean(data)}>
        {data ? <FairnessContent data={data} days={days} /> : null}
      </LoadState>
    </div>
  );
}

export function FairnessContent({
  data,
  days,
  compact = false,
}: {
  data: FairnessResponse;
  days: number;
  compact?: boolean;
}) {
  const attributes = data.evaluation?.attributes ?? [];
  const [selected, setSelected] = useState(attributes[0]?.attribute ?? "sex");
  const attribute = attributes.find((item) => item.attribute === selected) ?? attributes[0];
  const flagged = attributes.filter((item) => item.status !== "within_limit").length;

  return (
    <div className="space-y-6">
      {!data.fairness_available ? <Notice>{data.message}</Notice> : null}

      {data.evaluation ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {attributes.map((item) => (
              <AttributeCard
                key={item.attribute}
                attribute={item}
                selected={!compact && item.attribute === attribute?.attribute}
                onSelect={() => setSelected(item.attribute)}
              />
            ))}
          </div>

          {(compact ? attributes : attribute ? [attribute] : []).map((item) => (
            <AttributeDetail
              key={item.attribute}
              attribute={item}
              evaluation={data.evaluation!}
              flagged={flagged}
              compact={compact}
            />
          ))}
        </>
      ) : null}

      <LiveParity rows={data.live_parity} days={days} />
    </div>
  );
}

function AttributeCard({
  attribute,
  selected,
  onSelect,
}: {
  attribute: FairnessAttribute;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = fairnessStatusMeta[attribute.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[22px] border bg-white p-5 text-left shadow-soft transition ${
        selected ? "border-cyan-300 ring-4 ring-cyan-100" : "border-slate-200/75 hover:border-cyan-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-slate-950">{attribute.label}</p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Equal opportunity diff.</p>
          <p className="mt-1 font-bold text-slate-950">{formatGap(attribute.equal_opportunity_difference)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Demographic parity diff.</p>
          <p className="mt-1 font-bold text-slate-950">{formatGap(attribute.demographic_parity_difference)}</p>
        </div>
      </div>
    </button>
  );
}

function AttributeDetail({
  attribute,
  evaluation,
  flagged,
  compact,
}: {
  attribute: FairnessAttribute;
  evaluation: NonNullable<FairnessResponse["evaluation"]>;
  flagged: number;
  compact: boolean;
}) {
  const limited = attribute.groups.filter((group) => group.limited_confidence);
  const chart = attribute.groups.map((group) => ({
    group: group.group,
    tpr: Math.round((group.true_positive_rate ?? 0) * 1000) / 10,
    fpr: Math.round((group.false_positive_rate ?? 0) * 1000) / 10,
  }));

  return (
    <Card className="p-6">
      <CardHeader
        title={`Cohort Fairness Review: ${attribute.label}`}
        subtitle={`${modelLabel(evaluation.model_name)} · ${evaluation.evaluation_method} on ${evaluation.sample_size} labelled patients. Gaps are measured against the reference group (${attribute.reference_group}).`}
        action={<Badge tone={flagged ? "amber" : "green"}>{flagged} attribute{flagged === 1 ? "" : "s"} flagged</Badge>}
      />

      {limited.length ? (
        <div className="mt-4">
          <Notice>
            Limited confidence: {limited.map((group) => `${group.group} (n=${group.sample_size})`).join(", ")}{" "}
            {limited.length === 1 ? "has" : "have"} fewer than {evaluation.min_group_size} patients, so{" "}
            {limited.length === 1 ? "its" : "their"} rates are shown but excluded from the status.
          </Notice>
        </div>
      ) : null}

      <div className={`mt-6 grid gap-6 ${compact ? "" : "2xl:grid-cols-[1.4fr_0.6fr]"}`}>
        <div className="overflow-x-auto rounded-[20px] border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <tr>
                {["Cohort", "n", "Prevalence", "Flagged high", "TPR", "FPR", "TPR gap", "FPR gap", "Status"].map((heading) => (
                  <th key={heading} className="px-3 py-3">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attribute.groups.map((group) => {
                const status = groupStatus(group, evaluation.thresholds);
                return (
                  <tr key={group.group} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-950">{group.group}</td>
                    <td className="px-3 py-3 text-slate-500">{group.sample_size}</td>
                    <td className="px-3 py-3 text-slate-600">{formatPercent(group.prevalence)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatPercent(group.selection_rate)}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{formatPercent(group.true_positive_rate)}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{formatPercent(group.false_positive_rate)}</td>
                    <td className="px-3 py-3 text-slate-500">{group.is_reference ? "Reference" : formatGap(group.tpr_gap)}</td>
                    <td className="px-3 py-3 text-slate-500">{group.is_reference ? "Reference" : formatGap(group.fpr_gap)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SubPanel title="True vs false positive rate" subtitle="Equalised odds: bars should be similar across cohorts">
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="group" stroke="#64748b" fontSize={11} interval={0} />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="tpr" name="TPR (sensitivity)" fill="#0891b2" radius={[4, 4, 0, 0]} isAnimationActive={!compact} />
                <Bar dataKey="fpr" name="FPR" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={!compact} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SubPanel>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-400">
        Status uses the larger of the TPR and FPR gaps: Watch at {Math.round(evaluation.thresholds.watch_gap * 100)} pp,
        Investigate at {Math.round(evaluation.thresholds.investigate_gap * 100)} pp. "Flagged high" (demographic parity) is shown for
        context only, because true disease prevalence differs between cohorts.
      </p>
    </Card>
  );
}

function groupStatus(
  group: FairnessGroup,
  thresholds: { watch_gap: number; investigate_gap: number },
): { label: string; tone: Tone } {
  if (group.is_reference) {
    return { label: "Reference", tone: "cyan" };
  }
  if (group.limited_confidence) {
    return { label: "Low sample", tone: "slate" };
  }
  const gap = Math.max(Math.abs(group.tpr_gap ?? 0), Math.abs(group.fpr_gap ?? 0));
  if (gap >= thresholds.investigate_gap) {
    return fairnessStatusMeta.investigate;
  }
  return gap >= thresholds.watch_gap ? fairnessStatusMeta.watch : fairnessStatusMeta.within_limit;
}

function LiveParity({ rows, days }: { rows: FairnessResponse["live_parity"]; days: number }) {
  const labels: Record<string, string> = { sex: "Sex", age_group: "Age group", fasting_blood_sugar: "Fasting blood sugar" };
  const total = rows.filter((row) => row.attribute === "sex").reduce((sum, row) => sum + row.assessments, 0);

  return (
    <Card className="p-6">
      <CardHeader
        title="Live Prediction Parity"
        subtitle={`Share of real assessments from the last ${days} days that the model placed in the high-risk category, by cohort. No ground truth is available for live data, so this monitors outcome rates only.`}
        action={<Badge tone="slate">{total} assessments</Badge>}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Object.entries(labels).map(([attribute, label]) => (
          <SubPanel key={attribute} title={label}>
            <div className="mt-3 space-y-3">
              {rows
                .filter((row) => row.attribute === attribute)
                .map((row) => (
                  <div key={row.group}>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-slate-400">
                      <span>
                        {row.group} · n={row.assessments}
                      </span>
                      <span>{formatPercent(row.high_risk_rate, 0)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${(row.high_risk_rate ?? 0) * 100}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </SubPanel>
        ))}
      </div>
    </Card>
  );
}
