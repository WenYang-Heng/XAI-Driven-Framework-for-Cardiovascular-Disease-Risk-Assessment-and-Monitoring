import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  ClipboardList,
  HeartPulse,
  LogOut,
  MessageCircle,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { API_BASE_URL } from "../domain-expert/constants";
import { ActionPlanPage } from "./action-plan/ActionPlanPage";
import { AssessmentHistoryPage, type AssessmentHistoryItem } from "./assessment-history/AssessmentHistoryPage";
import { RiskAssessment as PatientRiskAssessment } from "./assessment/RiskAssessment";
import { ChatbotContextProvider, useChatbotContext, type ChatbotPageContext } from "./chatbot/ChatbotContext";
import { VirtualCareChatbot } from "./chatbot/VirtualCareChatbot";
import { RemindersPage } from "./reminders/RemindersPage";
import { fetchReminders, type ReminderRecord } from "./reminders/reminderApi";
import { SimulatorPage } from "./simulator/SimulatorPage";

type PatientTab =
  | "assessment"
  | "risk"
  | "history"
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

type AssessmentForm = {
  age: number;
  sex: "female" | "male";
  heightCm: number;
  bpInputType: "exact" | "category" | "unknown";
  systolicBp: number;
  diastolicBp: number;
  bpCategory: "normal" | "above_normal" | "well_above_normal";
  cholesterolInputType: "exact" | "category" | "unknown";
  cholesterol: number;
  cholesterolCategory: "normal" | "above_normal" | "well_above_normal";
  glucoseInputType: "exact" | "category" | "unknown";
  glucose: number;
  glucoseCategory: "normal" | "above_normal" | "well_above_normal";
  diabetes: "no" | "prediabetes" | "yes" | "unsure";
  smoking: "no" | "yes";
  activity: "no" | "yes";
  weightKg: number;
  alcoholIntake: "yes" | "no";
  symptoms: "none" | "mild" | "urgent";
};

type PatientPrediction = {
  risk_score: number;
  risk_level: "low" | "moderate" | "high";
  confidence_level: "low" | "medium" | "high";
  prediction_method: string;
  estimated_inputs: {
    systolic_bp?: number | null;
    total_cholesterol?: number | null;
  };
  missing_inputs: string[];
  explanation: string[];
};

type CurrentUser = {
  id?: string;
  fullName?: string;
  email?: string;
};

