import { BarChart3, ClipboardList, Users } from "lucide-react";
import type { ClinicalAction, DataSource, FeatureKey, HistoryKey, ModelKey, NavKey } from "./types";

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";

export const navMeta: Record<NavKey, { label: string; title: string; subtitle: string; icon: typeof ClipboardList }> = {
  worklist: {
    label: "Worklist",
    title: "Worklist",
    subtitle: "Assessments waiting for your review, highest risk first.",
    icon: ClipboardList,
  },
  patients: {
    label: "Patients",
    title: "My Patients",
    subtitle: "Open a patient to see their risk over time or start a new assessment.",
    icon: Users,
  },
  models: {
    label: "Model & Evidence",
    title: "Model & Evidence",
    subtitle: "Which model produces the risk scores, how well it performs, and what drives it overall.",
    icon: BarChart3,
  },
};

export const modelLabels: Record<ModelKey, string> = {
  logistic_regression: "Logistic Regression",
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  neural_network: "Neural Network",
};

type FeatureMeta = {
  label: string;
  unit?: string;
  kind: "binary" | "number";
  modifiable: boolean;
  min?: number;
  max?: number;
  step?: string;
  yes?: string;
  no?: string;
};

export const featureMeta: Record<FeatureKey, FeatureMeta> = {
  sex: { label: "Sex", kind: "binary", modifiable: false, yes: "Male", no: "Female" },
  age: { label: "Age", unit: "years", kind: "number", modifiable: false, min: 18, max: 100 },
  current_smoker: { label: "Current smoker", kind: "binary", modifiable: true },
  cigs_per_day: { label: "Cigarettes per day", unit: "/day", kind: "number", modifiable: true, min: 0, max: 100 },
  bp_meds: { label: "On BP medication", kind: "binary", modifiable: false },
  prevalent_stroke: { label: "Previous stroke", kind: "binary", modifiable: false },
  prevalent_hyp: { label: "Hypertension", kind: "binary", modifiable: false },
  diabetes: { label: "Diabetes", kind: "binary", modifiable: false },
  tot_chol: { label: "Total cholesterol", unit: "mg/dL", kind: "number", modifiable: true, min: 80, max: 700 },
  sys_bp: { label: "Systolic BP", unit: "mmHg", kind: "number", modifiable: true, min: 70, max: 300 },
  dia_bp: { label: "Diastolic BP", unit: "mmHg", kind: "number", modifiable: true, min: 40, max: 160 },
  bmi: { label: "BMI", unit: "kg/m²", kind: "number", modifiable: true, min: 12, max: 70, step: "0.1" },
  heart_rate: { label: "Resting heart rate", unit: "bpm", kind: "number", modifiable: true, min: 30, max: 200 },
  glucose: { label: "Glucose", unit: "mg/dL", kind: "number", modifiable: true, min: 40, max: 500 },
};

export const featureLabels: Record<string, string> = Object.fromEntries(
  Object.entries(featureMeta).map(([key, meta]) => [key, meta.label]),
);

export const historyKeys: HistoryKey[] = [
  "sex",
  "current_smoker",
  "cigs_per_day",
  "bp_meds",
  "prevalent_stroke",
  "prevalent_hyp",
  "diabetes",
];

export const measurementKeys = ["sys_bp", "dia_bp", "heart_rate", "bmi", "tot_chol", "glucose"] as const;

export const sourceLabels: Record<DataSource, string> = {
  clinician: "Entered by clinician",
  clinician_verified: "Verified by clinician",
  lab: "Lab result",
  self_reported: "Self-reported",
  imported: "Imported",
  date_of_birth: "From date of birth",
};

export const clinicalActionLabels: Record<ClinicalAction, string> = {
  none: "No action needed",
  lifestyle: "Lifestyle advice",
  start_or_adjust_medication: "Start or adjust medication",
  refer: "Refer to specialist",
  further_tests: "Order further tests",
};

export const riskBands = [
  { level: "low", label: "Low", range: "< 10%", tone: "green" },
  { level: "moderate", label: "Moderate", range: "10–20%", tone: "amber" },
  { level: "high", label: "High", range: "≥ 20%", tone: "red" },
] as const;

export const xaiTabs = [
  { id: "shap", label: "SHAP" },
  { id: "lime", label: "LIME" },
  { id: "comparison", label: "SHAP vs LIME" },
] as const;

export type XaiTab = (typeof xaiTabs)[number]["id"];
