import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  Gauge,
  HeartPulse,
  LogOut,
  MessageCircle,
  Target,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";

type PatientTab =
  | "dashboard"
  | "risk"
  | "action"
  | "simulator"
  | "goals"
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

type Goal = {
  title: string;
  progress: number;
  linked: string;
};

type Reminder = {
  title: string;
  time: string;
  linked: string;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "risk", label: "Risk Explorer", icon: HeartPulse },
  { id: "action", label: "Action Plan", icon: ClipboardList },
  { id: "simulator", label: "What-If Simulator", icon: TrendingDown },
  { id: "goals", label: "Goals", icon: Target },
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
    action: "Focus on modifiable factors such as activity, diet, and monitoring.",
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

const goals: Goal[] = [
  { title: "Walk 8,000 steps daily", progress: 70, linked: "Physical activity" },
  { title: "Reduce salty food this week", progress: 45, linked: "Blood pressure" },
  { title: "Check blood pressure twice weekly", progress: 60, linked: "Monitoring" },
];

const reminders: Reminder[] = [
  { title: "Evening walk", time: "Today, 6:00 PM", linked: "Walk 8,000 steps daily" },
  { title: "Blood pressure check", time: "Tomorrow, 9:00 AM", linked: "Monitoring" },
  { title: "Weekly goal review", time: "Sunday, 8:00 PM", linked: "Goal progress" },
];

function riskCategory(score: number): RiskCategory {
  if (score < 10) return { label: "Low Risk", tone: "green" };
  if (score < 20) return { label: "Moderate Risk", tone: "amber" };
  return { label: "High Risk", tone: "red" };
}

export function PatientDashboard({ onLogout }: { onLogout?: () => void }) {
  const [activePage, setActivePage] = useState<PatientTab>("dashboard");
  const [steps, setSteps] = useState(8000);
  const [salt, setSalt] = useState(3);
  const [exercise, setExercise] = useState(3);

  const currentRisk = 18;
  const projectedRisk = useMemo(() => {
    const stepEffect = Math.max(0, (steps - 4000) / 4000) * 1.3;
    const saltEffect = Math.max(0, 5 - salt) * 0.9;
    const exerciseEffect = exercise * 0.85;
    const value = currentRisk - stepEffect - saltEffect - exerciseEffect;
    return Math.max(7, Math.round(value * 10) / 10);
  }, [steps, salt, exercise]);

  const currentCategory = riskCategory(currentRisk);
  const projectedCategory = riskCategory(projectedRisk);
  const isUnsafeScenario = steps > 20000 || exercise > 6;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950 lg:grid lg:grid-cols-[280px_1fr]">
      <PatientSidebar activePage={activePage} onChange={setActivePage} />

      <section className="min-w-0 px-5 py-5 lg:px-8">
        <TopBar onLogout={onLogout} />

        <div className="mt-7">
          {activePage === "dashboard" ? (
            <Dashboard
              currentRisk={currentRisk}
              currentCategory={currentCategory}
              setActivePage={setActivePage}
            />
          ) : null}
          {activePage === "risk" ? (
            <RiskExplorer currentRisk={currentRisk} currentCategory={currentCategory} />
          ) : null}
          {activePage === "action" ? <ActionPlan /> : null}
          {activePage === "simulator" ? (
            <Simulator
              currentRisk={currentRisk}
              currentCategory={currentCategory}
              projectedRisk={projectedRisk}
              projectedCategory={projectedCategory}
              steps={steps}
              setSteps={setSteps}
              salt={salt}
              setSalt={setSalt}
              exercise={exercise}
              setExercise={setExercise}
              isUnsafeScenario={isUnsafeScenario}
            />
          ) : null}
          {activePage === "goals" ? <Goals /> : null}
          {activePage === "reminders" ? <Reminders /> : null}
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

function TopBar({ onLogout }: { onLogout?: () => void }) {
  return (
    <header className="flex flex-col gap-4 rounded-[24px] border border-white bg-white/80 px-5 py-5 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          <HeartPulse className="h-4 w-4" />
          Personalized cardiovascular disease monitoring
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
          Welcome back, Heng Wen
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          Review your risk result, understand the main contributors, and track safer lifestyle goals.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-2 pl-2 pr-5 shadow-sm">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-cyan-700 font-bold text-white">
            HW
          </div>
          <div>
            <strong className="block text-sm text-slate-900">General User</strong>
            <span className="block text-xs text-slate-500">Last assessment: 14 May 2026</span>
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
  setActivePage,
}: {
  currentRisk: number;
  currentCategory: RiskCategory;
  setActivePage: (page: PatientTab) => void;
}) {
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
        <TopRiskFactors compact />
        <ActionPlan compact />
        <GoalSummary />
        <ReminderSummary />
      </div>
    </section>
  );
}