const navItems: NavItem[] = [
  { id: "risk", label: "Risk Explorer", icon: HeartPulse },
  { id: "history", label: "Assessment History", icon: ClipboardList },
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

function riskCategory(score: number): RiskCategory {
  if (score < 25) return { label: "Low Risk", tone: "green" };
  if (score < 55) return { label: "Moderate Risk", tone: "amber" };
  return { label: "High Risk", tone: "red" };
}

function calculateDemoRisk(form: AssessmentForm) {
  let score = 4;
  score += Math.max(0, (form.age - 35) * 0.28);
  score += form.sex === "male" ? 1.8 : 0.8;
  score += form.bpInputType === "exact" ? Math.max(0, (form.systolicBp - 115) * 0.13) : 1.2;
  score += form.cholesterolInputType === "exact" ? Math.max(0, (form.cholesterol - 180) * 0.035) : 0.9;
  score += glucoseCategory(form) === "well_above_normal" ? 3.3 : glucoseCategory(form) === "above_normal" ? 1.4 : 0;
  score += form.diabetes === "yes" ? 3.2 : form.diabetes === "prediabetes" ? 1.5 : form.diabetes === "unsure" ? 0.7 : 0;
  score += form.smoking === "yes" ? 4.4 : 0;
  score += form.activity === "no" ? 3.2 : 0;
  score += bmi(form) >= 30 ? 2.4 : bmi(form) >= 25 ? 1.2 : 0;
  score += form.symptoms === "urgent" ? 5 : form.symptoms === "mild" ? 1.5 : 0;

  return Math.min(38, Math.max(5, Math.round(score * 10) / 10));
}

function buildRiskFactors(form: AssessmentForm): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (form.bpInputType === "exact" && form.systolicBp >= 130) {
    factors.push({
      name: "Blood Pressure",
      type: "Modifiable",
      impact: form.systolicBp >= 140 ? "High impact" : "Medium impact",
      description:
        "Your blood pressure reading is above the usual healthy range. Lowering it may help reduce strain on your heart and blood vessels.",
      action: "Track blood pressure, reduce salty food, and ask a healthcare professional if readings stay high.",
    });
  }

  if (form.activity === "no") {
    factors.push({
      name: "Physical Activity",
      type: "Modifiable",
      impact: "High impact",
      description:
        "Being less active can affect weight, blood pressure, cholesterol, and long-term heart health.",
      action: "Start with a realistic walking or light exercise target and increase gradually.",
    });
  }

  if (form.cholesterolInputType === "exact" && form.cholesterol >= 200) {
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
      impact: "High impact",
      description:
        "Smoking can damage blood vessels and increase the chance of cardiovascular problems.",
      action: "Consider a smoking reduction or cessation plan with proper support.",
    });
  }

  if (bmi(form) >= 25) {
    factors.push({
      name: "Weight / BMI",
      type: "Modifiable",
      impact: bmi(form) >= 30 ? "High impact" : "Medium impact",
      description:
        "Weight category can affect blood pressure, glucose control, cholesterol, and long-term cardiovascular risk.",
      action: "Focus on gradual, sustainable changes in activity, monitoring, and follow-up care.",
    });
  }

  if (form.diabetes === "yes" || glucoseCategory(form) === "well_above_normal") {
    factors.push({
      name: "Blood Sugar Control",
      type: "Modifiable",
      impact: "High impact",
      description:
        "High blood sugar or diabetes can increase the risk of blood vessel and heart problems over time.",
      action: "Track glucose if advised and discuss care targets with a healthcare professional.",
    });
  }

  if (form.age >= 55) {
    factors.push({
      name: "Age Group",
      type: "Non-modifiable",
      impact: "Medium impact",
      description:
        "This factor cannot be changed, but it helps explain why regular monitoring and healthier habits matter.",
      action: "Focus on modifiable factors such as activity, smoking, and blood pressure monitoring.",
    });
  }

  return factors.length ? factors.slice(0, 3) : riskFactors;
}

function buildSavedRiskFactors(explanation: string[] | undefined, fallback: RiskFactor[]): RiskFactor[] {
  const usableExplanations = (explanation ?? [])
    .filter((message) => message && !message.toLowerCase().includes("not a medical diagnosis"))
    .slice(0, 4);

  if (!usableExplanations.length) {
    return fallback;
  }

  return usableExplanations.map((message) => {
    const name = factorNameFromExplanation(message);
    return {
      name,
      type: name === "Age" ? "Non-modifiable" : "Modifiable",
      impact: "Model explained factor",
      description: message,
      action: actionFromFactorName(name),
    };
  });
}

function factorNameFromExplanation(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("systolic") || lower.includes("diastolic") || lower.includes("blood pressure")) {
    return "Blood Pressure";
  }
  if (lower.includes("cholesterol")) {
    return "Cholesterol";
  }
  if (lower.includes("blood sugar") || lower.includes("glucose")) {
    return "Blood Sugar";
  }
  if (lower.includes("physical activity") || lower.includes("activity")) {
    return "Physical Activity";
  }
  if (lower.includes("smoking")) {
    return "Smoking Status";
  }
  if (lower.includes("bmi") || lower.includes("weight")) {
    return "Weight / BMI";
  }
  if (lower.includes("age")) {
    return "Age";
  }
  if (lower.includes("alcohol")) {
    return "Alcohol Intake";
  }
  return "Model Factor";
}

function actionFromFactorName(name: string) {
  const actions: Record<string, string> = {
    "Blood Pressure": "Monitor blood pressure and reduce salty foods where possible.",
    Cholesterol: "Choose more fibre-rich foods and follow up on cholesterol testing if needed.",
    "Blood Sugar": "Use glucose readings from health checks and discuss unclear values with a healthcare professional.",
    "Physical Activity": "Start with regular light movement, such as walking, and increase gradually.",
    "Smoking Status": "Consider a smoking reduction or cessation plan with proper support.",
    "Weight / BMI": "Focus on gradual, sustainable changes in activity and food choices.",
    Age: "Focus on modifiable factors such as blood pressure, activity, smoking, and monitoring.",
    "Alcohol Intake": "Keep alcohol intake moderate and follow health professional guidance.",
  };
  return actions[name] ?? "Review this factor and consider a practical next step.";
}

