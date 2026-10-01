from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


ModelName = Literal["xgboost", "random_forest", "neural_network", "logistic_regression"]
RiskLevel = Literal["low", "moderate", "high"]
UserRole = Literal["ADMIN", "DOMAIN_EXPERT", "GENERAL_USER"]
PatientCaseStatus = Literal["active", "archived"]
BatchRowStatus = Literal["success", "failed"]
PreviewRowStatus = Literal["valid", "invalid"]
BadgeTone = Literal["cyan", "green", "amber", "red", "slate", "purple"]
MetricIconName = Literal[
    "Activity",
    "AlertTriangle",
    "BarChart3",
    "DatabaseZap",
    "Gauge",
    "RefreshCw",
    "TrendingDown",
    "TrendingUp",
]


class PatientSummary(BaseModel):
    id: str = Field(..., examples=["patient-001"])
    name: str = Field(..., examples=["Sample Patient"])
    age: int = Field(..., ge=0, examples=[52])
    risk_level: RiskLevel = Field(..., examples=["moderate"])


class FraminghamFeatures(BaseModel):
    sex: Literal[0, 1]
    age: int = Field(..., ge=18, le=100)
    current_smoker: Literal[0, 1]
    cigs_per_day: float = Field(..., ge=0, le=100)
    bp_meds: Literal[0, 1]
    prevalent_stroke: Literal[0, 1]
    prevalent_hyp: Literal[0, 1]
    diabetes: Literal[0, 1]
    tot_chol: float = Field(..., ge=80, le=700)
    sys_bp: float = Field(..., ge=70, le=300)
    dia_bp: float = Field(..., ge=40, le=160)
    bmi: float = Field(..., ge=12, le=70)
    heart_rate: float = Field(..., ge=30, le=200)
    glucose: float = Field(..., ge=40, le=500)


class PredictionRequest(FraminghamFeatures):
    user_id: UUID | None = None
    patient_reference_id: str | None = Field(None, max_length=64)
    assessment_date: date | None = None
    visit_label: str | None = Field(None, max_length=120)
    model_name: ModelName = Field("logistic_regression")


class FeatureContribution(BaseModel):
    feature: str = Field(..., min_length=1)
    value: float


class ShapExplanation(BaseModel):
    base_value: float
    final_value: float
    contributions: list[FeatureContribution]


class LimeExplanation(BaseModel):
    contributions: list[FeatureContribution]


class XaiExplanation(BaseModel):
    shap: ShapExplanation
    lime: LimeExplanation
    summary: list[str] = Field(default_factory=list)


class PredictionResponse(BaseModel):
    model_name: ModelName
    risk_score: float = Field(..., ge=0, le=1)
    predicted_class: Literal[0, 1]
    risk_level: RiskLevel
    explanation: list[str] = Field(default_factory=list)
    model_version: str = Field(..., min_length=1)
    xai: XaiExplanation


class UserProfileRequest(BaseModel):
    user_id: UUID
    full_name: str | None = None
    email: str | None = None
    role: UserRole = "DOMAIN_EXPERT"


class UserProfileResponse(UserProfileRequest):
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PatientCaseRequest(BaseModel):
    user_id: UUID
    patient_reference_id: str = Field(..., min_length=1, max_length=64)
    case_status: PatientCaseStatus = "active"


class PatientCaseResponse(BaseModel):
    patient_case_id: UUID
    patient_reference_id: str
    created_by: UUID | None = None
    case_status: PatientCaseStatus
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DomainExpertFeedbackRequest(BaseModel):
    expert_id: UUID
    clinician_risk_level: RiskLevel | None = None
    agreement_level: int | None = Field(None, ge=1, le=5)
    is_clinically_acceptable: bool | None = None
    confidence_level: int | None = Field(None, ge=1, le=5)
    feedback_comment: str | None = Field(None, max_length=2000)
    use_for_future_retraining: bool = False


