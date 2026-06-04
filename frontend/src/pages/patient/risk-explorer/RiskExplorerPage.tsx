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
  riskFactors: RiskFactor[];
  onStartAssessment: () => void;
};

export function RiskExplorerPage({
  currentRisk,
  currentCategory,
  hasAssessment,
  riskFactors,
  onStartAssessment,
}: RiskExplorerPageProps) {
  if (!hasAssessment) {
    return (
      <section className="grid gap-6">
        <SectionTitle
          label="Risk explanation module"
          title="Assessment needed first"
          description="The risk explanation will appear after the user completes the CVD risk assessment."
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
        label="Risk explanation module"
        title="Understand your risk result"
        description="This page explains the estimated score, category, and top contributing factors using non-technical language."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <RiskScoreCard score={currentRisk} category={currentCategory} />
        <TopRiskFactors factors={riskFactors} />
      </div>
    </section>
  );
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
