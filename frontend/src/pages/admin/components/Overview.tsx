import { Activity, AlertTriangle, MessageSquareText, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../../components/ui/Badge";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { OverviewResponse } from "../types";
import { useAdminData } from "../useAdminData";
import {
  EmptyChart,
  LoadState,
  MODEL_COLORS,
  MetricCard,
  MetricGrid,
  RISK_COLORS,
  formatDay,
  formatNumber,
  formatPercent,
  modelLabel,
} from "./Shared";

export function Overview({ days }: { days: number }) {
  const { data, error, isLoading, reload } = useAdminData<OverviewResponse>(`/overview?days=${days}`);

  return (
    <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={Boolean(data)}>
      {data ? <OverviewContent data={data} /> : null}
    </LoadState>
  );
}

export function OverviewContent({ data, compact = false }: { data: OverviewResponse; compact?: boolean }) {
  const { totals } = data;
  const highRiskShare = totals.assessments ? totals.high_risk / totals.assessments : null;
  const dailyAverage = totals.assessments / Math.max(data.days, 1);

  return (
    <div className="space-y-6">
      <MetricGrid>
        <MetricCard
          label="Assessments"
          value={formatNumber(totals.assessments)}
          detail={`${dailyAverage.toFixed(1)} per day on average · ${formatNumber(totals.all_time_assessments)} all time`}
          icon={Activity}
          tone="cyan"
        />
        <MetricCard
          label="High-risk results"
          value={formatNumber(totals.high_risk)}
          detail={`${formatPercent(highRiskShare)} of assessments in this period`}
          icon={AlertTriangle}
          tone={totals.high_risk ? "red" : "green"}
        />
        <MetricCard
          label="Active users"
          value={formatNumber(totals.active_users)}
          detail={`${formatNumber(totals.registered_users)} registered accounts`}
          icon={Users}
          tone="purple"
        />
        <MetricCard
          label="Expert feedback"
          value={formatNumber(totals.feedback)}
          detail={`${formatNumber(totals.batch_uploads)} batch uploads · ${formatNumber(totals.failed_batch_rows)} failed rows`}
          icon={MessageSquareText}
          tone="slate"
        />
      </MetricGrid>

      <div className={`grid gap-6 ${compact ? "" : "xl:grid-cols-[1.4fr_0.6fr]"}`}>
        <Card className="p-6">
          <CardHeader
            title="Daily Usage Trend"
            subtitle="Assessments per day, stacked by predicted risk category."
            action={<Badge tone="cyan">{data.days} days</Badge>}
          />
          <div className="mt-6 h-[300px]">
            {totals.assessments ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={formatDay} stroke="#64748b" fontSize={12} minTickGap={16} />
                  <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                  <Tooltip labelFormatter={(value) => formatDay(String(value))} />
                  <Legend />
                  <Bar dataKey="low" name="Low" stackId="risk" fill={RISK_COLORS.low} isAnimationActive={!compact} />
                  <Bar dataKey="moderate" name="Moderate" stackId="risk" fill={RISK_COLORS.moderate} isAnimationActive={!compact} />
                  <Bar dataKey="high" name="High" stackId="risk" fill={RISK_COLORS.high} radius={[4, 4, 0, 0]} isAnimationActive={!compact} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No assessments were made in this period." />
            )}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title="Risk Category Distribution" subtitle="Share of results per category." />
          <div className="mt-4 h-[220px]">
            {totals.assessments ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.risk_distribution}
                    dataKey="count"
                    nameKey="risk_level"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    isAnimationActive={!compact}
                  >
                    {data.risk_distribution.map((entry) => (
                      <Cell key={entry.risk_level} fill={RISK_COLORS[entry.risk_level]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No results yet." />
            )}
          </div>
          <div className="mt-4 space-y-2">
            {data.risk_distribution.map((entry) => (
              <div key={entry.risk_level} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold capitalize text-slate-700">
                  <span className="h-3 w-3 rounded-full" style={{ background: RISK_COLORS[entry.risk_level] }} />
                  {entry.risk_level}
                </span>
                <span className="text-slate-500">
                  {formatNumber(entry.count)} ({formatPercent(totals.assessments ? entry.count / totals.assessments : null, 0)})
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader
          title="Model Usage"
          subtitle={`Assessments per prediction model · ${formatNumber(totals.single_assessments)} single, ${formatNumber(totals.batch_assessments)} from batch uploads.`}
        />
        <div className="mt-6 space-y-3">
          {data.model_usage.length ? (
            data.model_usage.map((row) => (
              <div key={row.model_name} className="grid grid-cols-[160px_1fr_60px] items-center gap-4 text-sm">
                <span className="font-semibold text-slate-700">{modelLabel(row.model_name)}</span>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.count / totals.assessments) * 100}%`,
                      background: MODEL_COLORS[row.model_name] ?? "#64748b",
                    }}
                  />
                </div>
                <span className="text-right font-bold text-slate-950">{formatNumber(row.count)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-slate-400">No model usage in this period.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
