import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gauge,
  HeartPulse,
  Info,
  LogOut,
  MessageCircle,
  Save,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { ReminderSummary, RemindersPage } from "./reminders/RemindersPage";
import { SimulatorPage } from "./simulator/SimulatorPage";

type PatientTab =
  | "dashboard"
  | "assessment"
  | "risk"
  | "action"
  | "simulator"
  | "reminders"
  | "navigator";

type StatusTone = "green" | "amber" | "red";
type BadgeTone = "green" | "amber" | "red" | "slate" | "cyan" | "purple";

type RiskCategory = {
  label: string;
  tone: StatusTone;
};

type NavItem = {
  id: PatientTab;
  label: string;
  icon: LucideIcon;
};

type RiskFactor = {
  name: string;
  type: "Modifiable" | "Non-modifiable";
  impact: string;
  description: string;
  action: string;
};

type ActionPlanItem = {
  title: string;
  priority: string;
  factor: string;
  reason: string;
};

type AssessmentForm = {
  age: number;
  sex: "female" | "male";
  systolicBp: number;
  cholesterol: number;
  glucose: "normal" | "borderline" | "high";
  smoking: "no" | "former" | "yes";
  activity: "low" | "medium" | "high";
  familyHistory: "no" | "yes" | "unsure";
  symptoms: "none" | "mild" | "urgent";
};

type AssessmentStep = {
  id: string;
  title: string;
  description: string;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "assessment", label: "Risk Assessment", icon: ClipboardList },
  { id: "risk", label: "Risk Explorer", icon: HeartPulse },
  { id: "action", label: "Action Plan", icon: ClipboardList },
  { id: "simulator", label: "What-If Simulator", icon: TrendingDown },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "navigator", label: "Care Navigator", icon: MessageCircle },
];

const riskFactors: RiskFactor[] = [
  {
    name: "High Blood Pressure",
    type: "Modifiable",
    impact: "High impact",
    description:
      "Blood pressure is one of your strongest risk contributors. Improving it may help lower your estimated CVD risk.",
    action: "Reduce salt intake and monitor blood pressure regularly.",
  },
  {
    name: "Low Physical Activity",
    type: "Modifiable",
    impact: "Medium impact",
    description:
      "Low activity level can affect weight, heart health, and blood circulation over time.",
    action: "Start with achievable walking or light exercise goals.",
  },
  {
    name: "Age Group",
    type: "Non-modifiable",
    impact: "Medium impact",
    description:
      "Age is considered because cardiovascular risk usually increases over time.",
    action: "Focus on modifiable factors such as activity, smoking, blood pressure, and monitoring.",
  },
];

const actionPlans: ActionPlanItem[] = [
  {
    title: "Reduce daily salt intake",
    priority: "High Priority",
    factor: "High Blood Pressure",
    reason:
      "Recommended because blood pressure is one of your top modifiable risk factors.",
  },
  {
    title: "Walk 30 minutes, 5 days per week",
    priority: "High Priority",
    factor: "Low Physical Activity",
    reason:
      "Recommended to improve activity level gradually without setting an unrealistic target.",
  },
  {
    title: "Replace sugary drinks with water",
    priority: "Medium Priority",
    factor: "Weight and lifestyle habit",
    reason:
      "Recommended to support healthier daily habits and long-term risk management.",
  },
];

const assessmentSteps: AssessmentStep[] = [
  {
    id: "basics",
    title: "About you",
    description: "Basic details help the model understand your general risk context.",
  },
  {
    id: "numbers",
    title: "Health numbers",
    description: "Enter the latest values you know. Helpful ranges are shown beside each field.",
  },
  {
    id: "habits",
    title: "Daily habits",
    description: "Simple lifestyle questions help explain which risk factors may be improved.",
  },
  {
    id: "review",
    title: "Review",
    description: "Check your answers before generating your estimated risk result.",
  },
];

const initialAssessment: AssessmentForm = {
  age: 45,
  sex: "female",
  systolicBp: 132,
  cholesterol: 210,
  glucose: "normal",
  smoking: "no",
  activity: "medium",
  familyHistory: "unsure",
  symptoms: "none",
};

