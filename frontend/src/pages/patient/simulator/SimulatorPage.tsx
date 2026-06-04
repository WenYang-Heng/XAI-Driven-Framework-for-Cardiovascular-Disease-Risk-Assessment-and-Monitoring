import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bed,
  Bot,
  Cigarette,
  Droplets,
  HeartPulse,
  MessageCircle,
  Salad,
  Scale,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";

type RiskCategory = {
  label: string;
  tone: "green" | "amber" | "red";
};

type SimulatorPageProps = {
  currentRisk: number;
  currentCategory: RiskCategory;
};

type Scenario = {
  activityMinutes: number;
  salt: number;
  dietQuality: number;
  nicotine: number;
  sleep: number;
  systolicBp: number;
  cholesterol: number;
  glucose: number;
  weightGoal: number;
  medicationAdherence: number;
};

type Preset = {
  title: string;
  desc: string;
  values: Partial<Scenario>;
};

const initialScenario: Scenario = {
  activityMinutes: 90,
  salt: 3,
  dietQuality: 3,
  nicotine: 0,
  sleep: 7,
  systolicBp: 132,
  cholesterol: 210,
  glucose: 1,
  weightGoal: 0,
  medicationAdherence: 4,
};

const presets: Preset[] = [
  {
    title: "Balanced plan",
    desc: "More activity, better food choices, and steady monitoring.",
    values: { activityMinutes: 150, salt: 2, dietQuality: 4, sleep: 8 },
  },
  {
    title: "Improve BP control",
    desc: "Lower salt, better adherence, and a safer BP target.",
    values: { salt: 1, systolicBp: 124, medicationAdherence: 5 },
  },
  {
    title: "Quit nicotine",
    desc: "Simulate removing smoking or nicotine exposure.",
    values: { nicotine: 0 },
  },
];

function riskCategory(score: number): RiskCategory {
  if (score < 10) return { label: "Low Risk", tone: "green" };
  if (score < 20) return { label: "Moderate Risk", tone: "amber" };
  return { label: "High Risk", tone: "red" };
}

function calculateProjectedRisk(currentRisk: number, scenario: Scenario) {
  const activityEffect = Math.max(0, scenario.activityMinutes - 60) / 90 * 1.8;
  const saltEffect = Math.max(0, 5 - scenario.salt) * 0.75;
  const dietEffect = Math.max(0, scenario.dietQuality - 2) * 0.7;
  const nicotineEffect = scenario.nicotine === 0 ? 2.4 : scenario.nicotine === 1 ? 0.9 : -1.3;
  const sleepEffect = scenario.sleep >= 7 && scenario.sleep <= 9 ? 0.9 : -0.7;
  const bpEffect = Math.max(0, 132 - scenario.systolicBp) * 0.09;
  const cholesterolEffect = Math.max(0, 210 - scenario.cholesterol) * 0.025;
  const glucoseEffect = Math.max(0, 1 - scenario.glucose) * 1.1;
  const weightEffect = Math.max(0, Math.min(scenario.weightGoal, 8)) * 0.22;
  const adherenceEffect = Math.max(0, scenario.medicationAdherence - 3) * 0.55;

  const projected =
    currentRisk -
    activityEffect -
    saltEffect -
    dietEffect -
    nicotineEffect -
    sleepEffect -
    bpEffect -
    cholesterolEffect -
    glucoseEffect -
    weightEffect -
    adherenceEffect;

  return Math.max(5, Math.round(projected * 10) / 10);
}

function strongestChange(scenario: Scenario) {
  const changes = [
    ["physical activity", Math.max(0, scenario.activityMinutes - 60) / 90 * 1.8],
    ["blood pressure control", Math.max(0, 132 - scenario.systolicBp) * 0.09],
    ["nicotine reduction", scenario.nicotine === 0 ? 2.4 : scenario.nicotine === 1 ? 0.9 : 0],
    ["salt reduction", Math.max(0, 5 - scenario.salt) * 0.75],
    ["diet quality", Math.max(0, scenario.dietQuality - 2) * 0.7],
  ];

  return changes.sort((a, b) => Number(b[1]) - Number(a[1]))[0][0];
}