class DomainExpertFeedbackResponse(DomainExpertFeedbackRequest):
    feedback_id: UUID
    result_id: UUID
    created_at: datetime | None = None


class ModelInfo(BaseModel):
    name: ModelName
    display_name: str
    description: str


class ConfusionMatrix(BaseModel):
    true_negative: int = Field(..., ge=0)
    false_positive: int = Field(..., ge=0)
    false_negative: int = Field(..., ge=0)
    true_positive: int = Field(..., ge=0)


class CrossValidationMetrics(BaseModel):
    folds: int
    auc_roc_mean: float
    auc_roc_std: float
    brier_score_mean: float
    brier_score_std: float


class ModelMetricsResponse(BaseModel):
    model_name: ModelName
    accuracy: float = Field(..., ge=0, le=1)
    precision: float = Field(..., ge=0, le=1)
    sensitivity_recall: float = Field(..., ge=0, le=1)
    specificity: float = Field(..., ge=0, le=1)
    f1_score: float = Field(..., ge=0, le=1)
    auc_roc: float = Field(..., ge=0, le=1)
    brier_score: float | None = Field(None, ge=0, le=1)
    decision_threshold: float | None = Field(None, ge=0, le=1)
    cross_validation: CrossValidationMetrics | None = None
    confusion_matrix: ConfusionMatrix


class ModelMetricsListResponse(BaseModel):
    metrics: list[ModelMetricsResponse] = Field(default_factory=list)


class GlobalShapFeatureImportance(BaseModel):
    rank: int = Field(..., ge=1)
    feature: str = Field(..., min_length=1)
    display_name: str | None = None
    mean_abs_shap: float = Field(..., ge=0)


class GlobalShapModelInfo(BaseModel):
    model_name: ModelName
    display_name: str | None = None
    model_version: str | None = None


class GlobalShapExplanationResponse(BaseModel):
    global_explanation_id: UUID | str
    model_id: UUID | str
    dataset_name: str | None = None
    samples_explained: int | None = Field(None, ge=0)
    explainer_type: str | None = None
    explanation_scope: str | None = None
    feature_importance: list[GlobalShapFeatureImportance] = Field(default_factory=list)
    beeswarm_data: object | None = None
    dependence_data: object | None = None
    summary_text: str | None = None
    generation_status: str | None = None
    generated_at: datetime | None = None
    updated_at: datetime | None = None
    ml_models: GlobalShapModelInfo | None = None


class BatchPredictionRowResult(BaseModel):
    row_number: int = Field(..., ge=1)
    patient_reference_id: str | None = Field(None, max_length=64)
    risk_score: float | None = Field(None, ge=0, le=1)
    predicted_class: Literal[0, 1] | None = None
    risk_level: RiskLevel | None = None
    explanation: list[str] | None = None
    xai: XaiExplanation | None = None
    model_version: str | None = None
    status: BatchRowStatus
    error_message: str | None = None


class BatchPredictionSummary(BaseModel):
    total_rows: int = Field(..., ge=0)
    successful_rows: int = Field(..., ge=0)
    failed_rows: int = Field(..., ge=0)


class BatchPredictionResponse(BaseModel):
    model_name: ModelName
    summary: BatchPredictionSummary
    results: list[BatchPredictionRowResult]


PatientReferenceMode = Literal["csv_column", "auto_generate", "single_case"]


class BatchUploadResponse(BaseModel):
    success: bool
    upload_id: UUID


class BatchPreviewRequest(BaseModel):
    upload_id: UUID
    user_id: UUID | None = None
    model_name: ModelName
    patient_reference_mode: PatientReferenceMode = "csv_column"
    single_patient_reference_id: str | None = Field(None, max_length=64)


class BatchPreviewRow(BaseModel):
    row_number: int = Field(..., ge=1)
    patient_reference_id: str | None = Field(None, max_length=64)
    status: PreviewRowStatus
    errors: list[str] = Field(default_factory=list)
    will_create_patient_case: bool = False
    existing_patient_case_id: UUID | None = None