function riskCategory(score: number): RiskCategory {
  if (score < 10) return { label: "Low Risk", tone: "green" };
  if (score < 20) return { label: "Moderate Risk", tone: "amber" };
  return { label: "High Risk", tone: "red" };
}

function calculateDemoRisk(form: AssessmentForm) {
  let score = 4;
  score += Math.max(0, (form.age - 35) * 0.28);
  score += form.sex === "male" ? 1.8 : 0.8;
  score += Math.max(0, (form.systolicBp - 115) * 0.13);
  score += Math.max(0, (form.cholesterol - 180) * 0.035);
  score += form.glucose === "high" ? 3.3 : form.glucose === "borderline" ? 1.4 : 0;
  score += form.smoking === "yes" ? 4.4 : form.smoking === "former" ? 1.2 : 0;
  score += form.activity === "low" ? 3.2 : form.activity === "medium" ? 1.1 : 0;
  score += form.familyHistory === "yes" ? 2.2 : form.familyHistory === "unsure" ? 0.8 : 0;
  score += form.symptoms === "urgent" ? 5 : form.symptoms === "mild" ? 1.5 : 0;

  return Math.min(38, Math.max(5, Math.round(score * 10) / 10));
}

function buildRiskFactors(form: AssessmentForm): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (form.systolicBp >= 130) {
    factors.push({
      name: "Blood Pressure",
      type: "Modifiable",
      impact: form.systolicBp >= 140 ? "High impact" : "Medium impact",
      description:
        "Your blood pressure reading is above the usual healthy range. Lowering it may help reduce strain on your heart and blood vessels.",
      action: "Track blood pressure, reduce salty food, and ask a healthcare professional if readings stay high.",
    });
  }

  if (form.activity !== "high") {
    factors.push({
      name: "Physical Activity",
      type: "Modifiable",
      impact: form.activity === "low" ? "High impact" : "Medium impact",
      description:
        "Being less active can affect weight, blood pressure, cholesterol, and long-term heart health.",
      action: "Start with a realistic walking or light exercise target and increase gradually.",
    });
  }

  if (form.cholesterol >= 200) {
    factors.push({
      name: "Cholesterol",
      type: "Modifiable",
      impact: "Medium impact",
      description:
        "Higher cholesterol can contribute to fatty build-up in blood vessels over time.",
      action: "Choose more fibre-rich foods and discuss follow-up testing with a healthcare professional.",
    });
  }

  if (form.smoking !== "no") {
    factors.push({
      name: "Smoking Status",
      type: "Modifiable",
      impact: form.smoking === "yes" ? "High impact" : "Medium impact",
      description:
        "Smoking can damage blood vessels and increase the chance of cardiovascular problems.",
      action: "Consider a smoking reduction or cessation plan with proper support.",
    });
  }

  if (form.familyHistory === "yes" || form.age >= 55) {
    factors.push({
      name: form.familyHistory === "yes" ? "Family History" : "Age Group",
      type: "Non-modifiable",
      impact: "Medium impact",
      description:
        "This factor cannot be changed, but it helps explain why regular monitoring and healthier habits matter.",
      action: "Focus on modifiable factors such as activity, smoking, and blood pressure monitoring.",
    });
  }

  return factors.length ? factors.slice(0, 3) : riskFactors;
}

