import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { RiskFactor } from "./types";

type TopRiskFactorsProps = {
  compact?: boolean;
  factors: RiskFactor[];
};

export function TopRiskFactors({ compact = false, factors }: TopRiskFactorsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const visibleFactors = factors.slice(0, 2);
  const hasMoreFactors = factors.length > visibleFactors.length;

  return (
    <>
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <CardHeader title="Top contributing factors" />
          {hasMoreFactors ? (
            <Button variant="ghost" onClick={() => setIsModalOpen(true)}>
              View more
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4">
          {visibleFactors.map((factor) => (
            <RiskFactorCard key={factor.name} factor={factor} compact={compact} />
          ))}
        </div>
      </Card>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="relative max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl md:p-8">
            <button
              type="button"
              aria-label="Close top factors"
              title="Close top factors"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-12">
              <CardHeader title="Top contributing factors" />
            </div>

            <div className="mt-6 grid gap-4">
              {factors.map((factor) => (
                <RiskFactorCard key={factor.name} factor={factor} compact={false} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function RiskFactorCard({ factor, compact }: { factor: RiskFactor; compact: boolean }) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold tracking-tight text-slate-900">{factor.name}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={factor.type === "Modifiable" ? "green" : "slate"}>{factor.type}</Badge>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        {compact ? `${factor.description.slice(0, 92)}...` : factor.description}
      </p>
      {!compact ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <strong className="text-slate-900">Suggested action:</strong> {factor.action}
        </div>
      ) : null}
    </article>
  );
}
