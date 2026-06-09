import { BarChart3, Brain, ClipboardList, Gauge, History } from "lucide-react";
import type {
  AssessmentModel,
  MainTab,
  ModelPerformance,
  PatientForm,
  XaiTab,
} from "./types";

export const defaultForm: PatientForm = {
  patientId: "",
  age: "",
  sex: "",
  chestPain: "",
  restingBp: "",
  cholesterol: "",
  fastingBloodSugar: "",
  restingEcg: "",
  maxHeartRate: "",
  exerciseAngina: "",
  oldpeak: "",
  slope: "",
  vessels: "",
  thalassemia: "",
};

export const tabMeta: Record<
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
    title: "XAI Visualisation",
    subtitle:
      "Understand how SHAP and LIME explain this cardiovascular risk prediction.",
    icon: BarChart3,
  },
  history: {
    title: "Assessment History",
    subtitle: "View saved assessment records and reopen previous XAI reports.",
    icon: History,
  },
};

export const xaiTabs: { id: XaiTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "shap", label: "SHAP" },
  { id: "lime", label: "LIME" },
  { id: "comparison", label: "Comparison" },
];

export const modelProfiles: Record<
  AssessmentModel,
  {
    key: "random_forest" | "xgboost" | "logistic_regression" | "neural_network";
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

export const assessmentModelOptions = Object.keys(modelProfiles) as AssessmentModel[];

export const batchTemplateColumns = [
  "patient_reference_id",
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

export const featureLabels: Record<string, string> = {
  age: "Age",
  sex: "Sex",
  cp: "Chest Pain Type",
  trestbps: "Resting Blood Pressure",
  chol: "Serum Cholesterol",
  fbs: "Fasting Blood Sugar",
  restecg: "Resting ECG Result",
  thalach: "Maximum Heart Rate",
  exang: "Exercise-Induced Angina",
  oldpeak: "ST Depression",
  slope: "ST Segment Slope",
  ca: "Number of Major Vessels Coloured by Fluoroscopy",
  thal: "Thalassemia",
};

export const batchTemplateCsv = `${batchTemplateColumns.join(",")}\n`;

export const csvFeatureGuide = [
  ["patient_reference_id", "Patient Reference ID", "Optional"],
  ["age", "Age *", "Age in years"],
  ["sex", "Sex *", "0 = Female, 1 = Male"],
  ["cp", "Chest Pain Type *", "1 = Typical angina, 2 = Atypical angina, 3 = Non-anginal pain, 4 = Asymptomatic"],
  ["trestbps", "Resting Blood Pressure *", "Resting blood pressure in mmHg"],
  ["chol", "Serum Cholesterol *", "Serum cholesterol in mg/dL"],
  ["fbs", "Fasting Blood Sugar *", "0 = No, 1 = Yes"],
  ["restecg", "Resting ECG Result *", "0 = Normal, 1 = ST-T wave abnormality, 2 = Left ventricular hypertrophy"],
  ["thalach", "Maximum Heart Rate *", "Maximum heart rate achieved"],
  ["exang", "Exercise-Induced Angina *", "0 = No, 1 = Yes"],
  ["oldpeak", "ST Depression *", "ST depression value"],
  ["slope", "ST Segment Slope *", "1 = Upsloping, 2 = Flat, 3 = Downsloping"],
  ["ca", "Number of Major Vessels Coloured by Fluoroscopy *", "0-3"],
  ["thal", "Thalassemia *", "3 = Normal, 6 = Fixed defect, 7 = Reversible defect"],
];

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";

export const fallbackModelPerformance: Record<AssessmentModel, ModelPerformance> = {
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

export const CLINICIAN_USER_ID = "00000000-0000-0000-0000-000000000001";