export function PatientDashboard({ onLogout }: { onLogout?: () => void }) {
  const [activePage, setActivePage] = useState<PatientTab>("dashboard");
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessment, setAssessment] = useState<AssessmentForm>(initialAssessment);
  const [hasAssessment, setHasAssessment] = useState(false);

  const currentRisk = useMemo(() => calculateDemoRisk(assessment), [assessment]);
  const personalizedRiskFactors = useMemo(() => buildRiskFactors(assessment), [assessment]);

  const currentCategory = riskCategory(currentRisk);

  const updateAssessment = <Key extends keyof AssessmentForm>(
    key: Key,
    value: AssessmentForm[Key],
  ) => setAssessment((current) => ({ ...current, [key]: value }));

  const completeAssessment = () => {
    setHasAssessment(true);
    setActivePage("risk");
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950 lg:grid lg:grid-cols-[280px_1fr]">
      <PatientSidebar activePage={activePage} onChange={setActivePage} />

      <section className="min-w-0 px-5 py-5 lg:px-8">
        <TopBar onLogout={onLogout} hasAssessment={hasAssessment} />

        <div className="mt-7">
          {activePage === "dashboard" ? (
            <Dashboard
              currentRisk={currentRisk}
              currentCategory={currentCategory}
              hasAssessment={hasAssessment}
              riskFactors={personalizedRiskFactors}
              setActivePage={setActivePage}
            />
          ) : null}
          {activePage === "assessment" ? (
            <RiskAssessment
              form={assessment}
              step={assessmentStep}
              setStep={setAssessmentStep}
              updateField={updateAssessment}
              currentRisk={currentRisk}
              currentCategory={currentCategory}
              onComplete={completeAssessment}
            />
          ) : null}
          {activePage === "risk" ? (
            <RiskExplorer
              currentRisk={currentRisk}
              currentCategory={currentCategory}
              hasAssessment={hasAssessment}
              riskFactors={personalizedRiskFactors}
              setActivePage={setActivePage}
            />
          ) : null}
          {activePage === "action" ? <ActionPlan /> : null}
          {activePage === "simulator" ? (
            <SimulatorPage currentRisk={currentRisk} currentCategory={currentCategory} />
          ) : null}
          {activePage === "reminders" ? <RemindersPage /> : null}
          {activePage === "navigator" ? <CareNavigator /> : null}
        </div>
      </section>
    </main>
  );
}

function PatientSidebar({
  activePage,
  onChange,
}: {
  activePage: PatientTab;
  onChange: (tab: PatientTab) => void;
}) {
  return (
    <aside className="sticky top-0 z-20 flex h-auto flex-col gap-5 border-b border-slate-200 bg-white px-4 py-5 text-slate-950 lg:h-screen lg:border-b-0 lg:border-r">
      <div className="rounded-[22px] bg-slate-950 p-5 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
          <Activity className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">CardioXAI</h1>
        <p className="mt-1 text-sm text-slate-300">General User Workspace</p>
      </div>

      <nav className="grid gap-2 md:grid-cols-2 lg:grid-cols-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                selected
                  ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[22px] border border-cyan-100 bg-cyan-50 p-5 text-sm">
        <strong className="block text-cyan-950">Safety note</strong>
        <span className="mt-2 block leading-6 text-cyan-800">
          This platform supports health awareness and does not replace medical advice.
        </span>
      </div>
    </aside>
  );
}