function bmi(form: AssessmentForm) {
  return form.weightKg / ((form.heightCm / 100) ** 2);
}

function glucoseCategory(form: AssessmentForm) {
  if (form.glucoseInputType === "exact") {
    if (form.glucose >= 126) return "well_above_normal";
    if (form.glucose >= 100) return "above_normal";
    return "normal";
  }
  if (form.glucoseInputType === "category") {
    return form.glucoseCategory;
  }
  return "normal";
}

function formToPatientAssessmentPayload(form: AssessmentForm, userId: string) {
  return {
    user_id: userId,
    age: form.age,
    sex: form.sex,
    height_cm: form.heightCm,
    bp_input_type: form.bpInputType,
    systolic_bp: form.bpInputType === "exact" ? form.systolicBp : null,
    diastolic_bp: form.bpInputType === "exact" ? form.diastolicBp : null,
    bp_category: form.bpInputType === "category" ? form.bpCategory : null,
    cholesterol_input_type: form.cholesterolInputType,
    total_cholesterol: form.cholesterolInputType === "exact" ? form.cholesterol : null,
    cholesterol_category: form.cholesterolInputType === "category" ? form.cholesterolCategory : null,
    glucose_category: form.glucoseInputType === "unknown" ? "unknown" : glucoseCategory(form),
    diabetes_history: form.diabetes,
    smoking_status: form.smoking,
    activity_level: form.activity === "yes" ? "high" : "low",
    weight: form.weightKg,
    weight_category: "unsure",
    alcohol_intake: form.alcoholIntake,
  };
}

function createAssessmentDraft(): AssessmentForm {
  return {
    age: 45,
    sex: "female",
    heightCm: 165,
    bpInputType: "unknown",
    systolicBp: 120,
    diastolicBp: 80,
    bpCategory: "normal",
    cholesterolInputType: "unknown",
    cholesterol: 180,
    cholesterolCategory: "normal",
    glucoseInputType: "unknown",
    glucose: 95,
    glucoseCategory: "normal",
    diabetes: "unsure",
    smoking: "no",
    activity: "yes",
    weightKg: 70,
    alcoholIntake: "no",
    symptoms: "none",
  };
}

