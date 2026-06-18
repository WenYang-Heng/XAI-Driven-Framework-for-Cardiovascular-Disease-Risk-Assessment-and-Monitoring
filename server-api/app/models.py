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


class PredictionRequest(BaseModel):
    user_id: UUID | None = None
    patient_reference_id: str | None = Field(None, max_length=64)
    assessment_date: date | None = None
    visit_label: str | None = Field(None, max_length=120)
    model_name: ModelName = Field("logistic_regression")
    age: int = Field(..., ge=0, le=120)
    sex: Literal[0, 1]
    cp: Literal[1, 2, 3, 4]
    trestbps: float = Field(..., gt=0)
    chol: float = Field(..., gt=0)
    fbs: Literal[0, 1]
    restecg: Literal[0, 1, 2]
    thalach: float = Field(..., gt=0)
    exang: Literal[0, 1]
    oldpeak: float = Field(..., ge=0)
    slope: Literal[1, 2, 3]
    ca: int = Field(..., ge=0, le=3)
    thal: Literal[3, 6, 7]


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


class ModelMetricsResponse(BaseModel):
    model_name: ModelName
    accuracy: float = Field(..., ge=0, le=1)
    precision: float = Field(..., ge=0, le=1)
    sensitivity_recall: float = Field(..., ge=0, le=1)
    specificity: float = Field(..., ge=0, le=1)
    f1_score: float = Field(..., ge=0, le=1)
    auc_roc: float = Field(..., ge=0, le=1)
    confusion_matrix: ConfusionMatrix


class ModelMetricsListResponse(BaseModel):
    metrics: list[ModelMetricsResponse] = Field(default_factory=list)


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


PREDICTION_FEATURES = [
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
]