function TopBar({
  onLogout,
  hasAssessment,
}: {
  onLogout?: () => void;
  hasAssessment: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-[24px] border border-white bg-white/80 px-5 py-5 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          <HeartPulse className="h-4 w-4" />
          Personalized cardiovascular disease monitoring
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
          Welcome back, Wen Yang
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          Review your risk result, understand the main contributors, and track safer health reminders.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-2 pl-2 pr-5 shadow-sm">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-cyan-700 font-bold text-white">
            HW
          </div>
          <div>
            <strong className="block text-sm text-slate-900">General User</strong>
            <span className="block text-xs text-slate-500">
              {hasAssessment ? "Last assessment: Today" : "Assessment not completed"}
            </span>
          </div>
        </div>
        {onLogout ? (
          <Button variant="secondary" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function Dashboard({
  currentRisk,
  currentCategory,
  hasAssessment,
  riskFactors,
  setActivePage,
}: {
  currentRisk: number;
  currentCategory: RiskCategory;
  hasAssessment: boolean;
  riskFactors: RiskFactor[];
  setActivePage: (page: PatientTab) => void;
}) {
  if (!hasAssessment) {
    return (
      <section className="grid gap-6">
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="overflow-hidden p-6">
            <div className="grid gap-7 lg:grid-cols-[1fr_260px] lg:items-center">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  <ShieldCheck className="h-4 w-4" />
                  Start here
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                  Complete your CVD risk assessment
                </h2>
                <p className="mt-4 max-w-2xl leading-7 text-slate-600">
                  Answer a short set of plain-language questions about your health numbers and daily habits. After that, this dashboard will show your estimated risk, top contributors, and recommended next steps.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => setActivePage("assessment")}>
                    Start assessment
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" onClick={() => setActivePage("navigator")}>
                    Ask care navigator
                  </Button>
                </div>
              </div>

              <div className="rounded-[22px] border border-cyan-100 bg-cyan-50 p-5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold tracking-tight">What you will fill in</h3>
                <div className="mt-4 grid gap-3 text-sm text-cyan-950">
                  {["Age and sex", "Blood pressure and cholesterol", "Glucose, smoking, activity", "Family history and symptoms"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <CardHeader title="Friendly assessment design" subtitle="Built for non-domain users" />
            <div className="mt-5 grid gap-4">
              <PlainLanguagePoint title="Guided steps" text="The form is split into small sections so users are not overwhelmed." />
              <PlainLanguagePoint title="Helpful ranges" text="Health numbers include simple hints such as usual blood pressure ranges." />
              <PlainLanguagePoint title="Safety prompts" text="Urgent symptoms are clearly flagged and users are reminded this is not a diagnosis." />
            </div>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[2fr_0.85fr]">
        <Card className="p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardHeader
              title="Your estimated CVD risk"
              subtitle="The score summarizes the model estimate for your latest assessment."
            />
            <StatusBadge tone={currentCategory.tone}>{currentCategory.label}</StatusBadge>
          </div>

          <div className="grid items-center gap-7 text-center md:grid-cols-[210px_1fr] md:text-left">
            <div className="mx-auto md:mx-0">
              <RiskGauge value={currentRisk} label={currentCategory.label} />
            </div>
            <div>
              <h3 className="text-3xl font-bold tracking-tight text-slate-950">
                {currentRisk}% estimated risk
              </h3>
              <p className="mt-3 leading-7 text-slate-600">
                Your risk is currently in the moderate range. The result is mainly influenced by blood pressure, activity level, and age group.
              </p>
              <Notice tone="soft">This score is an estimate and not a medical diagnosis.</Notice>
              <Button className="mt-5" onClick={() => setActivePage("risk")}>
                View full explanation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Next recommended step</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">Try a safer lifestyle scenario</h3>
            <p className="mt-4 leading-7 text-slate-600">
              Explore how realistic changes such as walking more often or reducing salt intake may affect your projected risk.
            </p>
          </div>
          <Button variant="secondary" className="mt-6 w-fit" onClick={() => setActivePage("simulator")}>
            Open simulator
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TopRiskFactors compact factors={riskFactors} />
        <ActionPlan compact />
        <ReminderSummary />
      </div>
    </section>
  );
}

function RiskExplorer({
  currentRisk,
  currentCategory,
  hasAssessment,
  riskFactors,
  setActivePage,
}: {
  currentRisk: number;
  currentCategory: RiskCategory;
  hasAssessment: boolean;
  riskFactors: RiskFactor[];
  setActivePage: (page: PatientTab) => void;
}) {
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
          <Button onClick={() => setActivePage("assessment")}>
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
        description="This page explains the risk score, risk category, and top contributing factors using non-technical language."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
        <Card className="grid justify-items-center gap-4 p-6 text-center">
          <RiskGauge value={currentRisk} label={currentCategory.label} size="large" />
          <StatusBadge tone={currentCategory.tone}>{currentCategory.label}</StatusBadge>
          <p className="leading-7 text-slate-600">
            A moderate score means your estimated risk is not the lowest category, but several contributing factors may be improved through lifestyle changes and regular monitoring.
          </p>
          <Notice tone="warning">
            Consult a healthcare professional if you are worried about your result or experience symptoms.
          </Notice>
        </Card>

        <TopRiskFactors factors={riskFactors} />
      </div>
    </section>
  );
}

function RiskAssessment({
  form,
  step,
  setStep,
  updateField,
  currentRisk,
  currentCategory,
  onComplete,
}: {
  form: AssessmentForm;
  step: number;
  setStep: (step: number) => void;
  updateField: <Key extends keyof AssessmentForm>(key: Key, value: AssessmentForm[Key]) => void;
  currentRisk: number;
  currentCategory: RiskCategory;
  onComplete: () => void;
}) {
  const currentStep = assessmentSteps[step];
  const isLastStep = step === assessmentSteps.length - 1;
  const hasUrgentSymptoms = form.symptoms === "urgent";

  return (
    <section className="grid gap-6">
      <SectionTitle
        label="CVD risk assessment"
        title="Build your risk profile step by step"
        description="The assessment uses simple questions and helpful hints so general users can complete it without medical training."
      />

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-4">
          {assessmentSteps.map((item, index) => {
            const selected = index === step;
            const completed = index < step;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(index)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  selected
                    ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                    : completed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200"
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  completed ? "bg-emerald-600 text-white" : selected ? "bg-cyan-700 text-white" : "bg-slate-100"
                }`}>
                  {completed ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span>
                  <strong className="block text-sm">{item.title}</strong>
                  <span className="mt-0.5 block text-xs opacity-75">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-6">
          <CardHeader title={currentStep.title} subtitle={currentStep.description} />

          <div className="mt-6">
            {step === 0 ? (
              <div className="grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Age"
                  value={form.age}
                  min={18}
                  max={95}
                  unit="years"
                  helper="Use your current age."
                  onChange={(value) => updateField("age", value)}
                />
                <ChoiceGroup
                  label="Sex"
                  value={form.sex}
                  options={[
                    ["female", "Female"],
                    ["male", "Male"],
                  ]}
                  onChange={(value) => updateField("sex", value as AssessmentForm["sex"])}
                />
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Systolic blood pressure"
                  value={form.systolicBp}
                  min={80}
                  max={220}
                  unit="mmHg"
                  helper="This is the upper number, for example 132 in 132/84."
                  onChange={(value) => updateField("systolicBp", value)}
                />
                <NumberField
                  label="Total cholesterol"
                  value={form.cholesterol}
                  min={120}
                  max={360}
                  unit="mg/dL"
                  helper="If you only know mmol/L, your clinic report may show both units."
                  onChange={(value) => updateField("cholesterol", value)}
                />
                <div className="md:col-span-2">
                  <ChoiceGroup
                    label="Blood glucose"
                    value={form.glucose}
                    options={[
                      ["normal", "Normal"],
                      ["borderline", "Borderline"],
                      ["high", "High"],
                    ]}
                    onChange={(value) => updateField("glucose", value as AssessmentForm["glucose"])}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-5">
                <ChoiceGroup
                  label="Smoking status"
                  value={form.smoking}
                  options={[
                    ["no", "No"],
                    ["former", "Former smoker"],
                    ["yes", "Currently smoke"],
                  ]}
                  onChange={(value) => updateField("smoking", value as AssessmentForm["smoking"])}
                />
                <ChoiceGroup
                  label="Weekly physical activity"
                  value={form.activity}
                  options={[
                    ["low", "Low"],
                    ["medium", "Some activity"],
                    ["high", "Active"],
                  ]}
                  helper="Choose the closest answer. You do not need an exact exercise log."
                  onChange={(value) => updateField("activity", value as AssessmentForm["activity"])}
                />
                <ChoiceGroup
                  label="Family history of heart disease"
                  value={form.familyHistory}
                  options={[
                    ["no", "No"],
                    ["yes", "Yes"],
                    ["unsure", "Not sure"],
                  ]}
                  onChange={(value) => updateField("familyHistory", value as AssessmentForm["familyHistory"])}
                />
                <ChoiceGroup
                  label="Current symptoms"
                  value={form.symptoms}
                  options={[
                    ["none", "No symptoms"],
                    ["mild", "Mild concern"],
                    ["urgent", "Chest pain or severe breathlessness"],
                  ]}
                  onChange={(value) => updateField("symptoms", value as AssessmentForm["symptoms"])}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4">
                <AssessmentReview form={form} />
                <Notice tone="soft">
                  Your result will be shown as an estimated risk for health awareness. It is not a medical diagnosis.
                </Notice>
                {hasUrgentSymptoms ? (
                  <Notice tone="danger">
                    You selected urgent symptoms. Please seek medical care promptly if you are experiencing chest pain, severe breathlessness, fainting, or worsening symptoms.
                  </Notice>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {isLastStep ? (
              <Button type="button" onClick={onComplete}>
                Generate risk result
                <Save className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => setStep(Math.min(assessmentSteps.length - 1, step + 1))}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title="Live estimate preview" subtitle="Updates as the user fills the form" />
          <div className="mt-6 grid justify-items-center gap-4 text-center">
            <RiskGauge value={currentRisk} label={currentCategory.label} />
            <StatusBadge tone={currentCategory.tone}>{currentCategory.label}</StatusBadge>
            <p className="leading-7 text-slate-600">
              This preview helps users understand that answers affect the score, while the final explanation appears after submission.
            </p>
          </div>
          <Notice tone={hasUrgentSymptoms ? "danger" : "warning"}>
            {hasUrgentSymptoms
              ? "Urgent symptoms should be handled by medical services, not by this assessment alone."
              : "Use recent clinic or home monitoring values if available. Estimates are less reliable when values are guessed."}
          </Notice>
        </Card>
      </div>
    </section>
  );
}

function PlainLanguagePoint({ title, text }: { title: string; text: string }) {
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

function NumberField({
  label,
  value,
  min,
  max,
  unit,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  helper: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-3 flex items-center gap-3">
        <input
          className="form-input mt-0"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="w-16 text-sm font-semibold text-slate-500">{unit}</span>
      </div>
      <small className="mt-3 block leading-5 text-slate-500">{helper}</small>
    </label>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  helper,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;

          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`min-h-16 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                selected
                  ? "border-cyan-300 bg-cyan-50 text-cyan-900 ring-2 ring-cyan-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                {optionLabel}
                {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AssessmentReview({ form }: { form: AssessmentForm }) {
  const rows = [
    ["Age", `${form.age} years`],
    ["Sex", form.sex === "female" ? "Female" : "Male"],
    ["Systolic blood pressure", `${form.systolicBp} mmHg`],
    ["Total cholesterol", `${form.cholesterol} mg/dL`],
    ["Blood glucose", labelize(form.glucose)],
    ["Smoking status", labelize(form.smoking)],
    ["Physical activity", labelize(form.activity)],
    ["Family history", labelize(form.familyHistory)],
    ["Current symptoms", labelize(form.symptoms)],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          <strong className="mt-1 block text-slate-900">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function labelize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function TopRiskFactors({
  compact = false,
  factors = riskFactors,
}: {
  compact?: boolean;
  factors?: RiskFactor[];
}) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <CardHeader
          title="Top contributing factors"
          subtitle="XAI explanation"
        />
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
              <Tag tone={factor.type === "Modifiable" ? "green" : "slate"}>{factor.type}</Tag>
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

function ActionPlan({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "" : "grid gap-6"}>
      {!compact ? (
        <SectionTitle
          label="Lifestyle recommendation module"
          title="Personalized action plan"
          description="Recommended actions are prioritized based on your risk category and top modifiable risk factors."
        />
      ) : null}

      <Card className="p-6">
        {compact ? (
          <div className="mb-5 flex items-start justify-between gap-4">
            <CardHeader title="Action plan" subtitle="Recommended actions" />
            <Button variant="ghost">View all</Button>
          </div>
        ) : null}

        <div className={`grid gap-4 ${compact ? "" : "xl:grid-cols-3"}`}>
          {actionPlans.map((plan, index) => (
            <article key={plan.title} className="flex gap-4 rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 font-bold text-cyan-700">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-bold tracking-tight text-slate-900">{plan.title}</h3>
                  <Tag tone="amber">{plan.priority}</Tag>
                </div>
                <p className="mt-3 leading-7 text-slate-600">{plan.reason}</p>
                {!compact ? (
                  <div className="mt-5 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>Related factor: {plan.factor}</span>
                    <Button variant="secondary" className="min-h-10 px-4 py-2 text-sm">
                      Convert to goal
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}

function CareNavigator() {
  return (
    <section className="grid gap-6">
      <SectionTitle
        label="Virtual care navigator"
        title="Ask simple health questions"
        description="A conversational assistant can provide education and guide users on when to consult a physician."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <Card className="grid gap-4 p-6">
          <ChatMessage sender="Care Navigator" type="bot">
            Hello! I can help explain your CVD risk result in simple language. What would you like to understand?
          </ChatMessage>

          <div className="flex flex-wrap gap-3">
            <SuggestionButton>What does moderate risk mean?</SuggestionButton>
            <SuggestionButton>Why is blood pressure important?</SuggestionButton>
            <SuggestionButton>When should I consult a doctor?</SuggestionButton>
          </div>

          <ChatMessage type="user">How can I lower my risk safely?</ChatMessage>
          <ChatMessage sender="Care Navigator" type="bot">
            Start with realistic changes, such as regular walking, lower salt intake, and consistent monitoring. For personal medical advice, consult a healthcare professional.
          </ChatMessage>

          <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input className="form-input" placeholder="Type your question here..." />
            <Button>
              Send
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title="When to seek help" />
          <p className="mt-4 leading-7 text-slate-600">Consider consulting a healthcare professional if:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-slate-600">
            <li>Your risk category is high.</li>
            <li>You are unsure how to interpret your result.</li>
            <li>You experience chest pain, shortness of breath, or severe symptoms.</li>
          </ul>
          <Notice tone="soft">This navigator provides general education only.</Notice>
        </Card>
      </div>
    </section>
  );
}

function RiskGauge({
  value,
  label,
  size = "normal",
}: {
  value: number;
  label: string;
  size?: "normal" | "large";
}) {
  const radius = size === "large" ? 88 : 68;
  const strokeWidth = size === "large" ? 18 : 15;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const progress = Math.min(100, Math.max(0, value));
  const dashOffset = circumference - (progress / 100) * circumference;
  const dimension = radius * 2;

  return (
    <div className="relative grid place-items-center" style={{ width: dimension, height: dimension }}>
      <svg width={dimension} height={dimension} className="-rotate-90">
        <circle
          className="stroke-slate-200"
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          strokeWidth={strokeWidth}
        />
        <circle
          className="stroke-amber-500 transition-all duration-500"
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <strong className="block text-4xl font-bold tracking-tight text-slate-950">{value}%</strong>
          <span className="mt-1 block text-xs font-bold text-slate-500">{label}</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return <Badge tone={tone}>{children}</Badge>;
}

function Tag({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <Badge tone={tone}>{children}</Badge>;
}

function Notice({
  tone,
  children,
}: {
  tone: "soft" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const toneClass = {
    soft: "border-cyan-100 bg-cyan-50 text-cyan-800",
    warning: "border-amber-100 bg-amber-50 text-amber-800",
    danger: "border-red-100 bg-red-50 text-red-700",
  }[tone];

  return <div className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${toneClass}`}>{children}</div>;
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

function ChatMessage({
  sender,
  type,
  children,
}: {
  sender?: string;
  type: "bot" | "user";
  children: React.ReactNode;
}) {
  const isUser = type === "user";

  return (
    <div className={`max-w-[85%] rounded-[22px] p-4 leading-7 ${isUser ? "justify-self-end bg-cyan-50" : "bg-slate-100"}`}>
      {sender ? <strong className="block text-slate-900">{sender}</strong> : null}
      <p className="mt-1 text-slate-600">{children}</p>
    </div>
  );
}

function SuggestionButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-50">
      {children}
    </button>
  );
}
