import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { RiskFactor } from "./types";

type TopRiskFactorsProps = {
  compact?: boolean;
  factors: RiskFactor[];
};

export function TopRiskFactors({ compact = false, factors }: TopRiskFactorsProps) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <CardHeader title="Top contributing factors" subtitle="XAI explanation" />
        {compact ? <Button variant="ghost">Details</Button> : null}
      </div>

      <div className="grid gap-4">
        {factors.map((factor) => (
          <article key={factor.name} className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold tracking-tight text-slate-900">{factor.name}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {factor.impact}
                </p>
              </div>
              <Badge tone={factor.type === "Modifiable" ? "green" : "slate"}>{factor.type}</Badge>
            </div>
            <p className="mt-3 leading-7 text-slate-600">
              {compact ? `${factor.description.slice(0, 92)}...` : factor.description}
            </p>
            {!compact ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <strong className="text-slate-900">Suggested action:</strong> {factor.action}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Card>
  );
}