function scenarioSafety(scenario: Scenario) {
  if (scenario.activityMinutes > 420 || scenario.weightGoal > 10 || scenario.systolicBp < 105) {
    return {
      label: "May be unrealistic",
      tone: "red" as const,
      text: "This scenario may be too intense or unsafe. Choose gradual targets and discuss major changes with a healthcare professional.",
    };
  }

  if (scenario.activityMinutes >= 150 && scenario.sleep >= 7 && scenario.sleep <= 9) {
    return {
      label: "Realistic plan",
      tone: "green" as const,
      text: "This plan looks achievable for many users if changes are introduced gradually.",
    };
  }

  return {
    label: "Needs improvement",
    tone: "amber" as const,
    text: "This plan can be strengthened by improving one or two lifestyle factors at a time.",
  };
}

function buildAiInsight({
  reduction,
  mostImpactful,
  safetyLabel,
}: {
  reduction: number;
  mostImpactful: string;
  safetyLabel: string;
}) {
  if (reduction <= 0) {
    return "This scenario does not reduce the estimated risk yet. Try improving one high-impact area first, such as weekly activity, blood pressure control, or nicotine exposure.";
  }

  return `This scenario may lower the estimate by ${reduction}%. The biggest simulated driver is ${mostImpactful}. Because the plan is marked "${safetyLabel}", the next step should be gradual and realistic.`;
}

