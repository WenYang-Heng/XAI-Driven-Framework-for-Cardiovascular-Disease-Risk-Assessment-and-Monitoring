import { ArrowRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { priorityTone } from "./actionPlanGenerator";
import type { PlanIcon, PlanItem } from "./types";

type PlanCardProps = {
  index: number;
  plan: PlanItem;
};

export function PlanCard({ index, plan }: PlanCardProps) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 font-bold text-cyan-700">
            {index}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold tracking-tight text-slate-900">{plan.title}</h3>
              <Badge tone={priorityTone(plan.priority)}>{plan.priority}</Badge>
              <Badge tone="slate">{plan.difficulty}</Badge>
            </div>
            <p className="mt-3 leading-7 text-slate-600">{plan.reason}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <PlanDetail icon={ArrowRight} label="Next step" text={plan.nextStep} />
        <PlanDetail icon={ShieldCheck} label="Barrier plan" text={plan.barrier} />
        <PlanDetail icon={ClipboardCheck} label="Measure" text={plan.measure} />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold text-slate-500">
          Focus: {plan.factor} - {plan.timeframe}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-10 px-4 py-2 text-sm">
            Convert to goal
          </Button>
          <Button variant="ghost" className="min-h-10 px-4 py-2 text-sm">
            Set reminder
          </Button>
        </div>
      </div>
    </article>
  );
}

export function PlanDetail({
  icon: Icon,
  label,
  text,
}: {
  icon: PlanIcon;
  label: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-sm">
      <span className="flex items-center gap-2 font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-cyan-700" />
        {label}
      </span>
      <p className="mt-2 leading-6 text-slate-600">{text}</p>
    </div>
  );
}

export function ActionPlanSummary({ plans }: { plans: PlanItem[] }) {
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <CardHeader title="Action plan" subtitle="Recommended actions" />
        <Button variant="ghost">View all</Button>
      </div>

      <div className="grid flex-1 gap-4">
        {plans.slice(0, 3).map((plan, index) => (
          <article
            key={plan.title}
            className="grid gap-4 rounded-[20px] border border-slate-200 bg-white p-4 sm:grid-cols-[40px_1fr_150px] sm:items-start"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 font-bold text-cyan-700">
              {index + 1}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold tracking-tight text-slate-900">{plan.title}</h3>
              <p className="mt-3 leading-7 text-slate-600">
                {plan.reason.length > 96 ? `${plan.reason.slice(0, 96)}...` : plan.reason}
              </p>
            </div>
            <div className="sm:justify-self-start">
              <Badge className="shrink-0" tone={priorityTone(plan.priority)}>{plan.priority}</Badge>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
