import { Fragment, useState } from "react";
import { ArrowRight, Bell, ChevronDown, ChevronUp, ClipboardCheck, MoreHorizontal, ShieldCheck } from "lucide-react";
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

      {plan.specificExamples?.length ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="text-sm font-semibold text-slate-900">Specific examples</span>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {plan.specificExamples.map((example) => (
              <div
                key={example}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700"
              >
                {example}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold text-slate-500">
          Focus: {plan.factor} - {plan.timeframe}
          {plan.status ? ` - Status: ${plan.status.split("_").join(" ")}` : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="min-h-10 px-4 py-2 text-sm">
            Set reminder
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ActionPlanTable({ plans }: { plans: PlanItem[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <div className="grid gap-4">
      {plans.map((plan, index) => {
        const expanded = expandedIndex === index;
        return (
          <article
            key={`${plan.title}-${index}`}
            className={`overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm ${
              priorityRailClass(plan.priority)
            }`}
          >
            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold tracking-tight text-slate-950">
                    {plan.title}
                  </h3>
                  <Badge tone={priorityTone(plan.priority)}>{plan.priority}</Badge>
                  <Badge tone="slate">{plan.difficulty}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>#{index + 1}</span>
                  <span>·</span>
                  <span>{plan.factor}</span>
                  <span>·</span>
                  <span>{plan.timeframe}</span>
                  <span>·</span>
                  <span>{plan.status ? labelize(plan.status) : "Not started"}</span>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="line-clamp-2 leading-7 text-slate-600">{plan.reason}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <IconButton label="Set reminder">
                  <Bell className="h-4 w-4" />
                </IconButton>
                <IconButton label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </IconButton>
                <Button
                  variant="secondary"
                  className="min-h-10 px-4 py-2 text-sm"
                  onClick={() => setExpandedIndex(expanded ? null : index)}
                >
                  {expanded ? "Hide details" : "View details"}
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {expanded ? (
              <div className="border-t border-slate-100 bg-slate-50 p-5">
                <ActionPlanDetails plan={plan} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function labelize(value: string) {
  return value
    .split("_")
    .join(" ")
    .split("-")
    .join(" ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ActionPlanDetails({ plan }: { plan: PlanItem }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone="cyan">Focus: {plan.factor}</Badge>
        <Badge tone="slate">Timeframe: {plan.timeframe}</Badge>
        <Badge tone="slate">Status: {plan.status ? labelize(plan.status) : "Not started"}</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">Action details</h4>
          <div className="mt-3 grid gap-3">
            <PlanDetail icon={ArrowRight} label="Next step" text={plan.nextStep} />
            <PlanDetail icon={ShieldCheck} label="Barrier plan" text={plan.barrier} />
            <PlanDetail icon={ClipboardCheck} label="Measure" text={plan.measure} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">Specific examples</h4>
          {plan.specificExamples?.length ? (
            <div className="mt-3 grid gap-2">
              {plan.specificExamples.map((example) => (
                <div
                  key={example}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
                >
                  {example}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">No specific examples were generated for this action.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
    >
      {children}
    </button>
  );
}

function priorityRailClass(priority: string) {
  if (priority.toLowerCase().includes("high")) {
    return "border-l-4 border-l-amber-500";
  }
  if (priority.toLowerCase().includes("medium")) {
    return "border-l-4 border-l-cyan-500";
  }
  return "border-l-4 border-l-emerald-500";
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <p className="mt-3 font-semibold leading-6 text-slate-900">{text}</p>
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