export function SimulatorPage({ currentRisk, currentCategory }: SimulatorPageProps) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);

  const projectedRisk = useMemo(
    () => calculateProjectedRisk(currentRisk, scenario),
    [currentRisk, scenario],
  );
  const projectedCategory = riskCategory(projectedRisk);
  const reduction = Math.round((currentRisk - projectedRisk) * 10) / 10;
  const safety = scenarioSafety(scenario);
  const mostImpactful = strongestChange(scenario);
  const aiInsight = buildAiInsight({
    reduction,
    mostImpactful,
    safetyLabel: safety.label,
  });

  const updateScenario = <Key extends keyof Scenario>(key: Key, value: Scenario[Key]) => {
    setScenario((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (preset: Preset) => {
    setScenario((current) => ({ ...current, ...preset.values }));
  };

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-cyan-700">What-if lifestyle simulator</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Explore realistic risk scenarios
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Adjust lifestyle habits and key health numbers to see how a gradual, safer plan may change the estimated CVD risk.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setScenario(initialScenario)}>
          Reset scenario
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {presets.map((preset) => (
          <button
            key={preset.title}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-[20px] border border-slate-200 bg-white p-5 text-left transition hover:border-cyan-200 hover:bg-cyan-50"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-cyan-700">Preset</span>
            <h3 className="mt-2 font-bold tracking-tight text-slate-900">{preset.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{preset.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="grid content-start gap-6 p-6">
          <CardHeader title="Build your scenario" subtitle="Grouped by changes users can understand and act on." />

          <ControlSection title="Daily habits">
            <SliderControl icon={Activity} label="Weekly activity" value={scenario.activityMinutes} min={0} max={420} step={15} unit="min" onChange={(value) => updateScenario("activityMinutes", value)} helper="A common adult target is about 150 minutes per week." />
            <SliderControl icon={Salad} label="Diet quality" value={scenario.dietQuality} min={1} max={5} step={1} unit="/ 5" onChange={(value) => updateScenario("dietQuality", value)} helper="1 = poor, 5 = heart-friendly pattern." />
            <SliderControl icon={Droplets} label="Salt intake" value={scenario.salt} min={1} max={5} step={1} unit="/ 5" onChange={(value) => updateScenario("salt", value)} helper="1 = lower salt, 5 = high salt." />
            <SliderControl icon={Cigarette} label="Nicotine exposure" value={scenario.nicotine} min={0} max={2} step={1} unit="/ 2" onChange={(value) => updateScenario("nicotine", value)} helper="0 = none, 1 = former/secondhand, 2 = current." />
            <SliderControl icon={Bed} label="Sleep duration" value={scenario.sleep} min={4} max={11} step={0.5} unit="hours" onChange={(value) => updateScenario("sleep", value)} helper="Most adults do best around 7 to 9 hours." />
          </ControlSection>

          <ControlSection title="Health numbers">
            <SliderControl icon={HeartPulse} label="Systolic blood pressure" value={scenario.systolicBp} min={105} max={180} step={1} unit="mmHg" onChange={(value) => updateScenario("systolicBp", value)} helper="The upper number in a reading such as 132/84." />
            <SliderControl icon={Stethoscope} label="Total cholesterol" value={scenario.cholesterol} min={150} max={280} step={5} unit="mg/dL" onChange={(value) => updateScenario("cholesterol", value)} helper="Use recent clinic values when available." />
            <SliderControl icon={Droplets} label="Blood glucose level" value={scenario.glucose} min={0} max={2} step={1} unit="/ 2" onChange={(value) => updateScenario("glucose", value)} helper="0 = normal, 1 = borderline, 2 = high." />
            <SliderControl icon={Scale} label="Weight change goal" value={scenario.weightGoal} min={0} max={15} step={1} unit="kg" onChange={(value) => updateScenario("weightGoal", value)} helper="Large short-term targets may be unrealistic." />
            <SliderControl icon={ShieldAlert} label="Medication adherence" value={scenario.medicationAdherence} min={1} max={5} step={1} unit="/ 5" onChange={(value) => updateScenario("medicationAdherence", value)} helper="Only applies if medication was prescribed." />
          </ControlSection>
        </Card>

        <Card className="self-start p-6 xl:sticky xl:top-6">
          <CardHeader title="Projected risk" subtitle="Estimate, safety check, and AI-style explanation." />

          <div className="mt-6 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr] xl:grid-cols-1 2xl:grid-cols-[1fr_auto_1fr]">
            <ResultBox title="Current" value={currentRisk} category={currentCategory} />
            <ArrowRight className="justify-self-center text-cyan-700 sm:h-8 sm:w-8 xl:rotate-90 2xl:rotate-0" />
            <ResultBox title="Projected" value={projectedRisk} category={projectedCategory} />
          </div>

          <div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50 p-5">
            <p className="text-slate-600">Estimated risk change</p>
            <h3 className="mt-1 text-4xl font-bold tracking-tight text-emerald-700">
              {reduction > 0 ? `-${reduction}%` : "No reduction"}
            </h3>
            <span className="mt-2 block text-slate-600">Most impactful change: {mostImpactful}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-slate-900">Scenario safety</strong>
              <Badge tone={safety.tone}>{safety.label}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{safety.text}</p>
          </div>

          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <strong className="block text-slate-950">AI lifestyle insight</strong>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Plain-language explanation
                </span>
              </div>
            </div>
            <p className="mt-4 leading-7 text-slate-600">{aiInsight}</p>

            <div className="mt-4 grid gap-3">
              <ChatSuggestion>Why did my projected risk change?</ChatSuggestion>
              <ChatSuggestion>Which change should I start with?</ChatSuggestion>
              <ChatSuggestion>Is this scenario realistic for me?</ChatSuggestion>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3">
              <MessageCircle className="h-4 w-4 text-cyan-700" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Ask about this scenario..."
              />
              <Button className="min-h-9 px-3 py-1 text-xs">Ask</Button>
            </div>
          </div>

          <Notice>Projected risk is an estimate and not a guaranteed medical outcome.</Notice>
        </Card>
      </div>
    </section>
  );
}

function ControlSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-bold tracking-tight text-slate-900">{title}</h3>
      <div className="grid gap-4 2xl:grid-cols-2">{children}</div>
    </section>
  );
}

function SliderControl({
  icon: Icon,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  helper: string;
}) {
  return (
    <div className="grid gap-3 rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <span className="flex items-center gap-2 font-bold text-slate-700">
          <Icon className="h-4 w-4 text-cyan-700" />
          {label}
        </span>
        <strong className="text-sm text-slate-950">
          {value} {unit}
        </strong>
      </div>
      <input
        className="w-full accent-cyan-700"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small className="text-slate-500">{helper}</small>
    </div>
  );
}

function ResultBox({
  title,
  value,
  category,
}: {
  title: string;
  value: number;
  category: RiskCategory;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-center">
      <p className="text-slate-600">{title}</p>
      <h3 className="my-3 text-4xl font-bold tracking-tight text-slate-950">{value}%</h3>
      <div className="flex justify-center">
        <Badge tone={category.tone}>{category.label}</Badge>
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-800">
      {children}
    </div>
  );
}

function ChatSuggestion({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-cyan-700 transition hover:border-cyan-200 hover:bg-cyan-50"
    >
      {children}
    </button>
  );
}
