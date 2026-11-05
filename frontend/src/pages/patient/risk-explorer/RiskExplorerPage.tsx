import { ArrowRight } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { RiskScoreCard } from "./RiskScoreCard";
import { TopRiskFactors } from "./TopRiskFactors";
import type { RiskCategory, RiskFactor } from "./types";

type RiskExplorerPageProps = {
  currentRisk: number;
  currentCategory: RiskCategory;
  hasAssessment: boolean;
  isAssessmentHistoryLoading?: boolean;
  riskFactors: RiskFactor[];
  onStartAssessment: () => void;
};

export function RiskExplorerPage({
  currentRisk,
  currentCategory,
  hasAssessment,
  isAssessmentHistoryLoading = false,
  riskFactors,
  onStartAssessment,
}: RiskExplorerPageProps) {
  if (isAssessmentHistoryLoading) {
    return (
      <section className="grid gap-6">
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-cyan-700">Risk explanation module</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                Loading your latest assessment
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                Checking your saved assessment history before showing your risk explanation.
              </p>
            </div>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
          </div>
        </Card>
      </section>
    );
  }

  if (!hasAssessment) {
    return (
      <section className="grid gap-6">
        <SectionTitle
          title="Risk Explorer"
        />
        <Card className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">No risk result yet</h3>
            <p className="mt-2 leading-7 text-slate-600">
              Complete the guided intake so the platform can estimate risk and explain the top contributing factors in simple language.
            </p>
          </div>
          <Button onClick={onStartAssessment}>
            Start assessment
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <SectionTitle
        title="Risk Explorer"
      />

      <div className="grid gap-6">
        <RiskScoreCard score={currentRisk} category={currentCategory} />
        <TopRiskFactors factors={riskFactors} />
      </div>
    </section>
  );
}

function SectionTitle({
  title,
}: {
  title: string;
}) {
  return (
    <div className="max-w-3xl">
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
    </div>
  );
}
