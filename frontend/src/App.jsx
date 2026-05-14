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

  const projectedCategory = riskCategory(projectedRisk);
  const currentCategory = riskCategory(currentRisk);
  const isUnsafeScenario = steps > 20000 || exercise > 6;

  return (
    <div className="app-shell">
      <style>{styles}</style>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">♥</div>
          <div>
            <h1>CardioGuide</h1>
            <p>XAI health monitoring</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => setActivePage(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <strong>Safety note</strong>
          <span>This platform supports health awareness and does not replace medical advice.</span>
        </div>
      </aside>

      <main className="main-content">
        <TopBar />
        {activePage === "dashboard" && <Dashboard currentRisk={currentRisk} currentCategory={currentCategory} setActivePage={setActivePage} />}
        {activePage === "risk" && <RiskExplorer currentRisk={currentRisk} currentCategory={currentCategory} />}
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
    <header className="topbar">
      <div>
        <p className="eyebrow">Personalized cardiovascular disease monitoring</p>
        <h2>Welcome back, Heng Wen</h2>
      </div>
      <div className="profile-pill">
        <div className="avatar">HW</div>
        <div>
          <strong>Non-domain user</strong>
          <span>Last assessment: 14 May 2026</span>
        </div>
      </div>
    </header>
  );
}

function Dashboard({ currentRisk, currentCategory, setActivePage }) {
  return (
    <section className="page-section fade-in">
      <div className="hero-grid">
        <div className="card hero-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Current risk summary</p>
              <h3>Your estimated CVD risk</h3>
            </div>
            <StatusBadge tone={currentCategory.tone}>{currentCategory.label}</StatusBadge>
          </div>
          <div className="hero-content">
            <RiskGauge value={currentRisk} label={currentCategory.label} />
            <div className="risk-copy">
              <h4>{currentRisk}% estimated risk</h4>
              <p>
                Your risk is currently in the moderate range. The result is mainly influenced by blood pressure, activity level, and age group.
              </p>
              <div className="notice soft">This score is an estimate and not a medical diagnosis.</div>
              <button className="primary-btn" onClick={() => setActivePage("risk")}>View full explanation</button>
            </div>
          </div>
        </div>

        <div className="card cta-card">
          <p className="eyebrow">Next recommended step</p>
          <h3>Try a safer lifestyle scenario</h3>
          <p>Explore how realistic changes such as walking more often or reducing salt intake may affect your projected risk.</p>
          <button className="secondary-btn" onClick={() => setActivePage("simulator")}>Open simulator</button>
        </div>
      </div>

      <div className="dashboard-grid">
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
    <section className="page-section fade-in">
      <SectionTitle
        label="Risk explanation module"
        title="Understand your risk result"
        description="This page explains the risk score, risk category, and top contributing factors using non-technical language."
      />

      <div className="risk-layout">
        <div className="card centered-card">
          <RiskGauge value={currentRisk} label={currentCategory.label} size="large" />
          <StatusBadge tone={currentCategory.tone}>{currentCategory.label}</StatusBadge>
          <p>
            A moderate score means your estimated risk is not the lowest category, but several contributing factors may be improved through lifestyle changes and regular monitoring.
          </p>
          <div className="notice warning">Consult a healthcare professional if you are worried about your result or experience symptoms.</div>
        </div>

        <TopRiskFactors />
      </div>
    </section>
  );
}