class BatchPreviewResponse(BaseModel):
    success: bool
    upload_id: UUID
    summary: dict[str, int]
    rows: list[BatchPreviewRow]


class BatchConfirmRequest(BaseModel):
    user_id: UUID | None = None
    model_name: ModelName
    patient_reference_mode: PatientReferenceMode = "csv_column"
    single_patient_reference_id: str | None = Field(None, max_length=64)


class AdminSummaryMetric(BaseModel):
    model_name: str
    count: int = Field(..., ge=0)


class AdminSummary(BaseModel):
    total_users: int = Field(..., ge=0)
    total_predictions: int = Field(..., ge=0)
    total_uploads: int = Field(..., ge=0)
    successful_batch_rows: int = Field(..., ge=0)
    failed_batch_rows: int = Field(..., ge=0)
    model_usage: list[AdminSummaryMetric] = Field(default_factory=list)


class DashboardMetric(BaseModel):
    label: str
    value: str
    detail: str
    icon: MetricIconName
    tone: BadgeTone


class PerformanceTrendPoint(BaseModel):
    day: str
    auc: float = Field(..., ge=0, le=1)
    f1: float = Field(..., ge=0, le=1)
    calibration: float = Field(..., ge=0, le=1)


class ModelComparisonMetric(BaseModel):
    model: str
    accuracy: int = Field(..., ge=0, le=100)
    auc: int = Field(..., ge=0, le=100)
    precision: int = Field(..., ge=0, le=100)
    recall: int = Field(..., ge=0, le=100)
    f1: int = Field(..., ge=0, le=100)


class AdminPerformanceMonitoring(BaseModel):
    metrics: list[DashboardMetric] = Field(default_factory=list)
    trend: list[PerformanceTrendPoint] = Field(default_factory=list)
    model_comparison: list[ModelComparisonMetric] = Field(default_factory=list)


class FairnessCohortMetric(BaseModel):
    group: str
    sample: str
    tpr: str
    fpr: str
    gap: str
    disparity: float
    status: str
    tone: BadgeTone


class FairnessChartPoint(BaseModel):
    cohort: str
    disparity: float


class AdminFairnessMonitoring(BaseModel):
    cohorts: list[FairnessCohortMetric] = Field(default_factory=list)
    chart: list[FairnessChartPoint] = Field(default_factory=list)
    watch_count: int = Field(..., ge=0)


class DriftTrendPoint(BaseModel):
    day: str
    bp: float = Field(..., ge=0)
    hr: float = Field(..., ge=0)
    cholesterol: float = Field(..., ge=0)


class DriftFeatureMetric(BaseModel):
    feature: str
    psi: float = Field(..., ge=0)
    status: str
    tone: BadgeTone


class AdminDriftMonitoring(BaseModel):
    metrics: list[DashboardMetric] = Field(default_factory=list)
    trend: list[DriftTrendPoint] = Field(default_factory=list)
    features: list[DriftFeatureMetric] = Field(default_factory=list)
    active_alerts: int = Field(..., ge=0)


class ErrorQueueRow(BaseModel):
    id: str
    patient: str
    issue: str
    source: str
    time: str
    status: str
    tone: BadgeTone


class ErrorTrendPoint(BaseModel):
    day: str
    failed: int = Field(..., ge=0)
    resolved: int = Field(..., ge=0)


class AdminErrorMonitoring(BaseModel):
    rows: list[ErrorQueueRow] = Field(default_factory=list)
    trend: list[ErrorTrendPoint] = Field(default_factory=list)
    open_failures: int = Field(..., ge=0)
    resolved_today: int = Field(..., ge=0)
    sla: int = Field(..., ge=0, le=100)


class AdminMonitoringDashboard(BaseModel):
    summary: AdminSummary
    performance: AdminPerformanceMonitoring
    fairness: AdminFairnessMonitoring
    drift: AdminDriftMonitoring
    errors: AdminErrorMonitoring
    last_updated: datetime


