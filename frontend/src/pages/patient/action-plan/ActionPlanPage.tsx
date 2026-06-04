import { useMemo, useState } from "react";
import {
  ArrowLeft,
  HeartPulse,
  Info,
  ListChecks,
  Plus,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import {
  buildGuidedPlan,
  buildPlans,
  initialGuidedPlan,
} from "./actionPlanGenerator";
import { GuidedActionBuilder } from "./GuidedActionBuilder";
import { ActionPlanSummary as SummaryCard, PlanCard } from "./PlanCard";
import type { ActionPlanPageProps, GuidedPlanForm, PlanItem, RiskFactor } from "./types";

type ActionView = "overview" | "create";

export function ActionPlanPage({ currentCategory, riskFactors }: ActionPlanPageProps) {
  const [view, setView] = useState<ActionView>("overview");
  const [customPlans, setCustomPlans] = useState<PlanItem[]>([]);
  const [guidedForm, setGuidedForm] = useState<GuidedPlanForm>(initialGuidedPlan);

  const generatedPlans = useMemo(() => buildPlans(riskFactors), [riskFactors]);
  const guidedPlan = useMemo(() => buildGuidedPlan(guidedForm), [guidedForm]);
  const plans = useMemo(
    () => [...customPlans, ...generatedPlans],
    [customPlans, generatedPlans],
  );
  const primaryPlan = plans[0];

  const updateGuidedForm = <Key extends keyof GuidedPlanForm>(
    key: Key,
    value: GuidedPlanForm[Key],
  ) => {
    setGuidedForm((current) => ({ ...current, [key]: value }));
  };

  const addGuidedPlan = () => {
    setCustomPlans((current) => [guidedPlan, ...current]);
    setView("overview");
  };

  if (view === "create") {
    return (
      <section className="grid gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-cyan-700">Custom action</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              Create a guided action
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Use simple coaching questions to generate a realistic action, then add it to the plan list.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setView("overview")}>
            <ArrowLeft className="h-4 w-4" />
            Back to plan
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <GuidedActionBuilder
            form={guidedForm}
            generatedPlan={guidedPlan}
            updateField={updateGuidedForm}
            onAddPlan={addGuidedPlan}
          />
          <ActionPlanHelp />
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-cyan-700">Lifestyle recommendation module</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Generated action plan
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Recommendations are prioritized from the user's risk category and modifiable risk factors, then written as small, measurable actions.
          </p>
        </div>
        <Button onClick={() => setView("create")}>
          <Plus className="h-4 w-4" />
          Add custom action
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PlanMetric icon={HeartPulse} label="Risk category" value={currentCategory.label} tone={currentCategory.tone} />
        <PlanMetric icon={ListChecks} label="Total actions" value={plans.length.toString()} tone="cyan" />
        <PlanMetric icon={TrendingDown} label="Focus area" value={primaryPlan.factor} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
        <Card className="p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardHeader title="Action list" subtitle="Each action includes why, what to do next, and how to measure it." />
            <Badge tone={currentCategory.tone}>Based on {currentCategory.label}</Badge>
          </div>

          <div className="grid gap-4">
            {plans.map((plan, index) => (
              <PlanCard
                key={`${plan.title}-${index}`}
                index={index + 1}
                plan={plan}
              />
            ))}
          </div>
        </Card>

        <div className="grid gap-6">
          <ActionPlanHelp compact />
        </div>
      </div>
    </section>
  );
}

export function ActionPlanSummary({ riskFactors }: { riskFactors: RiskFactor[] }) {
  return <SummaryCard plans={buildPlans(riskFactors)} />;
}

function ActionPlanHelp({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="p-6">
      <CardHeader
        title={compact ? "How this plan is generated" : "Plan generator logic"}
        subtitle="Plain-language design for non-domain users."
      />
      <div className="mt-5 grid gap-4">
        <LogicPoint title="Prioritize" text="High-impact modifiable risk factors appear first." />
        <LogicPoint title="Make it measurable" text="Each action includes a progress measure the user can track." />
        {!compact ? (
          <LogicPoint title="Plan for barriers" text="The builder asks what might get in the way, then suggests a smaller fallback step." />
        ) : null}
      </div>
      <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-800">
        This plan supports self-management and does not replace medical advice or prescribed treatment.
      </div>
    </Card>
  );
}

function LogicPoint({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
        <Info className="h-4 w-4 text-cyan-700" />
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function PlanMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "cyan";
}) {
  const toneClass = {
    cyan: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  }[tone];

  return (
    <Card className="p-5">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      <strong className="mt-1 block text-2xl font-bold tracking-tight text-slate-950">{value}</strong>
    </Card>
  );
}
