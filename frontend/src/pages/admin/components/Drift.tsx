import { useState } from "react";
import { AlertTriangle, BarChart3, DatabaseZap, Layers } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../../components/ui/Badge";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { DriftResponse } from "../types";
import { useAdminData } from "../useAdminData";
import {
  EmptyChart,
  LoadState,
  MetricCard,
  MetricGrid,
  Notice,
  SubPanel,
  driftStatusMeta,
  formatDay,
  formatNumber,
  formatPercent,
} from "./Shared";

export function Drift({ days }: { days: number }) {
  const { data, error, isLoading, reload } = useAdminData<DriftResponse>(`/drift?days=${days}`);

  return (
    <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={Boolean(data)}>
      {data ? <DriftContent data={data} days={days} /> : null}
    </LoadState>
  );
}

export function DriftContent({ data, days, compact = false }: { data: DriftResponse; days: number; compact?: boolean }) {
  const drift = data.drift;
  const [selected, setSelected] = useState(drift?.features[0]?.feature ?? "");
  const feature = drift?.features.find((item) => item.feature === selected) ?? drift?.features[0];

  if (!drift) {
    return (
      <div className="space-y-6">
        <Notice>{data.message}</Notice>
        <VolumeCard volume={data.volume} days={days} animate={!compact} />
      </div>
    );
  }

  const significant = drift.features.filter((item) => item.status === "significant");
  const moderate = drift.features.filter((item) => item.status === "moderate");
  const trend = drift.trend.map((point) => ({
    day: point.day,
    records: point.records,
    psi: feature ? point.psi[feature.feature] ?? null : null,
  }));

  return (
    <div className="space-y-6">
      {drift.current_size === 0 ? (
        <Notice tone="cyan">No assessments were made in the last {days} days, so there is nothing to compare against the baseline yet.</Notice>
      ) : drift.limited_confidence ? (
        <Notice>
          Limited confidence: only {drift.current_size} assessments in this period (at least {drift.min_records} recommended). PSI
          is inflated on small samples, so treat flags as prompts to keep watching rather than evidence of drift.
        </Notice>
      ) : null}

      <MetricGrid>
        <MetricCard
          label="Average PSI"
          value={drift.overall_psi.toFixed(2)}
          detail={`Mean across ${drift.features.length} input features`}
          icon={DatabaseZap}
          tone={drift.overall_psi >= drift.thresholds.significant ? "red" : drift.overall_psi >= drift.thresholds.moderate ? "amber" : "green"}
        />
        <MetricCard
          label="Records analysed"
          value={formatNumber(drift.current_size)}
          detail={`Against ${formatNumber(drift.baseline_size)} training records`}
          icon={BarChart3}
          tone="slate"
        />
        <MetricCard
          label="Significant drift"
          value={String(significant.length)}
          detail={significant.length ? significant.map((item) => item.label).join(", ") : `No feature with PSI ≥ ${drift.thresholds.significant}`}
          icon={AlertTriangle}
          tone={significant.length ? "red" : "green"}
        />
        <MetricCard
          label="Moderate drift"
          value={String(moderate.length)}
          detail={moderate.length ? moderate.map((item) => item.label).join(", ") : `No feature with PSI ≥ ${drift.thresholds.moderate}`}
          icon={Layers}
          tone={moderate.length ? "amber" : "green"}
        />
      </MetricGrid>

      <div className={`grid gap-6 ${compact ? "" : "xl:grid-cols-[1fr_380px]"}`}>
        <Card className="p-6">
          <CardHeader
            title={feature ? `${feature.label}: baseline vs current` : "Feature distribution"}
            subtitle={
              feature
                ? `Share of records per ${feature.kind === "numeric" ? "training quintile" : "category"}. Mean ${feature.baseline_mean.toFixed(1)} in training vs ${feature.current_mean?.toFixed(1) ?? "–"} now.`
                : undefined
            }
            action={feature ? <Badge tone={driftStatusMeta[feature.status].tone}>PSI {feature.psi.toFixed(3)}</Badge> : null}
          />
          <div className="mt-6 h-[260px]">
            {feature ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feature.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="bin" stroke="#64748b" fontSize={11} interval={0} />
                  <YAxis tickFormatter={(value) => formatPercent(value, 0)} stroke="#64748b" fontSize={12} />
                  <Tooltip formatter={(value) => formatPercent(Number(value))} />
                  <Legend />
                  <Bar dataKey="baseline" name="Training baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={!compact} />
                  <Bar dataKey="current" name={`Last ${days} days`} fill="#0891b2" radius={[4, 4, 0, 0]} isAnimationActive={!compact} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No features to display." />
            )}
          </div>

          <p className="mt-6 text-sm font-bold text-slate-950">PSI trend (rolling 7-day window)</p>
          <div className="mt-3 h-[220px]">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={formatDay} stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="psi" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="records" orientation="right" allowDecimals={false} stroke="#cbd5e1" fontSize={12} />
                  <Tooltip labelFormatter={(value) => formatDay(String(value))} />
                  <Legend />
                  <Bar yAxisId="records" dataKey="records" name="Records in window" fill="#e2e8f0" isAnimationActive={!compact} />
                  <ReferenceLine yAxisId="psi" y={drift.thresholds.significant} stroke="#ef4444" strokeDasharray="4 4" />
                  <ReferenceLine yAxisId="psi" y={drift.thresholds.moderate} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Line
                    yAxisId="psi"
                    dataKey="psi"
                    name={`PSI · ${feature?.label ?? ""}`}
                    stroke="#0891b2"
                    strokeWidth={2.5}
                    connectNulls
                    isAnimationActive={!compact}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No assessments in this period." />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">Days whose 7-day window holds fewer than 30 records show volume only.</p>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="Feature Drift Register"
            subtitle={`PSI ≥ ${drift.thresholds.moderate} moderate, ≥ ${drift.thresholds.significant} significant. Select a feature to inspect.`}
          />
          <div className="mt-5 space-y-2">
            {drift.features.map((item) => {
              const status = driftStatusMeta[item.status];
              return (
                <button
                  key={item.feature}
                  type="button"
                  onClick={() => setSelected(item.feature)}
                  className={`w-full rounded-[16px] border p-3 text-left transition ${
                    feature?.feature === item.feature ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-950">{item.label}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${status.tone === "red" ? "bg-red-500" : status.tone === "amber" ? "bg-amber-500" : "bg-cyan-600"}`}
                        style={{ width: `${Math.min(item.psi / 0.5, 1) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs font-bold text-slate-500">{item.psi.toFixed(3)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        {drift.method} against the {drift.baseline}.
      </p>
    </div>
  );
}

function VolumeCard({ volume, days, animate }: { volume: DriftResponse["volume"]; days: number; animate: boolean }) {
  return (
    <Card className="p-6">
      <CardHeader title="Input Volume" subtitle={`Assessments received per day over the last ${days} days.`} />
      <div className="mt-6 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={volume}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="day" tickFormatter={formatDay} stroke="#64748b" fontSize={12} />
            <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
            <Tooltip labelFormatter={(value) => formatDay(String(value))} />
            <Bar dataKey="total" name="Assessments" fill="#0891b2" radius={[4, 4, 0, 0]} isAnimationActive={animate} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
