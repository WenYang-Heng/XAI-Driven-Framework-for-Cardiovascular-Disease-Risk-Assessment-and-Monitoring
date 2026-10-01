export type ModelKey =
  | "random_forest"
  | "xgboost"
  | "logistic_regression"
  | "neural_network";

export type RiskLevel = "low" | "moderate" | "high";

export type FeatureKey =
  | "sex"
  | "age"
  | "current_smoker"
  | "cigs_per_day"
  | "bp_meds"
  | "prevalent_stroke"
  | "prevalent_hyp"
  | "diabetes"
  | "tot_chol"
  | "sys_bp"
  | "dia_bp"
  | "bmi"
  | "heart_rate"
  | "glucose";

export type HistoryKey =
  | "sex"
  | "current_smoker"
  | "cigs_per_day"
  | "bp_meds"
  | "prevalent_stroke"
  | "prevalent_hyp"
  | "diabetes";

export type DomainExpertUser = {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
} | null;

// =========================
// Navigation
// =========================
export type View =
  | { name: "worklist" }
  | { name: "patients" }
  | { name: "patient"; patientCaseId: string }
  | { name: "assess"; patientCaseId: string }
  | { name: "review"; resultId: string }
  | { name: "models" };

export type NavKey = "worklist" | "patients" | "models";

// =========================
// Model output + XAI
// =========================
export type FeatureContribution = {
  feature: string;
  value: number;
};

export type XaiExplanation = {
  shap: {
    base_value: number;
    final_value: number;
    contributions: FeatureContribution[];
  };
  lime: {
    contributions: FeatureContribution[];
  };
  summary: string[];
};

export type PredictionResult = {
  model_name: ModelKey;
  risk_score: number;
  predicted_class: 0 | 1;
  risk_level: RiskLevel;
  explanation: string[];
  model_version: string;
  xai: XaiExplanation;
};

export type ModelPerformance = {
  model_name: ModelKey;
  accuracy: number;
  precision: number;
  sensitivity_recall: number;
  specificity: number;
  f1_score: number;
  auc_roc: number;
  brier_score?: number | null;
  decision_threshold?: number | null;
  cross_validation?: {
    folds: number;
    auc_roc_mean: number;
    auc_roc_std: number;
    brier_score_mean: number;
    brier_score_std: number;
  } | null;
  confusion_matrix: {
    true_negative: number;
    false_positive: number;
    false_negative: number;
    true_positive: number;
  };
};

export type GlobalShapFeatureImportance = {
  rank: number;
  feature: string;
  display_name?: string | null;
  mean_abs_shap: number;
};

export type GlobalShapExplanation = {
  global_explanation_id: string;
  model_id: string;
  dataset_name?: string | null;
  samples_explained?: number | null;
  explainer_type?: string | null;
  feature_importance: GlobalShapFeatureImportance[];
  summary_text?: string | null;
  generation_status?: string | null;
  generated_at?: string | null;
};

export type ModelSummary = {
  model_name: ModelKey;
  display_name: string;
  model_version?: string | null;
  dataset_name?: string | null;
  is_active?: boolean | null;
  is_default: boolean;
};

// =========================
// Clinician workflow (server-api /api/clinician)
// =========================
export type DataSource =
  | "clinician"
  | "clinician_verified"
  | "lab"
  | "self_reported"
  | "imported"
  | "date_of_birth";

export type Patient = {
  patient_case_id: string;
  patient_reference_id: string;
  display_name?: string | null;
  date_of_birth?: string | null;
  case_status: "active" | "archived";
  assigned_clinician_id?: string | null;
  history_sources?: Partial<Record<HistoryKey, { source: DataSource; updated_at: string }>>;
  created_at?: string | null;
  updated_at?: string | null;
} & Partial<Record<HistoryKey, number | null>>;

export type PatientListItem = Patient & {
  latest_result_id?: string | null;
  latest_risk_score?: number | null;
  latest_risk_level?: RiskLevel | null;
  latest_assessed_at?: string | null;
  latest_review_status?: ReviewStatus | "unreviewed" | null;
};