function TopRiskFactors({ compact = false }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">XAI explanation</p>
          <h3>Top contributing factors</h3>
        </div>
        {compact && <button className="text-btn">Details</button>}
      </div>

      <div className="factor-list">
        {riskFactors.map((factor) => (
          <article key={factor.name} className="factor-card">
            <div className="factor-topline">
              <h4>{factor.name}</h4>
              <span className={factor.type === "Modifiable" ? "tag green" : "tag slate"}>{factor.type}</span>
            </div>
            <p>{compact ? factor.description.slice(0, 92) + "..." : factor.description}</p>
            {!compact && (
              <div className="mini-action">
                <strong>Suggested action:</strong> {factor.action}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function ActionPlan({ compact = false }) {
  return (
    <section className={compact ? "card" : "page-section fade-in no-padding"}>
      {!compact && (
        <SectionTitle
          label="Lifestyle recommendation module"
          title="Personalized action plan"
          description="Recommended actions are prioritized based on your risk category and top modifiable risk factors."
        />
      )}

      <div className={compact ? "card-header" : "hidden"}>
        <div>
          <p className="eyebrow">Recommended actions</p>
          <h3>Action plan</h3>
        </div>
        <button className="text-btn">View all</button>
      </div>

      <div className={compact ? "action-list compact" : "action-list"}>
        {actionPlans.map((plan, index) => (
          <article key={plan.title} className="action-card">
            <div className="action-index">{index + 1}</div>
            <div>
              <div className="factor-topline">
                <h4>{plan.title}</h4>
                <span className="tag amber">{plan.priority}</span>
              </div>
              <p>{plan.reason}</p>
              {!compact && (
                <div className="action-footer">
                  <span>Related factor: {plan.factor}</span>
                  <button className="secondary-btn small">Convert to goal</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Simulator({ currentRisk, currentCategory, projectedRisk, projectedCategory, steps, setSteps, salt, setSalt, exercise, setExercise, isUnsafeScenario }) {
  const reduction = Math.round((currentRisk - projectedRisk) * 10) / 10;

  return (
    <section className="page-section fade-in">
      <SectionTitle
        label="What-if lifestyle simulator"
        title="Explore safe lifestyle scenarios"
        description="Adjust lifestyle behaviours to see an estimated change in your projected CVD risk."
      />

      <div className="simulator-grid">
        <div className="card controls-card">
          <h3>Create scenario</h3>
          <SliderControl label="Daily steps" value={steps} min={3000} max={30000} step={500} unit="steps" onChange={setSteps} />
          <SliderControl label="Salt intake level" value={salt} min={1} max={5} step={1} unit="/ 5" onChange={setSalt} helper="1 = low salt, 5 = high salt" />
          <SliderControl label="Exercise sessions per week" value={exercise} min={0} max={7} step={1} unit="sessions" onChange={setExercise} />

          {isUnsafeScenario && (
            <div className="notice danger">
              This scenario may be too difficult, unrealistic, or unsafe. Consider choosing a more gradual target.
            </div>
          )}
        </div>

        <div className="card result-card">
          <div className="comparison-row">
            <ResultBox title="Current" value={currentRisk} category={currentCategory} />
            <div className="arrow">→</div>
            <ResultBox title="Projected" value={projectedRisk} category={projectedCategory} />
          </div>

          <div className="reduction-box">
            <p>Estimated risk change</p>
            <h3>{reduction > 0 ? `-${reduction}%` : "No reduction"}</h3>
            <span>Most impactful change: increasing physical activity</span>
          </div>

          <div className="notice soft">
            Projected risk is an estimate and not a guaranteed medical outcome.
          </div>
        </div>
      </div>

      <div className="scenario-row">
        <ScenarioCard title="Scenario A" desc="Walk 8,000 steps daily" risk="15.4%" />
        <ScenarioCard title="Scenario B" desc="Walk + reduce salt intake" risk="13.8%" selected />
        <ScenarioCard title="Scenario C" desc="Exercise 5 times per week" risk="14.2%" />
      </div>
    </section>
  );
}

function Goals() {
  return (
    <section className="page-section fade-in">
      <SectionTitle
        label="Goal setting"
        title="Track your health goals"
        description="Create goals from recommended action plan items and update progress over time."
      />
      <div className="two-column-grid">
        <div className="card">
          <h3>Active goals</h3>
          <div className="goal-list">
            {goals.map((goal) => <ProgressItem key={goal.title} item={goal} />)}
          </div>
        </div>

        <div className="card form-card">
          <h3>Create new goal</h3>
          <label>Goal title</label>
          <input placeholder="e.g. Walk 8,000 steps daily" />
          <label>Linked action plan</label>
          <select>
            <option>Increase physical activity</option>
            <option>Reduce salt intake</option>
            <option>Monitor blood pressure</option>
          </select>
          <label>Target date</label>
          <input type="date" />
          <button className="primary-btn full">Create goal</button>
        </div>
      </div>
    </section>
  );
}

function Reminders() {
  return (
    <section className="page-section fade-in">
      <SectionTitle
        label="Reminder management"
        title="Upcoming health reminders"
        description="Link reminders to goals, action plan items, or follow-up activities."
      />
      <div className="two-column-grid">
        <div className="card reminder-list">
          {reminders.map((reminder) => (
            <article key={reminder.title} className="reminder-card">
              <div className="reminder-icon">◷</div>
              <div>
                <h4>{reminder.title}</h4>
                <p>{reminder.time}</p>
                <span>Linked to: {reminder.linked}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="card form-card">
          <h3>Create reminder</h3>
          <label>Reminder title</label>
          <input placeholder="e.g. Evening walk" />
          <label>Related goal</label>
          <select>
            <option>Walk 8,000 steps daily</option>
            <option>Reduce salty food</option>
            <option>Blood pressure check</option>
          </select>
          <label>Repeat</label>
          <select>
            <option>Daily</option>
            <option>Weekly</option>
            <option>Once</option>
          </select>
          <button className="primary-btn full">Create reminder</button>
        </div>
      </div>
    </section>
  );
}

function CareNavigator() {
  return (
    <section className="page-section fade-in">
      <SectionTitle
        label="Virtual care navigator"
        title="Ask simple health questions"
        description="A conversational assistant can provide education and guide users on when to consult a physician."
      />

      <div className="chat-layout">
        <div className="card chat-card">
          <div className="chat-message bot">
            <strong>Care Navigator</strong>
            <p>Hello! I can help explain your CVD risk result in simple language. What would you like to understand?</p>
          </div>
          <div className="suggestion-row">
            <button>What does moderate risk mean?</button>
            <button>Why is blood pressure important?</button>
            <button>When should I consult a doctor?</button>
          </div>
          <div className="chat-message user">
            <p>How can I lower my risk safely?</p>
          </div>
          <div className="chat-message bot">
            <strong>Care Navigator</strong>
            <p>Start with realistic changes, such as regular walking, lower salt intake, and consistent monitoring. For personal medical advice, consult a healthcare professional.</p>
          </div>
          <div className="chat-input">
            <input placeholder="Type your question here..." />
            <button className="primary-btn">Send</button>
          </div>
        </div>

        <div className="card guidance-card">
          <h3>When to seek help</h3>
          <p>Consider consulting a healthcare professional if:</p>
          <ul>
            <li>Your risk category is high.</li>
            <li>You are unsure how to interpret your result.</li>
            <li>You experience chest pain, shortness of breath, or severe symptoms.</li>
          </ul>
          <div className="notice soft">This navigator provides general education only.</div>
        </div>
      </div>
    </section>
  );
}

function GoalSummary() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h3>Active goals</h3>
        </div>
        <button className="text-btn">Manage</button>
      </div>
      <div className="goal-list">
        {goals.slice(0, 2).map((goal) => <ProgressItem key={goal.title} item={goal} compact />)}
      </div>
    </div>
  );
}

function ReminderSummary() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Today</p>
          <h3>Reminders</h3>
        </div>
        <button className="text-btn">Manage</button>
      </div>
      <div className="mini-list">
        {reminders.slice(0, 2).map((reminder) => (
          <div className="mini-row" key={reminder.title}>
            <span>◷</span>
            <div>
              <strong>{reminder.title}</strong>
              <p>{reminder.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskGauge({ value, label, size = "normal" }) {
  const rotation = Math.min(100, Math.max(0, value));
  return (
    <div className={`gauge ${size}`} style={{ "--value": `${rotation}%` }}>
      <div className="gauge-inner">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function StatusBadge({ tone, children }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function SectionTitle({ label, title, description }) {
  return (
    <div className="section-title">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function SliderControl({ label, value, min, max, step, unit, onChange, helper }) {
  return (
    <div className="slider-control">
      <div className="slider-label">
        <span>{label}</span>
        <strong>{value} {unit}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {helper && <small>{helper}</small>}
    </div>
  );
}

function ResultBox({ title, value, category }) {
  return (
    <div className="result-box">
      <p>{title}</p>
      <h3>{value}%</h3>
      <StatusBadge tone={category.tone}>{category.label}</StatusBadge>
    </div>
  );
}

function ScenarioCard({ title, desc, risk, selected = false }) {
  return (
    <article className={`scenario-card ${selected ? "selected" : ""}`}>
      <span>{title}</span>
      <h4>{desc}</h4>
      <p>Projected risk: {risk}</p>
    </article>
  );
}

function ProgressItem({ item, compact = false }) {
  return (
    <article className="progress-item">
      <div className="progress-topline">
        <div>
          <h4>{item.title}</h4>
          {!compact && <p>Linked to: {item.linked}</p>}
        </div>
        <strong>{item.progress}%</strong>
      </div>
      <div className="progress-track">
        <div style={{ width: `${item.progress}%` }} />
      </div>
    </article>
  );
}

const styles = `
  :root {
    --bg: #f6f8fb;
    --panel: #ffffff;
    --panel-soft: #eef9f8;
    --text: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --primary: #0f766e;
    --primary-dark: #134e4a;
    --accent: #0891b2;
    --green: #10b981;
    --green-soft: #dcfce7;
    --amber: #f59e0b;
    --amber-soft: #fef3c7;
    --red: #ef4444;
    --red-soft: #fee2e2;
    --shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    --radius-lg: 28px;
    --radius-md: 18px;
    --radius-sm: 12px;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  button, input, select {
    font: inherit;
  }

  .app-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 290px 1fr;
  }

  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    background: linear-gradient(180deg, #0f172a 0%, #134e4a 100%);
    color: white;
    padding: 28px 22px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .brand-block {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: rgba(255,255,255,0.14);
    color: #5eead4;
    font-size: 24px;
  }

  .brand-block h1 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.03em;
  }

  .brand-block p, .sidebar-note span, .profile-pill span {
    margin: 3px 0 0;
    color: rgba(255,255,255,0.68);
    font-size: 13px;
  }

  .nav-list {
    display: grid;
    gap: 8px;
  }

  .nav-item {
    border: 0;
    width: 100%;
    border-radius: 16px;
    color: rgba(255,255,255,0.72);
    background: transparent;
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 13px 14px;
    cursor: pointer;
    text-align: left;
    transition: 0.2s ease;
  }

  .nav-item span {
    width: 24px;
    height: 24px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: rgba(255,255,255,0.08);
  }

  .nav-item:hover,
  .nav-item.active {
    background: rgba(255,255,255,0.13);
    color: white;
  }

  .sidebar-note {
    margin-top: auto;
    padding: 18px;
    border-radius: 22px;
    background: rgba(255,255,255,0.1);
    display: grid;
    gap: 6px;
  }

  .main-content {
    padding: 28px;
    overflow: hidden;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 28px;
  }

  .topbar h2, .section-title h2 {
    margin: 4px 0 0;
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1.05;
    letter-spacing: -0.05em;
  }

  .profile-pill {
    border: 1px solid var(--line);
    background: white;
    border-radius: 999px;
    padding: 8px 14px 8px 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--shadow);
  }

  .profile-pill span {
    color: var(--muted);
    display: block;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--primary);
    color: white;
    font-weight: 800;
  }

  .page-section {
    display: grid;
    gap: 24px;
  }

  .no-padding { padding: 0; }

  .fade-in { animation: fadeIn 0.32s ease both; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--primary);
    font-weight: 800;
    font-size: 12px;
  }

  .section-title {
    max-width: 780px;
  }

  .section-title p:last-child {
    color: var(--muted);
    font-size: 16px;
    line-height: 1.7;
    margin: 12px 0 0;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(280px, 0.85fr);
    gap: 22px;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px;
  }

  .card {
    background: rgba(255,255,255,0.92);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 24px;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .card h3, .card h4 {
    margin: 0;
    letter-spacing: -0.025em;
  }

  .card h3 { font-size: 22px; }
  .card h4 { font-size: 16px; }
  .card p { color: var(--muted); line-height: 1.65; }

  .hero-card {
    background:
      radial-gradient(circle at top right, rgba(45, 212, 191, 0.18), transparent 28%),
      white;
  }

  .hero-content {
    display: grid;
    grid-template-columns: 210px 1fr;
    gap: 28px;
    align-items: center;
  }

  .risk-copy h4 {
    margin: 0;
    font-size: 32px;
    letter-spacing: -0.04em;
  }

  .cta-card {
    background: linear-gradient(145deg, #ecfeff, #f8fafc);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .gauge {
    --value: 18%;
    width: 178px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: conic-gradient(var(--amber) 0 var(--value), #e2e8f0 var(--value) 100%);
    padding: 16px;
    display: grid;
    place-items: center;
    box-shadow: inset 0 0 0 1px rgba(15,23,42,0.04);
  }

  .gauge.large { width: 230px; }

  .gauge-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: white;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    text-align: center;
  }

  .gauge-inner strong {
    font-size: 36px;
    letter-spacing: -0.05em;
  }

  .gauge-inner span {
    font-size: 13px;
    color: var(--muted);
    font-weight: 700;
  }

  .status-badge {
    border-radius: 999px;
    padding: 7px 11px;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status-badge.green { background: var(--green-soft); color: #047857; }
  .status-badge.amber { background: var(--amber-soft); color: #92400e; }
  .status-badge.red { background: var(--red-soft); color: #b91c1c; }

  .notice {
    border-radius: 16px;
    padding: 13px 14px;
    line-height: 1.55;
    font-size: 14px;
    margin-top: 14px;
  }

  .notice.soft { background: #eff6ff; color: #1d4ed8; }
  .notice.warning { background: var(--amber-soft); color: #92400e; }
  .notice.danger { background: var(--red-soft); color: #b91c1c; }

  .primary-btn, .secondary-btn, .text-btn {
    border: 0;
    cursor: pointer;
    border-radius: 999px;
    font-weight: 800;
    transition: 0.2s ease;
  }

  .primary-btn {
    background: var(--primary);
    color: white;
    padding: 12px 18px;
    margin-top: 18px;
  }

  .primary-btn:hover { background: var(--primary-dark); transform: translateY(-1px); }

  .secondary-btn {
    color: var(--primary-dark);
    background: #ccfbf1;
    padding: 12px 18px;
  }

  .secondary-btn.small {
    padding: 9px 13px;
    font-size: 13px;
  }

  .text-btn {
    color: var(--primary);
    background: transparent;
    padding: 6px 0;
  }

  .full { width: 100%; }

  .factor-list, .action-list, .goal-list, .mini-list {
    display: grid;
    gap: 14px;
  }

  .factor-card, .action-card, .progress-item, .reminder-card, .scenario-card {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 16px;
    background: #fff;
  }

  .factor-topline, .progress-topline, .action-footer, .slider-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .tag {
    font-size: 11px;
    font-weight: 800;
    border-radius: 999px;
    padding: 6px 9px;
  }

  .tag.green { background: var(--green-soft); color: #047857; }
  .tag.amber { background: var(--amber-soft); color: #92400e; }
  .tag.slate { background: #f1f5f9; color: #475569; }

  .mini-action {
    margin-top: 12px;
    padding: 12px;
    border-radius: 14px;
    background: #f8fafc;
    color: #475569;
    line-height: 1.5;
  }

  .risk-layout, .simulator-grid, .two-column-grid, .chat-layout {
    display: grid;
    grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.4fr);
    gap: 22px;
  }

  .centered-card {
    display: grid;
    justify-items: center;
    align-content: start;
    text-align: center;
    gap: 14px;
  }

  .action-list:not(.compact) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .action-card {
    display: flex;
    gap: 14px;
  }

  .action-index {
    min-width: 38px;
    height: 38px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: #ccfbf1;
    color: var(--primary-dark);
    font-weight: 900;
  }

  .action-footer {
    margin-top: 16px;
    color: var(--muted);
    font-size: 14px;
  }

  .hidden { display: none; }

  .controls-card { display: grid; gap: 18px; }

  .slider-control {
    display: grid;
    gap: 10px;
  }

  .slider-control input[type="range"] {
    width: 100%;
    accent-color: var(--primary);
  }

  .slider-control small {
    color: var(--muted);
  }

  .comparison-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 18px;
    align-items: center;
  }

  .result-box {
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 18px;
    text-align: center;
    background: #f8fafc;
  }

  .result-box p { margin: 0; }
  .result-box h3 { font-size: 34px; margin: 8px 0 12px; }
  .arrow { font-size: 28px; color: var(--primary); font-weight: 900; }

  .reduction-box {
    margin-top: 18px;
    border-radius: 22px;
    padding: 18px;
    background: linear-gradient(135deg, #ecfeff, #dcfce7);
  }

  .reduction-box p { margin: 0; }
  .reduction-box h3 { margin: 4px 0; font-size: 40px; color: #047857; }
  .reduction-box span { color: #475569; }

  .scenario-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .scenario-card.selected {
    border-color: #14b8a6;
    background: #f0fdfa;
  }

  .scenario-card span { color: var(--primary); font-weight: 900; font-size: 12px; text-transform: uppercase; }
  .scenario-card h4 { margin: 8px 0 6px; }
  .scenario-card p { margin: 0; }

  .progress-track {
    height: 10px;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
    margin-top: 12px;
  }

  .progress-track div {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--primary), var(--green));
  }

  .progress-item p { margin: 4px 0 0; font-size: 13px; }

  .mini-row {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px;
    border-radius: 16px;
    background: #f8fafc;
  }

  .mini-row span {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: #ccfbf1;
    color: var(--primary);
  }

  .mini-row p { margin: 2px 0 0; font-size: 13px; }

  .form-card {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .form-card label {
    font-weight: 800;
    color: #334155;
    font-size: 14px;
  }

  .form-card input, .form-card select, .chat-input input {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 15px;
    padding: 13px 14px;
    outline: none;
    background: #f8fafc;
  }

  .form-card input:focus, .form-card select:focus, .chat-input input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.1);
  }

  .reminder-list { display: grid; gap: 14px; }

  .reminder-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .reminder-icon {
    width: 42px;
    height: 42px;
    border-radius: 15px;
    background: #ccfbf1;
    color: var(--primary);
    display: grid;
    place-items: center;
    font-size: 20px;
  }

  .reminder-card p { margin: 4px 0; }
  .reminder-card span { color: var(--muted); font-size: 13px; }

  .chat-layout {
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
  }

  .chat-card {
    display: grid;
    gap: 14px;
  }

  .chat-message {
    max-width: 78%;
    border-radius: 22px;
    padding: 15px 17px;
    line-height: 1.6;
  }

  .chat-message p { margin: 4px 0 0; }
  .chat-message.bot { background: #f1f5f9; }
  .chat-message.user { background: #ccfbf1; justify-self: end; }

  .suggestion-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .suggestion-row button {
    border: 1px solid var(--line);
    background: white;
    color: var(--primary);
    border-radius: 999px;
    padding: 9px 12px;
    font-weight: 800;
  }

  .chat-input {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;
    margin-top: 10px;
  }

  .guidance-card ul {
    color: var(--muted);
    line-height: 1.8;
    padding-left: 20px;
  }

  @media (max-width: 1100px) {
    .app-shell { grid-template-columns: 1fr; }
    .sidebar {
      position: static;
      height: auto;
      border-radius: 0 0 28px 28px;
    }
    .nav-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hero-grid, .dashboard-grid, .risk-layout, .simulator-grid, .two-column-grid, .chat-layout, .action-list:not(.compact), .scenario-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .main-content { padding: 18px; }
    .topbar { align-items: flex-start; flex-direction: column; }
    .hero-content { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .card { padding: 18px; border-radius: 22px; }
    .nav-list { grid-template-columns: 1fr; }
    .comparison-row { grid-template-columns: 1fr; }
    .arrow { transform: rotate(90deg); justify-self: center; }
    .chat-message { max-width: 100%; }
  }
`;

export default App;
