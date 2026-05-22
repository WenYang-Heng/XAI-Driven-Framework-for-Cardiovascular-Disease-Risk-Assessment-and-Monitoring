import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  History,
  LogOut,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";

type MainTab =
  | "new"
  | "result"
  | "xai"
  | "rationale"
  | "history";

type XaiTab = "overview" | "shap" | "lime" | "whatif" | "global";

type AssessmentMode = "single" | "batch";

type AssessmentModel =
  | "Random Forest"
  | "XGBoost"
  | "Logistic Regression"
  | "Neural Network";

type ModelKey =
  | "random_forest"
  | "xgboost"
  | "logistic_regression"
  | "neural_network";

type ModelPerformance = {
  model_name: ModelKey;
  accuracy: number;
  precision: number;
  sensitivity_recall: number;
  specificity: number;
  f1_score: number;
  auc_roc: number;
  confusion_matrix: {
    true_negative: number;
    false_positive: number;
    false_negative: number;
    true_positive: number;
  };
};

type PatientForm = {
  patientId: string;
  age: string;
  sex: string;
  chestPain: string;
  restingBp: string;
  cholesterol: string;
  fastingBloodSugar: string;
  restingEcg: string;
  maxHeartRate: string;
  exerciseAngina: string;
  oldpeak: string;
  slope: string;
  vessels: string;
  thalassemia: string;
};

const defaultForm: PatientForm = {
  patientId: "PT-0001",
  age: "54",
  sex: "1",
  chestPain: "4",
  restingBp: "145",
  cholesterol: "242",
  fastingBloodSugar: "0",
  restingEcg: "0",
  maxHeartRate: "150",
  exerciseAngina: "0",
  oldpeak: "1.4",
  slope: "2",
  vessels: "1",
  thalassemia: "3",
};

const tabMeta: Record<
  MainTab,
  { title: string; subtitle: string; icon: typeof ClipboardList }
> = {
  new: {
    title: "New CVD Risk Assessment",
    subtitle:
      "Enter one patient's health features to generate a model-based cardiovascular risk assessment.",
    icon: ClipboardList,
  },
  result: {
    title: "Assessment Result",
    subtitle:
      "Review the generated risk score before exploring model explanations.",
    icon: Gauge,
  },
  xai: {
    title: "XAI Visualization Workspace",
    subtitle:
      "Explore local and global explanations for the generated risk assessment.",
    icon: BarChart3,
  },
  rationale: {
    title: "XAI Rationale Summary",
    subtitle:
      "LLM-generated explanation based on SHAP, LIME, and selected XAI outputs.",
    icon: Sparkles,
  },
  history: {
    title: "Assessment History",
    subtitle: "View saved assessment records and reopen previous XAI reports.",
    icon: History,
  },
};

const xaiTabs: { id: XaiTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "shap", label: "SHAP" },
  { id: "lime", label: "LIME" },
  { id: "whatif", label: "What-if" },
  { id: "global", label: "Global Insights" },
];

const modelProfiles: Record<
  AssessmentModel,
  {
    key: ModelKey;
    modelType: string;
    auc: string;
    lastTrained: string;
    recommendedUse: string;
    status: string;
  }
> = {
  "Random Forest": {
    key: "random_forest",
    modelType: "Ensemble tree classifier",
    auc: "0.91",
    lastTrained: "2026-04-18",
    recommendedUse: "Recommended for balanced accuracy and interpretability",
    status: "Ready",
  },
  XGBoost: {
    key: "xgboost",
    modelType: "Gradient-boosted tree classifier",
    auc: "0.93",
    lastTrained: "2026-04-22",
    recommendedUse: "Recommended for highest discriminative performance",
    status: "Ready",
  },
  "Logistic Regression": {
    key: "logistic_regression",
    modelType: "Regularized linear classifier",
    auc: "0.86",
    lastTrained: "2026-04-11",
    recommendedUse: "Recommended for coefficient-level clinical review",
    status: "Ready",
  },
  "Neural Network": {
    key: "neural_network",
    modelType: "Multilayer perceptron classifier",
    auc: "0.90",
    lastTrained: "2026-04-20",
    recommendedUse: "Recommended for representation-learning experiments",
    status: "Ready",
  },
};

const assessmentModelOptions = Object.keys(modelProfiles) as AssessmentModel[];

const batchTemplateColumns = [
  "age",
  "sex",
  "cp",
  "trestbps",
  "chol",
  "fbs",
  "restecg",
  "thalach",
  "exang",
  "oldpeak",
  "slope",
  "ca",
  "thal",
];

const batchTemplateRows = [
  ["55", "1", "4", "145", "220", "0", "1", "150", "1", "1.4", "2", "0", "7"],
  ["60", "1", "3", "150", "260", "1", "0", "140", "1", "2.1", "2", "1", "7"],
];

const batchTemplateCsv = [
  batchTemplateColumns.join(","),
  ...batchTemplateRows.map((row) => row.join(",")),
].join("\n");

// import.meta.env is not typed in some TS configs; cast to any to access Vite env vars
const ML_API_BASE_URL = (import.meta as any).env?.VITE_ML_API_URL ?? "http://localhost:8001";

const fallbackModelPerformance: Record<AssessmentModel, ModelPerformance> = {
  "Random Forest": {
    model_name: "random_forest",
    accuracy: 0.85,
    precision: 0.86,
    sensitivity_recall: 0.84,
    specificity: 0.86,
    f1_score: 0.85,
    auc_roc: 0.91,
    confusion_matrix: {
      true_negative: 25,
      false_positive: 4,
      false_negative: 5,
      true_positive: 27,
    },
  },
  XGBoost: {
    model_name: "xgboost",
    accuracy: 0.87,
    precision: 0.88,
    sensitivity_recall: 0.86,
    specificity: 0.88,
    f1_score: 0.87,
    auc_roc: 0.93,
    confusion_matrix: {
      true_negative: 26,
      false_positive: 3,
      false_negative: 4,
      true_positive: 28,
    },
  },
  "Logistic Regression": {
    model_name: "logistic_regression",
    accuracy: 0.81,
    precision: 0.82,
    sensitivity_recall: 0.81,
    specificity: 0.82,
    f1_score: 0.81,
    auc_roc: 0.86,
    confusion_matrix: {
      true_negative: 24,
      false_positive: 5,
      false_negative: 6,
      true_positive: 26,
    },
  },
  "Neural Network": {
    model_name: "neural_network",
    accuracy: 0.84,
    precision: 0.85,
    sensitivity_recall: 0.83,
    specificity: 0.85,
    f1_score: 0.84,
    auc_roc: 0.9,
    confusion_matrix: {
      true_negative: 25,
      false_positive: 4,
      false_negative: 5,
      true_positive: 27,
    },
  },
};

