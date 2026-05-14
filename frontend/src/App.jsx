import React, { useMemo, useState } from "react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "risk", label: "Risk Explorer", icon: "◔" },
  { id: "action", label: "Action Plan", icon: "✓" },
  { id: "simulator", label: "What-If Simulator", icon: "⇄" },
  { id: "goals", label: "Goals", icon: "◎" },
  { id: "reminders", label: "Reminders", icon: "◷" },
  { id: "navigator", label: "Care Navigator", icon: "✦" },
];

const riskFactors = [
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

const actionPlans = [
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

const goals = [
  { title: "Walk 8,000 steps daily", progress: 70, linked: "Physical activity" },
  { title: "Reduce salty food this week", progress: 45, linked: "Blood pressure" },
  { title: "Check blood pressure twice weekly", progress: 60, linked: "Monitoring" },
];

const reminders = [
  { title: "Evening walk", time: "Today, 6:00 PM", linked: "Walk 8,000 steps daily" },
  { title: "Blood pressure check", time: "Tomorrow, 9:00 AM", linked: "Monitoring" },
  { title: "Weekly goal review", time: "Sunday, 8:00 PM", linked: "Goal progress" },
];

function riskCategory(score) {
  if (score < 10) return { label: "Low Risk", tone: "green" };
  if (score < 20) return { label: "Moderate Risk", tone: "amber" };
  return { label: "High Risk", tone: "red" };
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
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
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[290px_1fr]">
      <aside className="sticky top-0 z-20 flex h-auto flex-col gap-7 rounded-b-[2rem] bg-gradient-to-b from-slate-950 to-teal-900 p-6 text-white lg:h-screen lg:rounded-none">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-2xl text-teal-300">
            ♥
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CardioGuide</h1>
            <p className="mt-1 text-sm text-white/65">XAI health monitoring</p>
          </div>
        </div>

        <nav className="grid gap-2 md:grid-cols-2 lg:grid-cols-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                activePage === item.id
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/10">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-3xl bg-white/10 p-5 text-sm">
          <strong className="block text-white">Safety note</strong>
          <span className="mt-2 block leading-6 text-white/65">
            This platform supports health awareness and does not replace medical advice.
          </span>
        </div>
      </aside>

      <main className="p-5 md:p-7">
        <TopBar />
        {activePage === "dashboard" && (
          <Dashboard
            currentRisk={currentRisk}
            currentCategory={currentCategory}
            setActivePage={setActivePage}
          />
        )}
        {activePage === "risk" && (
          <RiskExplorer currentRisk={currentRisk} currentCategory={currentCategory} />
        )}
        {activePage === "action" && <ActionPlan />}
        {activePage === "simulator" && (
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
        )}
        {activePage === "goals" && <Goals />}
        {activePage === "reminders" && <Reminders />}
        {activePage === "navigator" && <CareNavigator />}
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="eyebrow">Personalized cardiovascular disease monitoring</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 md:text-5xl">
          Welcome back, Heng Wen
        </h2>
      </div>
      <div className="flex w-fit items-center gap-3 rounded-full border border-slate-200 bg-white py-2 pl-2 pr-5 shadow-lg shadow-slate-200/70">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-teal-700 font-extrabold text-white">
          HW
        </div>
        <div>
          <strong className="block text-sm text-slate-900">Non-domain user</strong>
          <span className="block text-xs text-slate-500">Last assessment: 14 May 2026</span>
        </div>
      </div>
    </header>
  );
}

function Dashboard({ currentRisk, currentCategory, setActivePage }) {
  return (
    <section className="animate-fade-in grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[2fr_0.85fr]">
        <Card className="bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_28%),white]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Current risk summary</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight">Your estimated CVD risk</h3>
            </div>
            <StatusBadge tone={currentCategory.tone}>{currentCategory.label}</StatusBadge>
          </div>

          <div className="grid items-center gap-7 text-center md:grid-cols-[210px_1fr] md:text-left">
            <div className="mx-auto md:mx-0">
              <RiskGauge value={currentRisk} label={currentCategory.label} />
            </div>
            <div>
              <h4 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950">
                {currentRisk}% estimated risk
              </h4>
              <p className="mt-3 leading-7 text-slate-600">
                Your risk is currently in the moderate range. The result is mainly influenced by blood pressure, activity level, and age group.
              </p>
              <Notice tone="soft">This score is an estimate and not a medical diagnosis.</Notice>
              <button className="primary-btn" onClick={() => setActivePage("risk")}>
                View full explanation
              </button>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between bg-gradient-to-br from-cyan-50 to-white">
          <div>
            <p className="eyebrow">Next recommended step</p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight">Try a safer lifestyle scenario</h3>
            <p className="mt-4 leading-7 text-slate-600">
              Explore how realistic changes such as walking more often or reducing salt intake may affect your projected risk.
            </p>
          </div>
          <button className="secondary-btn mt-6 w-fit" onClick={() => setActivePage("simulator")}>
            Open simulator
          </button>
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

function RiskExplorer({ currentRisk, currentCategory }) {
  return (
    <section className="animate-fade-in grid gap-6">
      <SectionTitle
        label="Risk explanation module"
        title="Understand your risk result"
        description="This page explains the risk score, risk category, and top contributing factors using non-technical language."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
        <Card className="grid justify-items-center gap-4 text-center">
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

function TopRiskFactors({ compact = false }) {
  return (
    <Card>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">XAI explanation</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">Top contributing factors</h3>
        </div>
        {compact && <button className="text-btn">Details</button>}
      </div>

      <div className="grid gap-4">
        {riskFactors.map((factor) => (
          <article key={factor.name} className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="font-bold tracking-tight text-slate-900">{factor.name}</h4>
              <Tag tone={factor.type === "Modifiable" ? "green" : "slate"}>{factor.type}</Tag>
            </div>
            <p className="mt-3 leading-7 text-slate-600">
              {compact ? `${factor.description.slice(0, 92)}...` : factor.description}
            </p>
            {!compact && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <strong className="text-slate-900">Suggested action:</strong> {factor.action}
              </div>
            )}
          </article>
        ))}
      </div>
    </Card>
  );
}

function ActionPlan({ compact = false }) {
  return (
    <section className={compact ? "" : "animate-fade-in grid gap-6"}>
      {!compact && (
        <SectionTitle
          label="Lifestyle recommendation module"
          title="Personalized action plan"
          description="Recommended actions are prioritized based on your risk category and top modifiable risk factors."
        />
      )}

      <Card>
        {compact && (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Recommended actions</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight">Action plan</h3>
            </div>
            <button className="text-btn">View all</button>
          </div>
        )}

        <div className={`grid gap-4 ${compact ? "" : "xl:grid-cols-3"}`}>
          {actionPlans.map((plan, index) => (
            <article key={plan.title} className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-100 font-black text-teal-900">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-bold tracking-tight text-slate-900">{plan.title}</h4>
                  <Tag tone="amber">{plan.priority}</Tag>
                </div>
                <p className="mt-3 leading-7 text-slate-600">{plan.reason}</p>
                {!compact && (
                  <div className="mt-5 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>Related factor: {plan.factor}</span>
                    <button className="secondary-btn w-fit px-4 py-2 text-sm">Convert to goal</button>
                  </div>
                )}
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
}) {
  const reduction = Math.round((currentRisk - projectedRisk) * 10) / 10;

  return (
    <section className="animate-fade-in grid gap-6">
      <SectionTitle
        label="What-if lifestyle simulator"
        title="Explore safe lifestyle scenarios"
        description="Adjust lifestyle behaviours to see an estimated change in your projected CVD risk."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr]">
        <Card className="grid content-start gap-5">
          <h3 className="text-2xl font-bold tracking-tight">Create scenario</h3>
          <SliderControl label="Daily steps" value={steps} min={3000} max={30000} step={500} unit="steps" onChange={setSteps} />
          <SliderControl label="Salt intake level" value={salt} min={1} max={5} step={1} unit="/ 5" onChange={setSalt} helper="1 = low salt, 5 = high salt" />
          <SliderControl label="Exercise sessions per week" value={exercise} min={0} max={7} step={1} unit="sessions" onChange={setExercise} />

          {isUnsafeScenario && (
            <Notice tone="danger">
              This scenario may be too difficult, unrealistic, or unsafe. Consider choosing a more gradual target.
            </Notice>
          )}
        </Card>

        <Card>
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
            <ResultBox title="Current" value={currentRisk} category={currentCategory} />
            <div className="justify-self-center text-3xl font-black text-teal-700 md:rotate-0 rotate-90">→</div>
            <ResultBox title="Projected" value={projectedRisk} category={projectedCategory} />
          </div>

          <div className="mt-5 rounded-3xl bg-gradient-to-br from-cyan-50 to-emerald-100 p-5">
            <p className="text-slate-600">Estimated risk change</p>
            <h3 className="mt-1 text-4xl font-extrabold tracking-tight text-emerald-700">
              {reduction > 0 ? `-${reduction}%` : "No reduction"}
            </h3>
            <span className="mt-2 block text-slate-600">Most impactful change: increasing physical activity</span>
          </div>

          <Notice tone="soft">Projected risk is an estimate and not a guaranteed medical outcome.</Notice>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ScenarioCard title="Scenario A" desc="Walk 8,000 steps daily" risk="15.4%" />
        <ScenarioCard title="Scenario B" desc="Walk + reduce salt intake" risk="13.8%" selected />
        <ScenarioCard title="Scenario C" desc="Exercise 5 times per week" risk="14.2%" />
      </div>
    </section>
  );
}

function Goals() {
  return (
    <section className="animate-fade-in grid gap-6">
      <SectionTitle
        label="Goal setting"
        title="Track your health goals"
        description="Create goals from recommended action plan items and update progress over time."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="mb-5 text-2xl font-bold tracking-tight">Active goals</h3>
          <div className="grid gap-4">
            {goals.map((goal) => <ProgressItem key={goal.title} item={goal} />)}
          </div>
        </Card>

        <FormCard title="Create new goal" buttonLabel="Create goal">
          <label className="form-label">Goal title</label>
          <input className="form-input" placeholder="e.g. Walk 8,000 steps daily" />
          <label className="form-label">Linked action plan</label>
          <select className="form-input">
            <option>Increase physical activity</option>
            <option>Reduce salt intake</option>
            <option>Monitor blood pressure</option>
          </select>
          <label className="form-label">Target date</label>
          <input className="form-input" type="date" />
        </FormCard>
      </div>
    </section>
  );
}

function Reminders() {
  return (
    <section className="animate-fade-in grid gap-6">
      <SectionTitle
        label="Reminder management"
        title="Upcoming health reminders"
        description="Link reminders to goals, action plan items, or follow-up activities."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="grid gap-4">
            {reminders.map((reminder) => (
              <article key={reminder.title} className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-xl text-teal-700">
                  ◷
                </div>
                <div>
                  <h4 className="font-bold tracking-tight text-slate-900">{reminder.title}</h4>
                  <p className="mt-1 text-slate-600">{reminder.time}</p>
                  <span className="mt-2 block text-sm text-slate-500">Linked to: {reminder.linked}</span>
                </div>
              </article>
            ))}
          </div>
        </Card>

        <FormCard title="Create reminder" buttonLabel="Create reminder">
          <label className="form-label">Reminder title</label>
          <input className="form-input" placeholder="e.g. Evening walk" />
          <label className="form-label">Related goal</label>
          <select className="form-input">
            <option>Walk 8,000 steps daily</option>
            <option>Reduce salty food</option>
            <option>Blood pressure check</option>
          </select>
          <label className="form-label">Repeat</label>
          <select className="form-input">
            <option>Daily</option>
            <option>Weekly</option>
            <option>Once</option>
          </select>
        </FormCard>
      </div>
    </section>
  );
}

function CareNavigator() {
  return (
    <section className="animate-fade-in grid gap-6">
      <SectionTitle
        label="Virtual care navigator"
        title="Ask simple health questions"
        description="A conversational assistant can provide education and guide users on when to consult a physician."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <Card className="grid gap-4">
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
            <button className="primary-btn mt-0">Send</button>
          </div>
        </Card>

        <Card>
          <h3 className="text-2xl font-bold tracking-tight">When to seek help</h3>
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
    <Card>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Progress</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">Active goals</h3>
        </div>
        <button className="text-btn">Manage</button>
      </div>
      <div className="grid gap-4">
        {goals.slice(0, 2).map((goal) => <ProgressItem key={goal.title} item={goal} compact />)}
      </div>
    </Card>
  );
}

function ReminderSummary() {
  return (
    <Card>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Today</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">Reminders</h3>
        </div>
        <button className="text-btn">Manage</button>
      </div>
      <div className="grid gap-3">
        {reminders.slice(0, 2).map((reminder) => (
          <div key={reminder.title} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-teal-100 text-teal-700">◷</span>
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

function RiskGauge({ value, label, size = "normal" }) {
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
          <strong className="block text-4xl font-extrabold tracking-tight text-slate-950">{value}%</strong>
          <span className="mt-1 block text-xs font-bold text-slate-500">{label}</span>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-[1.75rem] border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-200/70 ${className}`}>
      {children}
    </div>
  );
}

function StatusBadge({ tone, children }) {
  const toneClass = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  }[tone];

  return (
    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${toneClass}`}>
      {children}
    </span>
  );
}

function Tag({ tone, children }) {
  const toneClass = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-600",
  }[tone];

  return <span className={`w-fit rounded-full px-3 py-1.5 text-[11px] font-extrabold ${toneClass}`}>{children}</span>;
}

function Notice({ tone, children }) {
  const toneClass = {
    soft: "bg-blue-50 text-blue-700",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
  }[tone];

  return <div className={`mt-4 rounded-2xl p-4 text-sm leading-6 ${toneClass}`}>{children}</div>;
}

function SectionTitle({ label, title, description }) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{label}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function SliderControl({ label, value, min, max, step, unit, onChange, helper }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <span className="font-bold text-slate-700">{label}</span>
        <strong className="text-sm text-slate-950">
          {value} {unit}
        </strong>
      </div>
      <input
        className="w-full accent-teal-700"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {helper && <small className="text-slate-500">{helper}</small>}
    </div>
  );
}

function ResultBox({ title, value, category }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
      <p className="text-slate-600">{title}</p>
      <h3 className="my-3 text-4xl font-extrabold tracking-tight text-slate-950">{value}%</h3>
      <div className="flex justify-center">
        <StatusBadge tone={category.tone}>{category.label}</StatusBadge>
      </div>
    </div>
  );
}

function ScenarioCard({ title, desc, risk, selected = false }) {
  return (
    <article className={`rounded-3xl border p-5 ${selected ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white"}`}>
      <span className="text-xs font-black uppercase tracking-wide text-teal-700">{title}</span>
      <h4 className="mt-2 font-bold tracking-tight text-slate-900">{desc}</h4>
      <p className="mt-2 text-slate-600">Projected risk: {risk}</p>
    </article>
  );
}

function ProgressItem({ item, compact = false }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-bold tracking-tight text-slate-900">{item.title}</h4>
          {!compact && <p className="mt-1 text-sm text-slate-500">Linked to: {item.linked}</p>}
        </div>
        <strong className="text-slate-950">{item.progress}%</strong>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-700 to-emerald-500"
          style={{ width: `${item.progress}%` }}
        />
      </div>
    </article>
  );
}

function FormCard({ title, buttonLabel, children }) {
  return (
    <Card className="grid content-start gap-3">
      <h3 className="mb-2 text-2xl font-bold tracking-tight">{title}</h3>
      {children}
      <button className="primary-btn w-full">{buttonLabel}</button>
    </Card>
  );
}

function ChatMessage({ sender, type, children }) {
  const isUser = type === "user";
  return (
    <div className={`max-w-[85%] rounded-3xl p-4 leading-7 ${isUser ? "justify-self-end bg-teal-100" : "bg-slate-100"}`}>
      {sender && <strong className="block text-slate-900">{sender}</strong>}
      <p className="mt-1 text-slate-600">{children}</p>
    </div>
  );
}

function SuggestionButton({ children }) {
  return (
    <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-teal-700 transition hover:border-teal-300 hover:bg-teal-50">
      {children}
    </button>
  );
}

export default App;