export type Measurement = {
  measurement_id: string;
  measured_at: string;
  source: "clinician" | "lab" | "self_reported" | "imported";
  sys_bp?: number | null;
  dia_bp?: number | null;
  heart_rate?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  bmi?: number | null;
  tot_chol?: number | null;
  glucose?: number | null;
  notes?: string | null;
};

export type MeasurementInput = Partial<
  Record<"sys_bp" | "dia_bp" | "heart_rate" | "height_cm" | "weight_kg" | "bmi" | "tot_chol" | "glucose", number>
> & { source?: Measurement["source"] };

export type PrefillField = {
  value: number | null;
  source: DataSource | null;
  recorded_at: string | null;
  days_old: number | null;
  stale: boolean;
};

export type Prefill = {
  patient_case_id: string;
  fields: Record<FeatureKey, PrefillField>;
  missing: FeatureKey[];
  stale: FeatureKey[];
  ready: boolean;
};

export type ModelAgreement = {
  available: boolean;
  scores: { model_name: ModelKey; risk_score: number; risk_level: RiskLevel; is_selected?: boolean }[];
  spread: number | null;
  agrees: boolean | null;
  message: string | null;
};

export type AssessmentRunResponse = {
  result_id: string;
  request_id: string;
  patient_case_id: string;
  patient_reference_id: string;
  model_name: ModelKey;
  prediction: PredictionResult;
  model_agreement: ModelAgreement;
  inputs: Prefill;
};

export type ReviewStatus = "draft" | "signed_off";

export type ClinicalAction = "none" | "lifestyle" | "start_or_adjust_medication" | "refer" | "further_tests";

export type Review = {
  feedback_id: string;
  result_id: string;
  expert_id: string;
  clinician_risk_level?: RiskLevel | null;
  agreement_level?: number | null;
  is_clinically_acceptable?: boolean | null;
  confidence_level?: number | null;
  flagged_features?: FeatureKey[] | null;
  clinical_action?: ClinicalAction | null;
  feedback_comment?: string | null;
  use_for_future_retraining?: boolean | null;
  review_status: ReviewStatus;
  signed_off_at?: string | null;
  created_at?: string | null;
};

export type ReviewInput = {
  clinician_risk_level?: RiskLevel | null;
  agreement_level?: number | null;
  is_clinically_acceptable?: boolean | null;
  confidence_level?: number | null;
  flagged_features: FeatureKey[];
  clinical_action?: ClinicalAction | null;
  feedback_comment?: string | null;
  use_for_future_retraining: boolean;
  sign_off: boolean;
};

export type AssessmentDetail = {
  result_id: string;
  request_id: string;
  model_name: ModelKey;
  model_version?: string | null;
  risk_score: number;
  predicted_class: 0 | 1;
  risk_level: RiskLevel;
  explanation?: string[] | null;
  xai?: XaiExplanation | null;
  assessed_at: string;
  patient_case_id: string;
  input_features?: Partial<Record<FeatureKey, number>> | null;
  input_sources?: Partial<Record<FeatureKey, { source: DataSource | null; recorded_at: string | null; stale: boolean }>> | null;
  visit_label?: string | null;
  feature_set?: string | null;
  patient: Patient | null;
  reviews: Review[];
  my_review: Review | null;
};

export type AssessmentListItem = {
  result_id: string;
  model_name: ModelKey;
  risk_score: number;
  risk_level: RiskLevel;
  assessed_at: string;
  patient_case_id: string;
  patient_reference_id?: string | null;
  display_name?: string | null;
  visit_label?: string | null;
  input_features?: Partial<Record<FeatureKey, number>> | null;
  review_status: ReviewStatus | "unreviewed";
  clinical_action?: ClinicalAction | null;
  clinician_risk_level?: RiskLevel | null;
  signed_off_at?: string | null;
};

export type Worklist = {
  counts: { needs_review: number; high_risk_unreviewed: number; drafts: number };
  needs_review: AssessmentListItem[];
  drafts: AssessmentListItem[];
  recently_signed_off: AssessmentListItem[];
};

export type PatientDetail = {
  patient: Patient;
  measurements: Measurement[];
  assessments: AssessmentListItem[];
};