const contributionData = [
  { feature: "Cholesterol", value: 0.31 },
  { feature: "Resting Blood Pressure", value: 0.24 },
  { feature: "Age", value: 0.18 },
  { feature: "Exercise-Induced Angina", value: 0.12 },
  { feature: "Maximum Heart Rate", value: -0.09 },
];

const shapSteps = [
  { label: "Base value", value: 0.38, tone: "slate" },
  { label: "+ Cholesterol", value: 0.31, tone: "red" },
  { label: "+ Resting BP", value: 0.24, tone: "orange" },
  { label: "+ Age", value: 0.18, tone: "amber" },
  { label: "+ Exercise-Induced Angina", value: 0.12, tone: "purple" },
  { label: "- Maximum Heart Rate", value: -0.09, tone: "green" },
  { label: "Final output", value: 0.82, tone: "cyan" },
];

const globalImportance = [
  { feature: "age", importance: 0.28 },
  { feature: "cholesterol", importance: 0.34 },
  { feature: "resting BP", importance: 0.25 },
  { feature: "thalach", importance: 0.19 },
  { feature: "oldpeak", importance: 0.22 },
];

const pdpData = [
  { cholesterol: 170, risk: 0.38 },
  { cholesterol: 195, risk: 0.46 },
  { cholesterol: 220, risk: 0.57 },
  { cholesterol: 245, risk: 0.72 },
  { cholesterol: 270, risk: 0.81 },
  { cholesterol: 295, risk: 0.88 },
];

const iceData = [
  { cholesterol: 170, p1: 0.32, p2: 0.41, p3: 0.48 },
  { cholesterol: 200, p1: 0.43, p2: 0.52, p3: 0.56 },
  { cholesterol: 230, p1: 0.55, p2: 0.62, p3: 0.68 },
  { cholesterol: 260, p1: 0.66, p2: 0.75, p3: 0.79 },
  { cholesterol: 290, p1: 0.73, p2: 0.82, p3: 0.87 },
];

const historyRows = [
  {
    id: "A-1001",
    patient: "PT-0001",
    score: "82%",
    category: "High",
    model: "RF v1.2",
    date: "2026-05-12",
    status: "Saved",
  },
  {
    id: "A-1002",
    patient: "PT-0002",
    score: "63%",
    category: "Moderate",
    model: "RF v1.2",
    date: "2026-05-11",
    status: "Saved",
  },
  {
    id: "A-1003",
    patient: "PT-0003",
    score: "34%",
    category: "Low",
    model: "RF v1.2",
    date: "2026-05-10",
    status: "Saved",
  },
];

const batchRows = [
  {
    row: 7,
    patient: "CSV-0007",
    score: 0.91,
    category: "High",
    status: "Success",
    keySignal: "ST depression and thalassemia defect category",
    inputSummary: [
      ["Age", "61"],
      ["Sex", "Male"],
      ["Chest Pain Type", "Asymptomatic"],
      ["Resting BP", "152 mmHg"],
      ["Cholesterol", "268 mg/dL"],
      ["Max Heart Rate", "132"],
      ["Exercise-Induced Angina", "Yes"],
      ["Oldpeak", "2.8"],
      ["Major Vessels", "2"],
      ["Thalassemia", "Reversible defect"],
    ],
    explanations: [
      "ST depression during exercise contributed to the risk estimate.",
      "Thalassemia defect category contributed to the risk estimate.",
      "More colored major vessels contributed to the risk estimate.",
    ],
  },
  {
    row: 18,
    patient: "CSV-0018",
    score: 0.86,
    category: "High",
    status: "Success",
    keySignal: "Exercise-induced angina and asymptomatic chest pain",
    inputSummary: [
      ["Age", "58"],
      ["Sex", "Male"],
      ["Chest Pain Type", "Asymptomatic"],
      ["Resting BP", "148 mmHg"],
      ["Cholesterol", "244 mg/dL"],
      ["Max Heart Rate", "140"],
      ["Exercise-Induced Angina", "Yes"],
      ["Oldpeak", "2.1"],
      ["Major Vessels", "1"],
      ["Thalassemia", "Reversible defect"],
    ],
    explanations: [
      "Exercise induced angina increased the risk estimate.",
      "Asymptomatic chest pain type is associated with higher disease risk in this dataset.",
      "ST depression during exercise contributed to the risk estimate.",
    ],
  },
  {
    row: 42,
    patient: "CSV-0042",
    score: 0.74,
    category: "High",
    status: "Success",
    keySignal: "Elevated blood pressure and high cholesterol",
    inputSummary: [
      ["Age", "64"],
      ["Sex", "Female"],
      ["Chest Pain Type", "Non-anginal pain"],
      ["Resting BP", "156 mmHg"],
      ["Cholesterol", "281 mg/dL"],
      ["Max Heart Rate", "137"],
      ["Exercise-Induced Angina", "No"],
      ["Oldpeak", "1.6"],
      ["Major Vessels", "1"],
      ["Thalassemia", "Normal"],
    ],
    explanations: [
      "Elevated resting blood pressure contributed to the risk estimate.",
      "High cholesterol contributed to the risk estimate.",
      "ST depression during exercise contributed to the risk estimate.",
    ],
  },
  {
    row: 63,
    patient: "CSV-0063",
    score: 0.62,
    category: "Moderate",
    status: "Success",
    keySignal: "Oldpeak and resting ECG abnormality",
    inputSummary: [
      ["Age", "52"],
      ["Sex", "Male"],
      ["Chest Pain Type", "Atypical angina"],
      ["Resting BP", "138 mmHg"],
      ["Cholesterol", "226 mg/dL"],
      ["Max Heart Rate", "149"],
      ["Exercise-Induced Angina", "No"],
      ["Oldpeak", "1.4"],
      ["Major Vessels", "0"],
      ["Thalassemia", "Normal"],
    ],
    explanations: [
      "ST depression during exercise contributed to the risk estimate.",
      "Resting ECG abnormality was present in this row.",
    ],
  },
  {
    row: 74,
    patient: "CSV-0074",
    score: 0,
    category: "Failed",
    status: "Failed",
    keySignal: "Invalid thal value; expected 3, 6, or 7",
    inputSummary: [],
    explanations: ["This row failed validation and was not assessed."],
  },
];

const batchRiskDistribution = [
  { level: "High", count: 24, fill: "#ef4444" },
  { level: "Moderate", count: 51, fill: "#f59e0b" },
  { level: "Low", count: 21, fill: "#10b981" },
  { level: "Failed", count: 4, fill: "#94a3b8" },
];