class AdminSummaryResponse(BaseModel):
    success: bool
    summary: AdminSummary


class AdminMonitoringResponse(BaseModel):
    success: bool
    dashboard: AdminMonitoringDashboard


class ActivityLogEntry(BaseModel):
    log_id: UUID | str
    timestamp: datetime
    actor: UUID | str | None = None
    event_type: str
    action: str
    entity_type: str | None = None
    entity_id: UUID | str | None = None
    status: Literal["success", "warning", "failed"] = "success"


class ActivityLogResponse(BaseModel):
    success: bool
    items: list[ActivityLogEntry] = Field(default_factory=list)
    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)


# =========================
# CLINICIAN WORKFLOW
# =========================
BinaryFlag = Literal[0, 1]
DataSource = Literal["clinician", "clinician_verified", "lab", "self_reported", "imported"]
MeasurementSource = Literal["clinician", "lab", "self_reported", "imported"]
ClinicalAction = Literal["none", "lifestyle", "start_or_adjust_medication", "refer", "further_tests"]
ReviewStatus = Literal["draft", "signed_off"]


class PatientHistory(BaseModel):
    sex: BinaryFlag | None = None
    current_smoker: BinaryFlag | None = None
    cigs_per_day: float | None = Field(None, ge=0, le=100)
    bp_meds: BinaryFlag | None = None
    prevalent_stroke: BinaryFlag | None = None
    prevalent_hyp: BinaryFlag | None = None
    diabetes: BinaryFlag | None = None


class PatientProfileCreate(PatientHistory):
    clinician_id: UUID
    patient_reference_id: str | None = Field(None, max_length=64)
    display_name: str | None = Field(None, max_length=120)
    date_of_birth: date | None = None
    history_source: DataSource = "clinician"


class PatientProfileUpdate(PatientHistory):
    clinician_id: UUID
    display_name: str | None = Field(None, max_length=120)
    date_of_birth: date | None = None
    case_status: PatientCaseStatus | None = None
    history_source: DataSource = "clinician"


class MeasurementCreate(BaseModel):
    recorded_by: UUID | None = None
    measured_at: datetime | None = None
    sys_bp: float | None = Field(None, ge=70, le=300)
    dia_bp: float | None = Field(None, ge=40, le=160)
    heart_rate: float | None = Field(None, ge=30, le=200)
    height_cm: float | None = Field(None, ge=100, le=250)
    weight_kg: float | None = Field(None, ge=25, le=300)
    bmi: float | None = Field(None, ge=12, le=70)
    tot_chol: float | None = Field(None, ge=80, le=700)
    glucose: float | None = Field(None, ge=40, le=500)
    source: MeasurementSource = "clinician"
    notes: str | None = Field(None, max_length=1000)


class AssessmentCreate(BaseModel):
    clinician_id: UUID
    # Today's readings; saved as a new measurement before the assessment runs.
    measurement: MeasurementCreate | None = None
    # History values the clinician confirmed or corrected during the visit.
    history: PatientHistory | None = None
    # Research mode only: otherwise the admin-selected default model is used.
    model_name: ModelName | None = None
    visit_label: str | None = Field(None, max_length=120)


class ClinicalReviewRequest(BaseModel):
    clinician_id: UUID
    clinician_risk_level: RiskLevel | None = None
    agreement_level: int | None = Field(None, ge=1, le=5)
    is_clinically_acceptable: bool | None = None
    confidence_level: int | None = Field(None, ge=1, le=5)
    flagged_features: list[str] = Field(default_factory=list)
    clinical_action: ClinicalAction | None = None
    feedback_comment: str | None = Field(None, max_length=2000)
    use_for_future_retraining: bool = False
    sign_off: bool = False


class DefaultModelRequest(BaseModel):
    admin_id: UUID | None = None
    model_name: ModelName