function RiskExplorer({
  currentRisk,
  currentCategory,
}: {
  currentRisk: number;
  currentCategory: RiskCategory;
}) {
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

        <TopRiskFactors />
      </div>
    </section>
  );
}

function TopRiskFactors({ compact = false }: { compact?: boolean }) {
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
        {riskFactors.map((factor) => (
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

function Simulator({
  currentRisk,
  currentCategory,
  projectedRisk,
  projectedCategory,
  steps,
  setSteps,
  salt,
  setSalt,
  exercise,
  setExercise,
  isUnsafeScenario,
}: {
  currentRisk: number;
  currentCategory: RiskCategory;
  projectedRisk: number;
  projectedCategory: RiskCategory;
  steps: number;
  setSteps: (value: number) => void;
  salt: number;
  setSalt: (value: number) => void;
  exercise: number;
  setExercise: (value: number) => void;
  isUnsafeScenario: boolean;
}) {
  const reduction = Math.round((currentRisk - projectedRisk) * 10) / 10;

  return (
    <section className="grid gap-6">
      <SectionTitle
        label="What-if lifestyle simulator"
        title="Explore safe lifestyle scenarios"
        description="Adjust lifestyle behaviours to see an estimated change in your projected CVD risk."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
        <Card className="grid content-start gap-5 p-6">
          <CardHeader title="Create scenario" />
          <SliderControl label="Daily steps" value={steps} min={3000} max={30000} step={500} unit="steps" onChange={setSteps} />
          <SliderControl label="Salt intake level" value={salt} min={1} max={5} step={1} unit="/ 5" onChange={setSalt} helper="1 = low salt, 5 = high salt" />
          <SliderControl label="Exercise sessions per week" value={exercise} min={0} max={7} step={1} unit="sessions" onChange={setExercise} />

          {isUnsafeScenario ? (
            <Notice tone="danger">
              This scenario may be too difficult, unrealistic, or unsafe. Consider choosing a more gradual target.
            </Notice>
          ) : null}
        </Card>

        <Card className="p-6">
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
            <ResultBox title="Current" value={currentRisk} category={currentCategory} />
            <ArrowRight className="justify-self-center text-cyan-700 md:h-8 md:w-8" />
            <ResultBox title="Projected" value={projectedRisk} category={projectedCategory} />
          </div>

          <div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50 p-5">
            <p className="text-slate-600">Estimated risk change</p>
            <h3 className="mt-1 text-4xl font-bold tracking-tight text-emerald-700">
              {reduction > 0 ? `-${reduction}%` : "No reduction"}
            </h3>
            <span className="mt-2 block text-slate-600">Most impactful change: increasing physical activity</span>
          </div>

          <Notice tone="soft">Projected risk is an estimate and not a guaranteed medical outcome.</Notice>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ScenarioCard title="Scenario A" desc="Walk 8,000 steps daily" risk="15.4%" />
        <ScenarioCard title="Scenario B" desc="Walk and reduce salt intake" risk="13.8%" selected />
        <ScenarioCard title="Scenario C" desc="Exercise 5 times per week" risk="14.2%" />
      </div>
    </section>
  );
}

function Goals() {
  return (
    <section className="grid gap-6">
      <SectionTitle
        label="Goal setting"
        title="Track your health goals"
        description="Create goals from recommended action plan items and update progress over time."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Active goals" />
          <div className="mt-5 grid gap-4">
            {goals.map((goal) => <ProgressItem key={goal.title} item={goal} />)}
          </div>
        </Card>

        <FormCard title="Create new goal" buttonLabel="Create goal">
          <FormLabel label="Goal title">
            <input className="form-input" placeholder="e.g. Walk 8,000 steps daily" />
          </FormLabel>
          <FormLabel label="Linked action plan">
            <select className="form-input">
              <option>Increase physical activity</option>
              <option>Reduce salt intake</option>
              <option>Monitor blood pressure</option>
            </select>
          </FormLabel>
          <FormLabel label="Target date">
            <input className="form-input" type="date" />
          </FormLabel>
        </FormCard>
      </div>
    </section>
  );
}

function Reminders() {
  return (
    <section className="grid gap-6">
      <SectionTitle
        label="Reminder management"
        title="Upcoming health reminders"
        description="Link reminders to goals, action plan items, or follow-up activities."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="grid gap-4">
            {reminders.map((reminder) => (
              <article key={reminder.title} className="flex gap-4 rounded-[20px] border border-slate-200 bg-white p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold tracking-tight text-slate-900">{reminder.title}</h3>
                  <p className="mt-1 text-slate-600">{reminder.time}</p>
                  <span className="mt-2 block text-sm text-slate-500">Linked to: {reminder.linked}</span>
                </div>
              </article>
            ))}
          </div>
        </Card>

        <FormCard title="Create reminder" buttonLabel="Create reminder">
          <FormLabel label="Reminder title">
            <input className="form-input" placeholder="e.g. Evening walk" />
          </FormLabel>
          <FormLabel label="Related goal">
            <select className="form-input">
              <option>Walk 8,000 steps daily</option>
              <option>Reduce salty food</option>
              <option>Blood pressure check</option>
            </select>
          </FormLabel>
          <FormLabel label="Repeat">
            <select className="form-input">
              <option>Daily</option>
              <option>Weekly</option>
              <option>Once</option>
            </select>
          </FormLabel>
        </FormCard>
      </div>
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

function GoalSummary() {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <CardHeader title="Active goals" subtitle="Progress" />
        <Button variant="ghost">Manage</Button>
      </div>
      <div className="grid gap-4">
        {goals.slice(0, 2).map((goal) => <ProgressItem key={goal.title} item={goal} compact />)}
      </div>
    </Card>
  );
}

function ReminderSummary() {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <CardHeader title="Reminders" subtitle="Today" />
        <Button variant="ghost">Manage</Button>
      </div>
      <div className="grid gap-3">
        {reminders.slice(0, 2).map((reminder) => (
          <div key={reminder.title} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <strong className="block text-sm text-slate-900">{reminder.title}</strong>
              <p className="mt-1 text-xs text-slate-500">{reminder.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
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

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  helper?: string;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <span className="font-bold text-slate-700">{label}</span>
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
      {helper ? <small className="text-slate-500">{helper}</small> : null}
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
        <StatusBadge tone={category.tone}>{category.label}</StatusBadge>
      </div>
    </div>
  );
}

function ScenarioCard({
  title,
  desc,
  risk,
  selected = false,
}: {
  title: string;
  desc: string;
  risk: string;
  selected?: boolean;
}) {
  return (
    <article className={`rounded-[22px] border p-5 ${selected ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"}`}>
      <span className="text-xs font-bold uppercase tracking-wide text-cyan-700">{title}</span>
      <h3 className="mt-2 font-bold tracking-tight text-slate-900">{desc}</h3>
      <p className="mt-2 text-slate-600">Projected risk: {risk}</p>
    </article>
  );
}

function ProgressItem({ item, compact = false }: { item: Goal; compact?: boolean }) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold tracking-tight text-slate-900">{item.title}</h3>
          {!compact ? <p className="mt-1 text-sm text-slate-500">Linked to: {item.linked}</p> : null}
        </div>
        <strong className="text-slate-950">{item.progress}%</strong>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-cyan-600" style={{ width: `${item.progress}%` }} />
      </div>
    </article>
  );
}

function FormCard({
  title,
  buttonLabel,
  children,
}: {
  title: string;
  buttonLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="grid content-start gap-4 p-6">
      <CardHeader title={title} />
      {children}
      <Button className="w-full">
        {buttonLabel}
        <CheckCircle2 className="h-4 w-4" />
      </Button>
    </Card>
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