const batchDriverData = [
  { feature: "oldpeak", value: 0.29 },
  { feature: "cp", value: 0.24 },
  { feature: "thal", value: 0.21 },
  { feature: "ca", value: 0.18 },
  { feature: "exang", value: 0.15 },
];

export function DomainExpertDashboard({
  onLogout,
}: {
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<MainTab>("new");
  const [activeXaiTab, setActiveXaiTab] = useState<XaiTab>("overview");
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("single");
  const [selectedBatchRow, setSelectedBatchRow] = useState(batchRows[0]);
  const [form, setForm] = useState<PatientForm>(defaultForm);
  const [selectedModel, setSelectedModel] =
    useState<AssessmentModel>("Random Forest");
  const [modelPerformance, setModelPerformance] = useState<ModelPerformance>(
    fallbackModelPerformance["Random Forest"],
  );
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  const current = tabMeta[activeTab];
  const selectedModelKey = modelProfiles[selectedModel].key;

  useEffect(() => {
    const controller = new AbortController();

    async function loadModelPerformance() {
      setIsPerformanceLoading(true);
      setPerformanceError(null);

      try {
        const response = await fetch(
          `${ML_API_BASE_URL}/api/v1/models/${selectedModelKey}/metrics`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("The ML metrics API returned an error.");
        }

        const data = (await response.json()) as ModelPerformance;
        setModelPerformance(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setModelPerformance(fallbackModelPerformance[selectedModel]);
        setPerformanceError("Showing sample metrics until the ML API is running.");
      } finally {
        setIsPerformanceLoading(false);
      }
    }

    loadModelPerformance();

    return () => controller.abort();
  }, [selectedModel, selectedModelKey]);

  const patientSummary = useMemo(
    () => [
      ["Age", form.age],
      ["Sex", form.sex === "1" ? "Male" : "Female"],
      ["Chest Pain Type", "Asymptomatic"],
      ["Resting BP", `${form.restingBp} mmHg`],
      ["Cholesterol", `${form.cholesterol} mg/dL`],
      ["Max Heart Rate", form.maxHeartRate],
      ["Exercise-Induced Angina", form.exerciseAngina === "1" ? "Yes" : "No"],
      ["Oldpeak", form.oldpeak],
      ["Major Vessels", form.vessels],
      ["Thalassemia", "Normal"],
    ],
    [form],
  );

  function updateField(field: keyof PatientForm, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onChange={setActiveTab} />

        <section className="min-w-0 flex-1 px-5 py-5 lg:px-8">
          <TopHeader title={current.title} subtitle={current.subtitle} onLogout={onLogout} />

          <div className="mt-7">
            {activeTab === "new" ? (
              <NewAssessment
                form={form}
                selectedModel={selectedModel}
                modelPerformance={modelPerformance}
                isPerformanceLoading={isPerformanceLoading}
                assessmentMode={assessmentMode}
                onAssessmentModeChange={setAssessmentMode}
                onModelChange={setSelectedModel}
                updateField={updateField}
                onRun={() => setActiveTab("result")}
                onRunBatch={() => setActiveTab("result")}
                onClear={() => setForm(defaultForm)}
              />
            ) : null}
            {activeTab === "result" ? (
              assessmentMode === "batch" ? (
                <BatchAssessmentResult
                  selectedModel={selectedModel}
                  selectedRow={selectedBatchRow}
                  onSelectRow={setSelectedBatchRow}
                  onViewXai={(row) => {
                    setSelectedBatchRow(row);
                    setActiveTab("xai");
                  }}
                />
              ) : (
                <AssessmentResult
                  patientSummary={patientSummary}
                  selectedModel={selectedModel}
                  modelPerformance={modelPerformance}
                  isPerformanceLoading={isPerformanceLoading}
                  performanceError={performanceError}
                  onViewXai={() => setActiveTab("xai")}
                />
              )
            ) : null}
            {activeTab === "xai" ? (
              assessmentMode === "batch" ? (
                <BatchXaiWorkspace
                  selectedModel={selectedModel}
                  selectedRow={selectedBatchRow}
                  onGenerateSummary={() => setActiveTab("rationale")}
                />
              ) : (
                <XaiWorkspace
                  activeXaiTab={activeXaiTab}
                  setActiveXaiTab={setActiveXaiTab}
                  onGenerateSummary={() => setActiveTab("rationale")}
                />
              )
            ) : null}
            {activeTab === "rationale" ? (
              assessmentMode === "batch" ? (
                <BatchRationaleSummary selectedModel={selectedModel} />
              ) : (
                <RationaleSummary />
              )
            ) : null}
            {activeTab === "history" ? (
              <AssessmentHistory onViewReport={() => setActiveTab("rationale")} />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({
  activeTab,
  onChange,
}: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const items = Object.entries(tabMeta) as [MainTab, (typeof tabMeta)[MainTab]][];

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="rounded-[22px] bg-slate-950 p-5 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/20 text-cyan-200">
          <Activity className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">CardioXAI</h1>
        <p className="mt-1 text-sm text-slate-300">Domain Expert Workspace</p>
      </div>

      <nav className="mt-5 space-y-2">
        {items.map(([id, item]) => {
          const Icon = item.icon;
          const selected = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                selected
                  ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.title
                .replace("New CVD Risk Assessment", "New Assessment")
                .replace("XAI Visualization Workspace", "XAI Visualization")
                .replace("XAI Rationale Summary", "Rationale Summary")}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function TopHeader({
  title,
  subtitle,
  onLogout,
}: {
  title: string;
  subtitle: string;
  onLogout?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-[24px] border border-white bg-white/80 px-5 py-5 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          <Stethoscope className="h-4 w-4" />
          Research Interface
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="purple" className="w-fit">
          Domain Expert
        </Badge>
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

function NewAssessment({
  form,
  selectedModel,
  modelPerformance,
  isPerformanceLoading,
  assessmentMode,
  onAssessmentModeChange,
  onModelChange,
  updateField,
  onRun,
  onRunBatch,
  onClear,
}: {
  form: PatientForm;
  selectedModel: AssessmentModel;
  modelPerformance: ModelPerformance;
  isPerformanceLoading: boolean;
  assessmentMode: AssessmentMode;
  onAssessmentModeChange: (mode: AssessmentMode) => void;
  onModelChange: (model: AssessmentModel) => void;
  updateField: (field: keyof PatientForm, value: string) => void;
  onRun: () => void;
  onRunBatch: () => void;
  onClear: () => void;
}) {
  const selectedModelProfile = modelProfiles[selectedModel];
  const [batchFileName, setBatchFileName] = useState<string | null>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card className="p-6">
        <CardHeader
          title="New Assessment Setup"
          subtitle="Choose a single patient assessment or upload a CSV file using the model feature schema."
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <AssessmentModeCard
            active={assessmentMode === "single"}
            icon={ClipboardList}
            title="Single Patient Data Entry"
            description="Enter one patient's clinical features and run an individual risk assessment."
            onClick={() => onAssessmentModeChange("single")}
          />
          <AssessmentModeCard
            active={assessmentMode === "batch"}
            icon={FileSpreadsheet}
            title="Batch CSV Assessment"
            description="Upload a CSV file with the required model features for row-by-row assessment."
            onClick={() => onAssessmentModeChange("batch")}
          />
        </section>

        <section className="mt-6 rounded-[22px] border border-cyan-100 bg-gradient-to-br from-cyan-50/80 via-white to-white p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                    Controlled Research Configuration
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-950">
                    Model Configuration
                  </h3>
                </div>
              </div>

              <div className="mt-5 max-w-sm">
                <SelectField
                  label="Assessment Model"
                  value={selectedModel}
                  onChange={(value) => onModelChange(value as AssessmentModel)}
                  options={assessmentModelOptions.map((model) => [model, model])}
                />
              </div>
            </div>

            <div className="w-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm lg:max-w-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-950">
                    {selectedModel}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {selectedModelProfile.modelType}
                  </p>
                </div>
                <Badge tone="cyan">
                  AUC: {isPerformanceLoading ? "..." : formatMetric(modelPerformance.auc_roc)}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Last trained
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {selectedModelProfile.lastTrained}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Recommended use case
                  </p>
                  <p className="mt-1 font-medium leading-5 text-slate-700">
                    {selectedModelProfile.recommendedUse}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 rounded-2xl border border-cyan-100 bg-white/70 px-4 py-3 text-sm leading-6 text-cyan-800">
            The selected model will be used to generate the risk score, risk
            category, and XAI explanations for this assessment.
          </p>
        </section>

        {assessmentMode === "single" ? (
          <SinglePatientEntry form={form} updateField={updateField} />
        ) : (
          <BatchAssessmentEntry
            fileName={batchFileName}
            onFileSelected={setBatchFileName}
          />
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="max-w-xl text-sm text-slate-500">
            This system provides risk assessment support and does not provide
            medical diagnosis.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onClear}>
              <RotateCcw className="h-4 w-4" />
              Clear Form
            </Button>
            <Button
              disabled={assessmentMode === "batch" && !batchFileName}
              onClick={assessmentMode === "single" ? onRun : onRunBatch}
            >
              {assessmentMode === "single" ? (
                <Gauge className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {assessmentMode === "single" ? "Run Assessment" : "Run Batch Assessment"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="h-fit p-6">
        <CardHeader title="Input Validation Summary" />
        <div className="mt-5 space-y-3">
          {[
            "Required features: 13 / 13",
            assessmentMode === "single" ? "Missing values: 0" : `Selected file: ${batchFileName ?? "None"}`,
            assessmentMode === "single" ? "Invalid range warnings: 0" : "Accepted formats: CSV",
            `Selected model: ${selectedModel}`,
            `Model status: ${selectedModelProfile.status}`,
            assessmentMode === "single" || batchFileName
              ? "Status: Ready for assessment"
              : "Status: Waiting for CSV upload",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-[20px] border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-800">
          Input values will be formatted according to the same feature schema
          used during model training.
        </div>
      </Card>
    </div>
  );
}

function AssessmentModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof ClipboardList;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-5 text-left transition focus:outline-none focus:ring-4 focus:ring-cyan-100 ${
        active
          ? "border-cyan-300 bg-cyan-50 text-cyan-950 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            active ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

function SinglePatientEntry({
  form,
  updateField,
}: {
  form: PatientForm;
  updateField: (field: keyof PatientForm, value: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <TextField
        label="Patient Reference ID"
        value={form.patientId}
        onChange={(value) => updateField("patientId", value)}
      />
      <TextField
        label="Age"
        type="number"
        value={form.age}
        onChange={(value) => updateField("age", value)}
      />
      <SelectField
        label="Sex"
        value={form.sex}
        onChange={(value) => updateField("sex", value)}
        options={[
          ["0", "Female = 0"],
          ["1", "Male = 1"],
        ]}
      />
      <SelectField
        label="Chest Pain Type"
        value={form.chestPain}
        onChange={(value) => updateField("chestPain", value)}
        options={[
          ["1", "Typical angina = 1"],
          ["2", "Atypical angina = 2"],
          ["3", "Non-anginal pain = 3"],
          ["4", "Asymptomatic = 4"],
        ]}
      />
      <TextField
        label="Resting Blood Pressure"
        unit="mmHg"
        type="number"
        value={form.restingBp}
        onChange={(value) => updateField("restingBp", value)}
      />
      <TextField
        label="Serum Cholesterol"
        unit="mg/dL"
        type="number"
        value={form.cholesterol}
        onChange={(value) => updateField("cholesterol", value)}
      />
      <SelectField
        label="Fasting Blood Sugar > 120 mg/dL"
        value={form.fastingBloodSugar}
        onChange={(value) => updateField("fastingBloodSugar", value)}
        options={[
          ["0", "No = 0"],
          ["1", "Yes = 1"],
        ]}
      />
      <SelectField
        label="Resting ECG Result"
        value={form.restingEcg}
        onChange={(value) => updateField("restingEcg", value)}
        options={[
          ["0", "Normal = 0"],
          ["1", "ST-T wave abnormality = 1"],
          ["2", "Left ventricular hypertrophy = 2"],
        ]}
      />
      <TextField
        label="Maximum Heart Rate Achieved"
        type="number"
        value={form.maxHeartRate}
        onChange={(value) => updateField("maxHeartRate", value)}
      />
      <SelectField
        label="Exercise-Induced Angina"
        value={form.exerciseAngina}
        onChange={(value) => updateField("exerciseAngina", value)}
        options={[
          ["0", "No = 0"],
          ["1", "Yes = 1"],
        ]}
      />
      <TextField
        label="ST Depression / Oldpeak"
        type="number"
        step="0.1"
        value={form.oldpeak}
        onChange={(value) => updateField("oldpeak", value)}
      />
      <SelectField
        label="Slope of Peak Exercise ST Segment"
        value={form.slope}
        onChange={(value) => updateField("slope", value)}
        options={[
          ["1", "Upsloping = 1"],
          ["2", "Flat = 2"],
          ["3", "Downsloping = 3"],
        ]}
      />
      <SelectField
        label="Number of Major Vessels"
        value={form.vessels}
        onChange={(value) => updateField("vessels", value)}
        options={[
          ["0", "0"],
          ["1", "1"],
          ["2", "2"],
          ["3", "3"],
        ]}
      />
      <SelectField
        label="Thalassemia Result"
        value={form.thalassemia}
        onChange={(value) => updateField("thalassemia", value)}
        options={[
          ["3", "Normal = 3"],
          ["6", "Fixed defect = 6"],
          ["7", "Reversible defect = 7"],
        ]}
      />
    </div>
  );
}

function BatchAssessmentEntry({
  fileName,
  onFileSelected,
}: {
  fileName: string | null;
  onFileSelected: (fileName: string | null) => void;
}) {
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    batchTemplateCsv,
  )}`;

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              Upload Batch CSV
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Upload a CSV where each row contains the required model features.
              Results will be generated row by row for the selected model.
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
            href={templateHref}
            download="cardioxai_batch_prediction_template.csv"
          >
            <Download className="h-4 w-4" />
            Download Template
          </a>
        </div>

        <label className="mt-6 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-cyan-200 bg-cyan-50/50 px-5 py-8 text-center transition hover:border-cyan-300 hover:bg-cyan-50">
          <Upload className="h-9 w-9 text-cyan-600" />
          <span className="mt-4 text-sm font-bold text-slate-950">
            {fileName ?? "Choose a CSV file"}
          </span>
          <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            The CSV header must match the feature names exactly.
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              onFileSelected(event.target.files?.[0]?.name ?? null)
            }
          />
        </label>
      </div>

      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-bold text-slate-950">
          Required CSV Columns
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {batchTemplateColumns.map((column) => (
            <span
              key={column}
              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
            >
              {column}
            </span>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-500">
          Accepted values follow the UCI Heart Disease feature schema used by
          the ML models.
        </p>
      </div>
    </section>
  );
}

function BatchAssessmentResult({
  selectedModel,
  selectedRow,
  onSelectRow,
  onViewXai,
}: {
  selectedModel: AssessmentModel;
  selectedRow: (typeof batchRows)[number];
  onSelectRow: (row: (typeof batchRows)[number]) => void;
  onViewXai: (row: (typeof batchRows)[number]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={FileSpreadsheet} label="Uploaded Rows" value="100" />
        <MetricCard icon={CheckCircle2} label="Processed" value="96" tone="green" />
        <MetricCard icon={ShieldCheck} label="High Risk" value="24" tone="red" />
        <MetricCard icon={Gauge} label="Moderate Risk" value="51" tone="amber" />
        <MetricCard icon={Brain} label="Model Used" value={selectedModel} tone="purple" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <CardHeader
            title="Batch Risk Distribution"
            subtitle="Processed CSV rows grouped by model risk category."
          />
          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={batchRiskDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="level" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[12, 12, 0, 0]}>
                  {batchRiskDistribution.map((entry) => (
                    <Cell key={entry.level} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="Review Priority"
            subtitle="Highest-risk successful rows are surfaced first for domain expert review."
          />
          <div className="mt-5 space-y-3">
            {batchRows.slice(0, 4).map((row, index) => (
              <div
                key={row.row}
                className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-[44px_1fr_auto] sm:items-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-950">
                    Row {row.row} · {row.patient}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{row.keySignal}</p>
                </div>
                <RiskBadge category={row.category} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardHeader
              title="Batch Result Table"
              subtitle="Select a successful row to inspect its individual assessment result."
            />
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Risk" options={["All", "High", "Moderate", "Low", "Failed"]} />
              <FilterSelect label="Status" options={["All", "Success", "Failed"]} />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
            <table className="w-full min-w-[960px] border-collapse bg-white text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Row", "Patient Ref", "Risk Score", "Risk Level", "Status", "Key Signal", "Action"].map((heading) => (
                    <th key={heading} className="px-5 py-4 font-bold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchRows.map((row) => {
                  const selected = selectedRow.row === row.row;

                  return (
                    <tr
                      key={row.row}
                      className={`transition ${
                        selected
                          ? "bg-cyan-50/70"
                          : row.status === "Success"
                            ? "cursor-pointer hover:bg-slate-50/70"
                            : "bg-slate-50/50"
                      }`}
                      onClick={() => {
                        if (row.status === "Success") {
                          onSelectRow(row);
                        }
                      }}
                    >
                      <td className="px-5 py-4 font-bold text-slate-950">{row.row}</td>
                      <td className="px-5 py-4 text-slate-600">{row.patient}</td>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        {row.status === "Failed" ? "--" : row.score.toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
                        <RiskBadge category={row.category} />
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={row.status === "Success" ? "cyan" : "amber"}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.keySignal}</td>
                      <td className="px-5 py-4">
                        <Button
                          variant="secondary"
                          disabled={row.status === "Failed"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewXai(row);
                          }}
                        >
                          Review XAI
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <BatchRowAssessmentDetail
          selectedModel={selectedModel}
          row={selectedRow}
          onViewXai={() => onViewXai(selectedRow)}
        />
      </div>
    </div>
  );
}

function BatchRowAssessmentDetail({
  selectedModel,
  row,
  onViewXai,
}: {
  selectedModel: AssessmentModel;
  row: (typeof batchRows)[number];
  onViewXai: () => void;
}) {
  const isHigh = row.category === "High";
  const isModerate = row.category === "Moderate";
  const gaugeColor = isHigh ? "#ef4444" : isModerate ? "#f59e0b" : "#10b981";
  const gaugeDegrees = Math.round(row.score * 360);

  return (
    <Card className="h-fit p-6">
      <div className="flex items-start justify-between gap-4">
        <CardHeader
          title="Selected Row Assessment"
          subtitle={`Row ${row.row} from the uploaded batch.`}
        />
        <RiskBadge category={row.category} />
      </div>

      <div className="mt-6 flex flex-col items-center rounded-[22px] bg-slate-50 p-5">
        <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-slate-100">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${gaugeColor} 0deg ${gaugeDegrees}deg, #e2e8f0 ${gaugeDegrees}deg 360deg)`,
            }}
          />
          <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-4xl font-bold text-slate-950">
              {Math.round(row.score * 100)}%
            </span>
            <span className="mt-1 text-xs font-bold text-slate-500">
              Risk Score
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm font-bold text-slate-950">{row.patient}</p>
        <p className="mt-1 text-sm text-slate-500">{selectedModel}</p>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-950">Key Risk Signals</h3>
        <div className="mt-3 space-y-2">
          {row.explanations.map((item) => (
            <div
              key={item}
              className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-950">Input Summary</h3>
        <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
          {row.inputSummary.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span className="text-slate-500">{label}</span>
              <span className="text-right font-semibold text-slate-900">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Button onClick={onViewXai}>
          <BarChart3 className="h-4 w-4" />
          Open Row XAI Review
        </Button>
        <Button variant="secondary">
          <Save className="h-4 w-4" />
          Save Row Assessment
        </Button>
      </div>
    </Card>
  );
}

function AssessmentResult({
  patientSummary,
  selectedModel,
  modelPerformance,
  isPerformanceLoading,
  performanceError,
  onViewXai,
}: {
  patientSummary: string[][];
  selectedModel: AssessmentModel;
  modelPerformance: ModelPerformance;
  isPerformanceLoading: boolean;
  performanceError: string | null;
  onViewXai: () => void;
}) {
  return (
    <div className="space-y-6">
      <MetricGrid selectedModel={selectedModel} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <CardHeader title="Risk Assessment Output" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr] lg:items-center">
            <RiskGauge />
            <div>
              <Badge tone="red">High Risk</Badge>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                Risk probability
              </p>
              <p className="mt-1 text-4xl font-bold text-slate-950">0.82</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Legend tone="green" label="Low" range="0.00-0.39" />
                <Legend tone="amber" label="Moderate" range="0.40-0.69" />
                <Legend tone="red" label="High" range="0.70-1.00" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title="Patient Input Summary" />
          <div className="mt-5 divide-y divide-slate-100">
            {patientSummary.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <ModelPerformancePanel
        selectedModel={selectedModel}
        modelPerformance={modelPerformance}
        isLoading={isPerformanceLoading}
        error={performanceError}
      />

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Next Step</h3>
            <p className="mt-1 text-sm text-slate-500">
              Generate explainable AI outputs to inspect which features
              contributed to this risk assessment.
            </p>
            <p className="mt-3 text-xs font-medium text-slate-400">
              Risk score is generated by the trained ML model and should be
              reviewed by a qualified domain expert.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">
              <Save className="h-4 w-4" />
              Save Assessment
            </Button>
            <Button onClick={onViewXai}>
              <BarChart3 className="h-4 w-4" />
              View XAI Visualization
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function XaiWorkspace({
  activeXaiTab,
  setActiveXaiTab,
  onGenerateSummary,
}: {
  activeXaiTab: XaiTab;
  setActiveXaiTab: (tab: XaiTab) => void;
  onGenerateSummary: () => void;
}) {
  return (
    <div className="space-y-6">
      <MetricGrid />

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {xaiTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveXaiTab(tab.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeXaiTab === tab.id
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {activeXaiTab === "overview" ? <OverviewPanel /> : null}
      {activeXaiTab === "shap" ? <ShapPanel /> : null}
      {activeXaiTab === "lime" ? <LimePanel /> : null}
      {activeXaiTab === "whatif" ? <WhatIfPanel /> : null}
      {activeXaiTab === "global" ? <GlobalPanel /> : null}

      <div className="flex justify-end">
        <Button onClick={onGenerateSummary}>
          <Sparkles className="h-4 w-4" />
          Generate XAI Rationale Summary
        </Button>
      </div>
    </div>
  );
}

function BatchXaiWorkspace({
  selectedModel,
  selectedRow,
  onGenerateSummary,
}: {
  selectedModel: AssessmentModel;
  selectedRow: (typeof batchRows)[number];
  onGenerateSummary: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={FileSpreadsheet} label="Batch Rows" value="100" />
        <MetricCard icon={ShieldCheck} label="High Priority" value="24" tone="red" />
        <MetricCard icon={Brain} label="Model Used" value={selectedModel} tone="purple" />
        <MetricCard icon={ClipboardList} label="Review Focus" value={`Row ${selectedRow.row}`} tone="cyan" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader
              title="Batch Explanation Overview"
              subtitle="Aggregated explanation patterns across successful rows."
            />
            <div className="mt-6 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchDriverData} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 0.35]} />
                  <YAxis dataKey="feature" type="category" width={90} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f172a" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              The strongest repeated signals in high-risk rows are oldpeak,
              chest pain type, thalassemia category, colored vessels, and
              exercise-induced angina.
            </p>
          </Card>

          <Card className="p-6">
            <CardHeader title="High-Risk Pattern Summary" />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                "Asymptomatic chest pain appears frequently in high-risk rows.",
                "Elevated oldpeak values are common among priority cases.",
                "Thalassemia defect categories are repeated in high-risk outputs.",
                "Rows with exercise-induced angina are prioritized for review.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="h-fit p-6">
          <CardHeader
            title="Row Detail Review"
            subtitle="Open a high-priority row to inspect patient-level explanation."
          />
          <div className="mt-5 rounded-[22px] bg-red-50 p-5 ring-1 ring-red-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-red-950">
                  Row {selectedRow.row} · {selectedRow.patient}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  Selected from the batch result table.
                </p>
              </div>
              <RiskBadge category={selectedRow.category} />
            </div>
            <p className="mt-5 text-5xl font-bold text-red-950">
              {selectedRow.score.toFixed(2)}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {selectedRow.explanations.map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onGenerateSummary}>
          <Sparkles className="h-4 w-4" />
          Generate Batch Rationale Summary
        </Button>
      </div>
    </div>
  );
}

function ModelPerformancePanel({
  selectedModel,
  modelPerformance,
  isLoading,
  error,
}: {
  selectedModel: AssessmentModel;
  modelPerformance: ModelPerformance;
  isLoading: boolean;
  error: string | null;
}) {
  const confusion = modelPerformance.confusion_matrix;
  const metrics = [
    ["Precision", modelPerformance.precision],
    ["Sensitivity / Recall", modelPerformance.sensitivity_recall],
    ["Specificity", modelPerformance.specificity],
    ["F1 Score", modelPerformance.f1_score],
    ["AUC-ROC Score", modelPerformance.auc_roc],
  ];

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <CardHeader
          title="Model Performance"
          subtitle="Evaluation metrics from the UCI Heart Disease test split."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="purple">{selectedModel}</Badge>
          {isLoading ? <Badge tone="cyan">Loading metrics</Badge> : null}
          {error ? <Badge tone="amber">Sample values</Badge> : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {formatMetric(Number(value))}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[20px] border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-950">Confusion Matrix</h3>
          <div className="mt-4 grid grid-cols-[96px_1fr_1fr] overflow-hidden rounded-2xl border border-slate-200 text-center text-sm">
            <div className="bg-slate-100 p-3 font-bold text-slate-600" />
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Predicted 0</div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Predicted 1</div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Actual 0</div>
            <div className="bg-emerald-50 p-4 font-bold text-emerald-700">
              TN {confusion.true_negative}
            </div>
            <div className="bg-red-50 p-4 font-bold text-red-700">
              FP {confusion.false_positive}
            </div>
            <div className="bg-slate-100 p-3 font-bold text-slate-600">Actual 1</div>
            <div className="bg-red-50 p-4 font-bold text-red-700">
              FN {confusion.false_negative}
            </div>
            <div className="bg-emerald-50 p-4 font-bold text-emerald-700">
              TP {confusion.true_positive}
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-950">Clinical Readout</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Sensitivity/recall shows how often patients with heart disease are
              correctly identified.
            </p>
            <p>
              Specificity shows how often patients without heart disease are
              correctly identified.
            </p>
            <p>
              AUC-ROC summarizes how well the model separates positive and
              negative cases across thresholds.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function OverviewPanel() {
  return (
    <Card className="p-6">
      <CardHeader title="Top Contributing Factors" />
      <div className="mt-6 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={contributionData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[-0.15, 0.35]} />
            <YAxis dataKey="feature" type="category" width={170} />
            <Tooltip />
            <Bar dataKey="value" radius={[10, 10, 10, 10]}>
              {contributionData.map((entry) => (
                <Cell
                  key={entry.feature}
                  fill={entry.value >= 0 ? "#f97316" : "#14b8a6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Positive values push the model output toward higher predicted risk.
        Negative values reduce the predicted risk score.
      </p>
    </Card>
  );
}

function ShapPanel() {
  return (
    <Card className="p-6">
      <CardHeader
        title="SHAP Waterfall Explanation"
        subtitle="Base value: 0.38 to final output: 0.82"
      />
      <div className="mt-6 space-y-4">
        {shapSteps.map((step, index) => (
          <div
            key={step.label}
            className="grid gap-3 rounded-[20px] bg-slate-50 p-4 md:grid-cols-[220px_1fr_70px] md:items-center"
          >
            <span className="text-sm font-semibold text-slate-700">
              {step.label}
            </span>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full ${
                  step.tone === "green"
                    ? "bg-emerald-500"
                    : step.tone === "cyan"
                      ? "bg-cyan-500"
                      : step.tone === "purple"
                        ? "bg-purple-500"
                        : step.tone === "slate"
                          ? "bg-slate-400"
                          : "bg-orange-500"
                }`}
                style={{ width: `${Math.max(Math.abs(step.value) * 100, 9)}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-950">
              {index === 0 || index === shapSteps.length - 1
                ? step.value.toFixed(2)
                : `${step.value > 0 ? "+" : ""}${step.value.toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 rounded-[20px] border border-purple-100 bg-purple-50 p-4 text-sm leading-6 text-purple-800">
        SHAP explains how each feature moves the model from the baseline output
        to the final risk score.
      </p>
    </Card>
  );
}

function LimePanel() {
  return (
    <Card className="p-6">
      <CardHeader title="LIME Local Explanation" />
      <div className="mt-6 h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={contributionData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="feature" tick={{ fontSize: 12 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[12, 12, 0, 0]}>
              {contributionData.map((entry) => (
                <Cell
                  key={entry.feature}
                  fill={entry.value >= 0 ? "#ef4444" : "#10b981"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 rounded-[20px] bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        LIME provides a local surrogate explanation and may vary depending on
        perturbation settings.
      </p>
    </Card>
  );
}

function WhatIfPanel() {
  return (
    <Card className="p-6">
      <CardHeader title="Counterfactual / What-if Simulation" />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ScenarioCard
          title="Current"
          tone="red"
          rows={[
            ["Cholesterol", "242 mg/dL"],
            ["Resting BP", "145 mmHg"],
            ["Risk Score", "82%"],
          ]}
        />
        <ScenarioCard
          title="Simulated"
          tone="amber"
          rows={[
            ["Cholesterol", "200 mg/dL"],
            ["Resting BP", "130 mmHg"],
            ["Simulated Risk Score", "69%"],
          ]}
        />
      </div>
      <p className="mt-5 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Simulation only — not a treatment recommendation.
      </p>
    </Card>
  );
}

function GlobalPanel() {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <ChartCard title="Global Feature Importance">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={globalImportance}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="feature" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="importance" fill="#06b6d4" radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="PDP Preview for Cholesterol">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={pdpData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cholesterol" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="risk"
              stroke="#7c3aed"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="ICE Preview">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={iceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cholesterol" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="p1" stroke="#06b6d4" strokeWidth={2} />
            <Line type="monotone" dataKey="p2" stroke="#8b5cf6" strokeWidth={2} />
            <Line type="monotone" dataKey="p3" stroke="#f97316" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function RationaleSummary() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader title="Generated XAI Rationale Summary" />
        <p className="mt-5 max-w-5xl text-lg leading-9 text-slate-700">
          The model classified this case as high risk mainly because
          cholesterol, resting blood pressure, age, and exercise-induced angina
          contributed positively to the risk score. Maximum heart rate had a
          small reducing effect. SHAP and LIME both indicate that the major
          upward contributors are consistent across local explanation outputs.
          This summary is generated from XAI results and should be reviewed by a
          domain expert.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            "SHAP Waterfall",
            "LIME Contribution",
            "Counterfactual Simulation",
            "Random Forest v1.2",
          ].map((source) => (
            <Badge key={source} tone="cyan">
              {source}
            </Badge>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ContributorCard
          title="Top Positive Contributors"
          tone="red"
          rows={[
            ["Cholesterol", "+0.31"],
            ["Resting Blood Pressure", "+0.24"],
            ["Age", "+0.18"],
            ["Exercise-Induced Angina", "+0.12"],
          ]}
        />
        <ContributorCard
          title="Top Negative Contributors"
          tone="green"
          rows={[["Maximum Heart Rate", "-0.09"]]}
        />
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
              <Brain className="h-6 w-6" />
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              The LLM does not perform risk prediction. It only converts XAI
              outputs into a readable rationale.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">
              <Sparkles className="h-4 w-4" />
              Regenerate Summary
            </Button>
            <Button variant="secondary">
              <Save className="h-4 w-4" />
              Save Assessment
            </Button>
            <Button>
              <FileText className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BatchRationaleSummary({
  selectedModel,
}: {
  selectedModel: AssessmentModel;
}) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <CardHeader
            title="Batch Rationale Summary"
            subtitle="Triage-oriented interpretation for the uploaded CSV assessment."
          />
          <Badge tone="purple">{selectedModel}</Badge>
        </div>
        <p className="mt-5 max-w-5xl text-lg leading-9 text-slate-700">
          The uploaded batch contains 100 records. Ninety-six rows were
          processed successfully and four rows require data correction. The
          review queue should prioritize the 24 high-risk rows, especially rows
          7, 18, and 42, because their predicted risk scores are highest and
          their explanation summaries repeatedly identify oldpeak, chest pain
          type, thalassemia category, colored vessels, and exercise-induced
          angina as major risk signals.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <ContributorCard
          title="Risk Stratification"
          tone="red"
          rows={[
            ["High risk rows", "24"],
            ["Moderate risk rows", "51"],
            ["Low risk rows", "21"],
            ["Failed rows", "4"],
          ]}
        />
        <ContributorCard
          title="Primary Risk Signals"
          tone="red"
          rows={[
            ["oldpeak", "Repeated"],
            ["cp", "Repeated"],
            ["thal", "Repeated"],
            ["ca", "Repeated"],
          ]}
        />
        <ContributorCard
          title="Validation Notes"
          tone="green"
          rows={[
            ["Processed", "96"],
            ["Needs correction", "4"],
            ["Schema", "13 features"],
            ["Review mode", "Triage"],
          ]}
        />
      </div>

      <Card className="p-6">
        <CardHeader
          title="Priority Review List"
          subtitle="Rows recommended for first-pass domain expert review."
        />
        <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
          <table className="w-full min-w-[820px] border-collapse bg-white text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Priority", "Row", "Risk Score", "Risk Level", "Rationale Focus"].map((heading) => (
                  <th key={heading} className="px-5 py-4 font-bold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batchRows.slice(0, 4).map((row, index) => (
                <tr key={row.row}>
                  <td className="px-5 py-4 font-bold text-slate-950">{index + 1}</td>
                  <td className="px-5 py-4 text-slate-600">Row {row.row}</td>
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    {row.score.toFixed(2)}
                  </td>
                  <td className="px-5 py-4">
                    <RiskBadge category={row.category} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">{row.keySignal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
              <Brain className="h-6 w-6" />
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Batch rationale summarizes triage patterns and does not replace
              row-level clinical review or professional judgement.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">
              <Sparkles className="h-4 w-4" />
              Regenerate Summary
            </Button>
            <Button>
              <FileText className="h-4 w-4" />
              Export Batch Report
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AssessmentHistory({
  onViewReport,
}: {
  onViewReport: () => void;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CardHeader
          title="Saved Assessment Records"
          subtitle="Saved records are available for report review and presentation."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect label="Risk category" options={["All", "High", "Moderate", "Low"]} />
          <FilterSelect label="Date" options={["All dates", "2026-05-12", "2026-05-11"]} />
          <FilterSelect label="Model version" options={["All models", "RF v1.2"]} />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
        <table className="w-full min-w-[900px] border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {[
                "Assessment ID",
                "Patient Reference",
                "Risk Score",
                "Risk Category",
                "Model Version",
                "Created Date",
                "Status",
                "Action",
              ].map((heading) => (
                <th key={heading} className="px-5 py-4 font-bold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historyRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70">
                <td className="px-5 py-4 font-semibold text-slate-950">{row.id}</td>
                <td className="px-5 py-4 text-slate-600">{row.patient}</td>
                <td className="px-5 py-4 font-semibold text-slate-950">{row.score}</td>
                <td className="px-5 py-4">
                  <RiskBadge category={row.category} />
                </td>
                <td className="px-5 py-4 text-slate-600">{row.model}</td>
                <td className="px-5 py-4 text-slate-600">{row.date}</td>
                <td className="px-5 py-4">
                  <Badge tone="cyan">{row.status}</Badge>
                </td>
                <td className="px-5 py-4">
                  <Button variant="secondary" onClick={onViewReport}>
                    View Report
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricGrid({ selectedModel = "Random Forest" }: { selectedModel?: AssessmentModel }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={ClipboardList} label="Patient Reference" value="PT-0001" />
      <MetricCard icon={Gauge} label="Risk Score" value="82%" tone="red" />
      <MetricCard icon={ShieldCheck} label="Risk Category" value="High Risk" tone="red" />
      <MetricCard icon={Brain} label="Model Used" value={selectedModel} tone="purple" />
    </div>
  );
}

function formatMetric(value: number) {
  return value.toFixed(2);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "cyan",
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  tone?: "cyan" | "purple" | "red" | "amber" | "green";
}) {
  const colors = {
    cyan: "bg-cyan-50 text-cyan-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  unit,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  unit?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2 flex overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
        <input
          className="min-h-12 w-full bg-transparent px-4 text-sm font-medium text-slate-900 outline-none"
          type={type}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit ? (
          <span className="flex items-center border-l border-slate-100 px-3 text-xs font-semibold text-slate-400">
            {unit}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function RiskGauge() {
  return (
    <div className="relative mx-auto flex h-64 w-64 items-center justify-center rounded-full bg-slate-100">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(#ef4444 0deg 295deg, #e2e8f0 295deg 360deg)",
        }}
      />
      <div className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-5xl font-bold text-slate-950">82%</span>
        <span className="mt-1 text-sm font-semibold text-red-600">High Risk</span>
      </div>
    </div>
  );
}

function Legend({
  tone,
  label,
  range,
}: {
  tone: "green" | "amber" | "red";
  label: string;
  range: string;
}) {
  const color =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="text-sm font-bold text-slate-900">{label}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{range}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-5 text-base font-semibold text-slate-950">{title}</h3>
      {children}
    </Card>
  );
}

function ScenarioCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: string[][];
  tone: "red" | "amber";
}) {
  return (
    <div
      className={`rounded-[22px] p-5 ring-1 ${
        tone === "red"
          ? "bg-red-50 text-red-900 ring-red-100"
          : "bg-amber-50 text-amber-900 ring-amber-100"
      }`}
    >
      <h3 className="text-base font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <span className="opacity-75">{label}</span>
            <span className="font-bold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContributorCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: string[][];
  tone: "red" | "green";
}) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <div className="mt-5 space-y-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
          >
            <span className="text-sm font-medium text-slate-600">{label}</span>
            <Badge tone={tone}>{value}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FilterSelect({
  label,
  options,
}: {
  label: string;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select className="mt-1 min-h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function RiskBadge({ category }: { category: string }) {
  if (category === "High") {
    return <Badge tone="red">High</Badge>;
  }

  if (category === "Moderate") {
    return <Badge tone="amber">Moderate</Badge>;
  }

  if (category === "Failed") {
    return <Badge tone="slate">Failed</Badge>;
  }

  return <Badge tone="green">Low</Badge>;
}