async function loadAssessmentHistory(userId: string): Promise<AssessmentHistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/patient-assessments/history/${userId}`);
  if (!response.ok) {
    throw new Error("Unable to load assessment history.");
  }
  const data = await response.json();
  return data.items ?? [];
}

async function loadReminders(userId: string): Promise<ReminderRecord[]> {
  return fetchReminders(userId);
}

function historyItemToPrediction(item: AssessmentHistoryItem): PatientPrediction {
  return {
    risk_score: Number(item.risk_score ?? 0),
    risk_level: item.risk_category,
    confidence_level: item.confidence_level,
    prediction_method: item.prediction_method ?? "patient_screening",
    estimated_inputs: item.estimated_inputs ?? {
      systolic_bp: item.systolic_bp ?? null,
      total_cholesterol: item.total_cholesterol ?? null,
    },
    missing_inputs: item.missing_inputs ?? [],
    explanation: item.explanation ?? [],
  };
}

export function PatientDashboard({ currentUser, onLogout }: { currentUser?: CurrentUser | null; onLogout?: () => void }) {
  const [activePage, setActivePage] = useState<PatientTab>("risk");
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessment, setAssessment] = useState<AssessmentForm>(() => createAssessmentDraft());
  const [hasAssessment, setHasAssessment] = useState(false);
  const [latestPrediction, setLatestPrediction] = useState<PatientPrediction | null>(null);
  const [latestAssessmentId, setLatestAssessmentId] = useState<string | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentHistoryItem[]>([]);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [isAssessmentHistoryLoading, setIsAssessmentHistoryLoading] = useState(Boolean(currentUser?.id));
  const userId = currentUser?.id;

  const previewRisk = useMemo(() => calculateDemoRisk(assessment), [assessment]);
  const currentRisk = latestPrediction ? Math.round(latestPrediction.risk_score * 1000) / 10 : previewRisk;
  const formRiskFactors = useMemo(() => buildRiskFactors(assessment), [assessment]);
  const personalizedRiskFactors = useMemo(
    () => buildSavedRiskFactors(latestPrediction?.explanation, formRiskFactors),
    [formRiskFactors, latestPrediction],
  );

  const currentCategory = riskCategory(currentRisk);
  const chatbotPageContext = useMemo<ChatbotPageContext>(() => {
    const topFactors = personalizedRiskFactors.map((factor) => factor.name);

    if (activePage === "assessment") {
      return {
        page: "assessment_form",
        available_inputs: [
          "age",
          "sex",
          "height and weight",
          "blood pressure",
          "cholesterol",
          "blood glucose",
          "smoking status",
          "physical activity",
          "alcohol intake",
        ],
        unknown_allowed: true,
        current_step: assessmentStep,
      };
    }

    if (activePage === "risk") {
      return {
        page: "assessment_result",
        risk_score: currentRisk,
        risk_category: currentCategory.label,
        confidence_level: latestPrediction?.confidence_level ?? "unknown",
        top_factors: topFactors,
        missing_inputs: latestPrediction?.missing_inputs ?? [],
        explanation: latestPrediction?.explanation ?? [],
      };
    }

    if (activePage === "action") {
      return {
        page: "action_plan",
        risk_category: currentCategory.label,
        assessment_id: latestAssessmentId ?? assessmentHistory[0]?.assessment_id ?? null,
        top_factors: topFactors,
        action_items: personalizedRiskFactors.map((factor) => ({
          title: factor.action,
          factor: factor.name,
          priority: factor.impact,
          next_step: factor.action,
        })),
      };
    }

    if (activePage === "reminders") {
      return {
        page: "reminders",
        reminders: reminders
          .filter((reminder) => reminder.status === "scheduled")
          .slice(0, 3)
          .map((reminder) => ({
            title: reminder.title,
            status: reminder.status,
            reminder_time: reminder.reminder_time,
          })),
      };
    }

    return {
      page: "unknown",
      active_page: activePage,
      latest_risk_score: hasAssessment ? currentRisk : null,
      latest_risk_category: hasAssessment ? currentCategory.label : "not assessed",
    };
  }, [
    activePage,
    assessmentHistory,
    assessmentStep,
    currentCategory.label,
    currentRisk,
    hasAssessment,
    latestAssessmentId,
    latestPrediction,
    personalizedRiskFactors,
    reminders,
  ]);

  useEffect(() => {
    if (!userId) {
      setIsAssessmentHistoryLoading(false);
      return;
    }

    setIsAssessmentHistoryLoading(true);
    loadAssessmentHistory(userId)
      .then((items) => {
        setAssessmentHistory(items);

        const latest = items[0];
        if (!latest) {
          setHasAssessment(false);
          setLatestPrediction(null);
          setLatestAssessmentId(null);
          return;
        }

        setLatestPrediction(historyItemToPrediction(latest));
        setLatestAssessmentId(latest.assessment_id);
        setHasAssessment(true);
      })
      .catch(() => {
        setAssessmentHistory([]);
        setHasAssessment(false);
        setLatestPrediction(null);
        setLatestAssessmentId(null);
      })
      .finally(() => setIsAssessmentHistoryLoading(false));

    loadReminders(userId)
      .then(setReminders)
      .catch(() => setReminders([]));
  }, [userId]);

  const refreshReminders = async () => {
    if (!userId) {
      setReminders([]);
      return;
    }
    setReminders(await loadReminders(userId));
  };

  const updateAssessment = <Key extends keyof AssessmentForm>(
    key: Key,
    value: AssessmentForm[Key],
  ) => setAssessment((current) => ({ ...current, [key]: value }));

  const startNewAssessment = () => {
    setAssessment(createAssessmentDraft());
    setAssessmentStep(0);
    setAssessmentError(null);
    setActivePage("assessment");
  };

  const completeAssessment = async () => {
    if (!userId) {
      setAssessmentError("Sign in before saving an assessment.");
      return;
    }

    setIsAssessmentLoading(true);
    setAssessmentError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPatientAssessmentPayload(assessment, userId)),
      });

      if (!response.ok) {
        throw new Error("The patient assessment API returned an error.");
      }

      const data = await response.json();
      setLatestPrediction(data.prediction);
      setLatestAssessmentId(data.assessment_id);
      setHasAssessment(true);
      setAssessmentHistory(await loadAssessmentHistory(userId));
      setActivePage("risk");
    } catch (error) {
      setAssessmentError(error instanceof Error ? error.message : "Unable to save this assessment.");
    } finally {
      setIsAssessmentLoading(false);
    }
  };

  return (
    <ChatbotContextProvider>
      <ChatbotContextSync context={chatbotPageContext} />
      <main className="min-h-screen bg-[#F8FAFC] text-slate-950 lg:grid lg:grid-cols-[280px_1fr]">
        <PatientSidebar activePage={activePage} onChange={setActivePage} />

        <section className="min-w-0 px-5 py-5 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <TopBar onLogout={onLogout} hasAssessment={hasAssessment} />

            <div className="mt-7">
            {activePage === "assessment" ? (
              <PatientRiskAssessment
                form={assessment}
                step={assessmentStep}
                setStep={setAssessmentStep}
                updateField={updateAssessment}
                prediction={latestPrediction}
                error={assessmentError}
                isLoading={isAssessmentLoading}
                onComplete={completeAssessment}
                Notice={Notice}
                SectionTitle={SectionTitle}
              />
            ) : null}
            {activePage === "risk" ? (
              <RiskExplorer
                currentRisk={currentRisk}
                currentCategory={currentCategory}
                hasAssessment={hasAssessment}
                isAssessmentHistoryLoading={isAssessmentHistoryLoading}
                riskFactors={personalizedRiskFactors}
                onStartAssessment={startNewAssessment}
              />
            ) : null}
            {activePage === "history" ? (
              <AssessmentHistoryPage items={assessmentHistory} onStartAssessment={startNewAssessment} />
            ) : null}
            {activePage === "action" ? (
              <ActionPlanPage
                currentCategory={currentCategory}
                riskFactors={personalizedRiskFactors}
                userId={userId}
                assessmentId={latestAssessmentId ?? assessmentHistory[0]?.assessment_id ?? null}
              />
            ) : null}
            {activePage === "simulator" ? (
              <SimulatorPage currentRisk={currentRisk} currentCategory={currentCategory} />
            ) : null}
            {activePage === "reminders" ? (
              <RemindersPage userId={userId} reminders={reminders} onRefresh={refreshReminders} />
            ) : null}
            {activePage === "navigator" ? <CareNavigator /> : null}
            </div>
          </div>
        </section>
      </main>
      <VirtualCareChatbot />
    </ChatbotContextProvider>
  );
}

function ChatbotContextSync({ context }: { context: ChatbotPageContext }) {
  const { setChatbotContext } = useChatbotContext();

  useEffect(() => {
    setChatbotContext(context);
  }, [context, setChatbotContext]);

  return null;
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

function RiskExplorer({
  currentRisk,
  currentCategory,
  hasAssessment,
  isAssessmentHistoryLoading,
  riskFactors,
  onStartAssessment,
}: {
  currentRisk: number;
  currentCategory: RiskCategory;
  hasAssessment: boolean;
  isAssessmentHistoryLoading: boolean;
  riskFactors: RiskFactor[];
  onStartAssessment: () => void;
}) {
  if (isAssessmentHistoryLoading) {
    return (
      <section className="grid gap-6">
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-cyan-700">Risk Explorer</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                Loading your latest assessment
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                Checking your saved assessment history before showing your result.
              </p>
            </div>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
          </div>
        </Card>
      </section>
    );
  }

  if (!hasAssessment) {
    return (
      <section className="grid gap-6">
        <SectionTitle
          label="Risk Explorer"
          title="Start with your CVD risk assessment"
          description="Complete the guided assessment first. Your estimated risk result and explanation will appear here after submission."
        />
        <Card className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">No risk result yet</h3>
            <p className="mt-2 leading-7 text-slate-600">
              Complete the guided intake so the platform can estimate risk and explain the top contributing factors in simple language.
            </p>
          </div>
          <Button onClick={onStartAssessment}>
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
        label="Risk Explorer"
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
