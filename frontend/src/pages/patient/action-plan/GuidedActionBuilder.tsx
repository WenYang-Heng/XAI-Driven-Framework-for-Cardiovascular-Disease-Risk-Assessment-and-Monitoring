import { Bot, CalendarDays, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { PlanDetail } from "./PlanCard";
import type { GuidedPlanForm, PlanItem } from "./types";

type GuidedActionBuilderProps = {
  form: GuidedPlanForm;
  generatedPlan: PlanItem;
  updateField: <Key extends keyof GuidedPlanForm>(key: Key, value: GuidedPlanForm[Key]) => void;
  onAddPlan?: () => void;
};

export function GuidedActionBuilder({
  form,
  generatedPlan,
  updateField,
  onAddPlan,
}: GuidedActionBuilderProps) {
  return (
    <Card className="p-6">
      <CardHeader
        title="Guided action builder"
        subtitle="Answer a few simple questions to personalize one realistic action."
      />

      <div className="mt-5 grid gap-5">
        <ChoiceGroup
          label="What would you like to work on first?"
          value={form.focus}
          options={[
            ["activity", "Move more"],
            ["diet", "Food choices"],
            ["blood-pressure", "Blood pressure"],
            ["smoking", "Nicotine"],
            ["monitoring", "Monitoring"],
          ]}
          onChange={(value) => updateField("focus", value as GuidedPlanForm["focus"])}
        />

        <ChoiceGroup
          label="How ready do you feel this week?"
          value={form.readiness}
          options={[
            ["low", "Start small"],
            ["medium", "Somewhat ready"],
            ["high", "Very ready"],
          ]}
          onChange={(value) => updateField("readiness", value as GuidedPlanForm["readiness"])}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormLabel label="Time available">
            <select
              className="form-input"
              value={form.timeAvailable}
              onChange={(event) =>
                updateField("timeAvailable", event.target.value as GuidedPlanForm["timeAvailable"])
              }
            >
              <option>5 min</option>
              <option>10 min</option>
              <option>30 min</option>
            </select>
          </FormLabel>

          <FormLabel label="Best reminder time">
            <select
              className="form-input"
              value={form.reminder}
              onChange={(event) =>
                updateField("reminder", event.target.value as GuidedPlanForm["reminder"])
              }
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="weekend">Weekend</option>
            </select>
          </FormLabel>
        </div>

        <ChoiceGroup
          label="What might get in the way?"
          value={form.barrier}
          options={[
            ["busy", "Busy schedule"],
            ["low-energy", "Low energy"],
            ["cost", "Cost"],
            ["forgetful", "Forgetfulness"],
          ]}
          onChange={(value) => updateField("barrier", value as GuidedPlanForm["barrier"])}
        />
      </div>

      <div className="mt-6 rounded-[22px] border border-cyan-100 bg-cyan-50 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <strong className="block text-cyan-950">Suggested action</strong>
            <span className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Preview
            </span>
          </div>
        </div>

        <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-950">
          {generatedPlan.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{generatedPlan.reason}</p>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <PlanDetail icon={Sparkles} label="Next step" text={generatedPlan.nextStep} />
          <PlanDetail icon={ShieldCheck} label="Barrier plan" text={generatedPlan.barrier} />
          <PlanDetail icon={CalendarDays} label="Measure" text={generatedPlan.measure} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="min-h-10 px-4 py-2 text-sm" onClick={onAddPlan}>
            Add to plan
          </Button>
          <Button variant="secondary" className="min-h-10 px-4 py-2 text-sm">
            Create reminder
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;

          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                selected
                  ? "border-cyan-300 bg-cyan-50 text-cyan-900 ring-2 ring-cyan-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50"
              }`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
