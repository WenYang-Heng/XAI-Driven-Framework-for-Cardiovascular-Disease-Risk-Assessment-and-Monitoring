export type AdminTab = "overview" | "performance" | "fairness" | "drift" | "activity" | "reports";
export type Tone = "cyan" | "green" | "amber" | "red" | "slate" | "purple";
export type ModelName = "xgboost" | "random_forest" | "neural_network" | "logistic_regression";
export type RiskLevel = "low" | "moderate" | "high";

export type OverviewResponse = {
  days: number;
  totals: {
    assessments: number;
    all_time_assessments: number;
    high_risk: number;
    active_users: number;
    registered_users: number;
    single_assessments: number;
    batch_assessments: number;
    feedback: number;
    batch_uploads: number;
    failed_batch_rows: number;
  };
  risk_distribution: { risk_level: RiskLevel; count: number }[];
  daily: { day: string; total: number; low: number; moderate: number; high: number }[];
  model_usage: { model_name: string; count: number }[];
};

export type ModelMetrics = {
  model_name: ModelName;
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
  meets_targets: boolean;
  snapshot_at?: string;
};

export type PerformanceResponse = {
  source: "live" | "snapshot";
  dataset: string;
  targets: Record<"auc_roc" | "sensitivity_recall" | "specificity", number>;
  models: ModelMetrics[];
  history: (Omit<ModelMetrics, "confusion_matrix" | "meets_targets"> & { day: string; model_version?: string })[];
};

export type FairnessGroup = {
  group: string;
  sample_size: number;
  prevalence: number | null;
  selection_rate: number | null;
  true_positive_rate: number | null;
  false_positive_rate: number | null;
  accuracy: number | null;
  is_reference: boolean;
  tpr_gap: number | null;
  fpr_gap: number | null;
  selection_rate_gap: number | null;
  disparate_impact: number | null;
  limited_confidence: boolean;
};

export type FairnessStatus = "within_limit" | "watch" | "investigate";

export type FairnessAttribute = {
  attribute: string;
  label: string;
  reference_group: string;
  demographic_parity_difference: number | null;
  equal_opportunity_difference: number | null;
  status: FairnessStatus;
  groups: FairnessGroup[];
};

export type LiveParityRow = {
  attribute: string;
  group: string;
  assessments: number;
  high_risk_rate: number | null;
  positive_rate: number | null;
};

export type FairnessResponse = {
  fairness_available: boolean;
  message: string | null;
  evaluation: {
    model_name: ModelName;
    evaluation_method: string;
    sample_size: number;
    min_group_size: number;
    thresholds: { watch_gap: number; investigate_gap: number };
    attributes: FairnessAttribute[];
  } | null;
  live_parity: LiveParityRow[];
};

export type DriftStatus = "stable" | "moderate" | "significant" | "no_data";

export type DriftFeature = {
  feature: string;
  label: string;
  kind: "numeric" | "categorical";
  psi: number;
  status: DriftStatus;
  baseline_mean: number;
  current_mean: number | null;
  distribution: { bin: string; baseline: number; current: number }[];
};

export type DriftResponse = {
  drift_available: boolean;
  message: string | null;
  drift: {
    method: string;
    baseline: string;
    baseline_size: number;
    current_size: number;
    limited_confidence: boolean;
    min_records: number;
    thresholds: { moderate: number; significant: number };
    overall_psi: number;
    features: DriftFeature[];
    trend: { day: string; records: number; psi: Record<string, number> }[];
  } | null;
  volume: OverviewResponse["daily"];
};

export type ActivityStatus = "success" | "warning" | "failed";

export type ActivityLogEntry = {
  log_id: string;
  timestamp: string;
  actor?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  category: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  status: ActivityStatus;
  details?: Record<string, unknown> | null;
};

export type ActivityLogResponse = {
  success: boolean;
  items: ActivityLogEntry[];
  total: number;
  page: number;
  page_size: number;
};

export type ReportSection = "activity" | "performance" | "fairness" | "drift" | "activity_log";

export type ReportResponse = {
  generated_at: string;
  days: number;
  model_name: ModelName;
  partial: boolean;
  unavailable: { section: ReportSection; reason: string }[];
  sections: Partial<{
    activity: OverviewResponse;
    performance: PerformanceResponse;
    fairness: FairnessResponse;
    drift: DriftResponse;
    activity_log: Omit<ActivityLogResponse, "success">;
  }>;
};
