export type MainTab =
  | "new"
  | "result"
  | "xai"
  | "history";

export type XaiTab = "overview" | "shap" | "lime" | "comparison";

export type AssessmentMode = "single" | "batch";
export type PatientReferenceMode = "csv_column" | "auto_generate" | "single_case";

export type AssessmentModel =
  | "Random Forest"
  | "XGBoost"
  | "Logistic Regression"
  | "Neural Network";

export type AssessmentModelSelection = AssessmentModel | "";

export type ModelKey =
  | "random_forest"
  | "xgboost"
  | "logistic_regression"
  | "neural_network";

export type ModelPerformance = {
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

export type FeatureContribution = {
  feature: string;
  value: number;
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
  explanation_scope?: "global" | "global_summary" | string | null;
  feature_importance: GlobalShapFeatureImportance[];
  beeswarm_data?: unknown;
  dependence_data?: unknown;
  summary_text?: string | null;
  generation_status?: "pending" | "completed" | "failed" | "unavailable" | string | null;
  generated_at?: string | null;
  updated_at?: string | null;
  ml_models?: {
    model_name?: ModelKey | string | null;
    display_name?: string | null;
    model_version?: string | null;
  } | null;
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
  request_id?: string;
  result_id?: string;
  patient_case_id?: string | null;
  patient_reference_id?: string | null;
  model_name: ModelKey;
  risk_score: number;
  predicted_class: 0 | 1;
  risk_level: "low" | "moderate" | "high";
  explanation: string[];
  model_version: string;
  xai: XaiExplanation;
  assessment_date?: string | null;
  created_at?: string | null;
};

export type PredictionApiResponse = {
  success: boolean;
  request_id: string;
  result_id: string;
  patient_case_id?: string | null;
  patient_reference_id?: string | null;
  prediction: PredictionResult;
};

export type BatchApiRow = {
  row_number: number;
  patient_reference_id?: string | null;
  request_id?: string | null;
  result_id?: string | null;
  risk_score?: number | null;
  predicted_class?: number | null;
  risk_level?: string | null;
  explanation?: string[] | null;
  xai?: XaiExplanation | null;
  status: "success" | "failed";
  error_message?: string | null;
};

export type BatchApiResponse = {
  success: boolean;
  upload_id: string;
  summary: {
    total_rows: number;
    successful_rows: number;
    failed_rows: number;
  };
  results: BatchApiRow[];
  errors: { row_number: number; error_message: string }[];
};

export type BatchPreviewRow = {
  row_number: number;
  patient_reference_id?: string | null;
  status: "valid" | "invalid";
  errors: string[];
  will_create_patient_case: boolean;
  existing_patient_case_id?: string | null;
};

export type BatchPreviewResponse = {
  success: boolean;
  upload_id: string;
  summary: {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    new_patient_cases: number;
    existing_patient_cases: number;
  };
  rows: BatchPreviewRow[];
};

export type HistoryItem = {
  request_id: string;
  result_id: string;
  patient_case_id?: string | null;
  patient_reference_id?: string | null;
  assessment_date?: string | null;
  entry_type?: string | null;
  model_name: ModelKey;
  model_version?: string | null;
  risk_score: number;
  predicted_class: number;
  risk_level: string;
  explanation?: string[];
  xai?: XaiExplanation | null;
  input_features?: Record<string, number | string | null> | null;
  created_at: string;
  feedback_status?: "pending" | "reviewed";
};

export type DomainExpertUser = {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
} | null;

export type FeedbackForm = {
  assessmentRiskLevel: "low" | "moderate" | "high";
  agreementLevel: string;
  isClinicallyAcceptable: boolean;
  confidenceLevel: string;
  feedbackComment: string;
  useForFutureRetraining: boolean;
};

export type PatientForm = {
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

