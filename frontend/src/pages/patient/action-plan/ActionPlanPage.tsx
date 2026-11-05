import { useEffect, useMemo, useState } from "react";
import {
  HeartPulse,
  ListChecks,
  Loader2,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { fetchActionPlan, generateActionPlan } from "./actionPlanApi";
import { buildPlans } from "./actionPlanGenerator";
import { ActionPlanSummary as SummaryCard, ActionPlanTable } from "./PlanCard";
import type { ActionPlanPageProps, GeneratedActionPlan, PlanItem, RiskFactor } from "./types";

export function ActionPlanPage({ currentCategory, riskFactors, userId, assessmentId }: ActionPlanPageProps) {
  const [generatedActionPlan, setGeneratedActionPlan] = useState<GeneratedActionPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const plans = useMemo(
    () => generatedActionPlan?.items ?? [],
    [generatedActionPlan],
  );
  const primaryPlan = plans[0] ?? null;

  useEffect(() => {
    if (!userId || !assessmentId) {
      setGeneratedActionPlan(null);
      return;
    }

    let active = true;
    setIsLoadingPlan(true);
    setGenerationError(null);

    fetchActionPlan({ assessmentId, userId })
      .then((data) => {
        if (!active) {
          return;
        }
        setGeneratedActionPlan(data?.action_plan ? mapGeneratedActionPlan(data.action_plan) : null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setGenerationError(error instanceof Error ? error.message : "Unable to load action plan.");
      })
      .finally(() => {
        if (active) {
          setIsLoadingPlan(false);
        }
      });

    return () => {
      active = false;
    };
  }, [assessmentId, userId]);

  async function handleGenerateActionPlan() {
    if (!userId || !assessmentId) {
      setGenerationError("Complete and save an assessment before generating an action plan.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    try {
      const data = await generateActionPlan({ assessmentId, userId, regenerate: false });
      setGeneratedActionPlan(mapGeneratedActionPlan(data.action_plan));
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Unable to generate action plan.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <PlanMetric icon={HeartPulse} label="Risk category" value={currentCategory.label} tone={currentCategory.tone} />
        <PlanMetric icon={ListChecks} label="Total actions" value={plans.length.toString()} tone="cyan" />
        <PlanMetric icon={TrendingDown} label="Focus area" value={primaryPlan?.factor ?? "Pending"} tone="green" />
      </div>

      <Card className="p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <CardHeader title="Action list" subtitle="Each action includes why, what to do next, and how to measure it." />
          <Button disabled={isGenerating || isLoadingPlan || !assessmentId} onClick={handleGenerateActionPlan}>
            {isGenerating ? "Generating..." : "Generate action plan"}
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </Button>
        </div>

        {generationError ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {generationError}
          </div>
        ) : null}

        {generatedActionPlan ? (
          <div className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-800">
            <strong className="text-cyan-950">Plan summary</strong>
            <span className="mt-1 block">{generatedActionPlan.summary}</span>
          </div>
        ) : null}

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
          <span>This plan supports self-management and does not replace medical advice or prescribed treatment.</span>
        </div>

        {isLoadingPlan ? (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-bold tracking-tight text-slate-950">Loading latest action plan</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Checking whether an action plan has already been generated for your latest assessment.
            </p>
          </div>
        ) : plans.length > 0 ? (
          <ActionPlanTable plans={plans} />
        ) : (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-bold tracking-tight text-slate-950">No action plan generated yet</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Generate an action plan from your latest saved assessment to see specific examples, next steps, barriers, and measures.
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}

function mapGeneratedActionPlan(rawPlan: any): GeneratedActionPlan {
  return {
    action_plan_id: rawPlan.action_plan_id,
    title: rawPlan.title,
    summary: rawPlan.summary,
    generated_by: rawPlan.generated_by,
    ai_model: rawPlan.ai_model,
    items: (rawPlan.items ?? []).map((item: any): PlanItem => ({
      title: item.title,
      priority: priorityLabel(item.priority),
      factor: item.factor,
      timeframe: item.timeframe,
      reason: item.reason,
      nextStep: item.next_step,
      barrier: item.barrier_plan,
      measure: item.measure,
      specificExamples: item.specific_examples ?? [],
      status: item.status,
    })),
  };
}

function priorityLabel(value: string): PlanItem["priority"] {
  if (value === "high") return "High Priority";
  if (value === "medium") return "Medium Priority";
  return "Supportive";
}

export function ActionPlanSummary({ riskFactors }: { riskFactors: RiskFactor[] }) {
  return <SummaryCard plans={buildPlans(riskFactors)} />;
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
