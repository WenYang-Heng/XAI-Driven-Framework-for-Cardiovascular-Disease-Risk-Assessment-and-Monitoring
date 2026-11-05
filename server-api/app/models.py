from datetime import UTC, date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


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


PatientSex = Literal["female", "male"]
PatientInputType = Literal["exact", "category", "unknown"]
BpCategory = Literal["normal", "above_normal", "well_above_normal"]
CholesterolCategory = Literal["normal", "above_normal", "well_above_normal"]
DiabetesHistory = Literal["no", "prediabetes", "yes", "unsure"]
SmokingStatus = Literal["no", "yes"]
ActivityLevel = Literal["low", "medium", "high"]
WeightCategory = Literal["healthy", "overweight", "obese", "unsure"]
PatientRiskLevel = Literal["low", "moderate", "high"]
PatientConfidenceLevel = Literal["low", "medium", "high"]
GlucoseCategory = Literal["normal", "above_normal", "well_above_normal", "unknown"]
YesNo = Literal["yes", "no"]


class PatientAssessmentRequest(BaseModel):
    user_id: str
    age: int = Field(..., ge=18, le=120)
    sex: PatientSex
    height_cm: float | None = Field(None, ge=120, le=220)
    bp_input_type: PatientInputType
    systolic_bp: float | None = Field(None, ge=70, le=260)
    diastolic_bp: float | None = Field(None, ge=40, le=140)
    bp_category: BpCategory | None = None
    cholesterol_input_type: PatientInputType
    total_cholesterol: float | None = Field(None, ge=80, le=500)
    cholesterol_category: CholesterolCategory | None = None
    glucose_category: GlucoseCategory = "unknown"
    diabetes_history: DiabetesHistory = "unsure"
    smoking_status: SmokingStatus = "no"
    activity_level: ActivityLevel = "medium"
    weight: float | None = Field(None, ge=20, le=350)
    weight_category: WeightCategory = "unsure"
    alcohol_intake: YesNo = "no"

    @model_validator(mode="after")
    def validate_input_modes(self) -> "PatientAssessmentRequest":
        if self.bp_input_type == "exact" and self.systolic_bp is None:
            raise ValueError("systolic_bp is required when bp_input_type is exact")
        if self.bp_input_type == "category" and self.bp_category is None:
            raise ValueError("bp_category is required when bp_input_type is category")
        if self.cholesterol_input_type == "exact" and self.total_cholesterol is None:
            raise ValueError("total_cholesterol is required when cholesterol_input_type is exact")
        if self.cholesterol_input_type == "category" and self.cholesterol_category is None:
            raise ValueError("cholesterol_category is required when cholesterol_input_type is category")
        if self.diastolic_bp is not None and self.systolic_bp is not None and self.diastolic_bp >= self.systolic_bp:
            raise ValueError("diastolic_bp must be lower than systolic_bp")
        return self


class PatientSimulationRequest(PatientAssessmentRequest):
    activity_minutes: float | None = Field(None, ge=0, le=2000)
    nicotine_exposure: float | None = Field(None, ge=0, le=100)
    target_bp: float | None = Field(None, ge=70, le=260)
    target_cholesterol: float | None = Field(None, ge=80, le=500)
    weight_change: float | None = Field(None, ge=-80, le=80)


class PatientAssessmentPrediction(BaseModel):
    risk_score: float = Field(..., ge=0, le=1)
    risk_level: PatientRiskLevel
    confidence_level: PatientConfidenceLevel
    prediction_method: str
    estimated_inputs: dict[str, float | None]
    missing_inputs: list[str]
    explanation: list[str] | dict[str, Any]


class PatientAssessmentResponse(BaseModel):
    success: bool
    assessment_id: str | None = None
    assessment_input_id: str | None = None
    prediction: PatientAssessmentPrediction


ActionPriority = Literal["low", "medium", "high"]
ActionDifficulty = Literal["easy", "moderate", "hard"]
ReminderRepeat = Literal[
    "once",
    "daily",
    "weekly",
    "custom",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]
ReminderStatus = Literal["scheduled", "completed"]
ReminderNotificationChannel = Literal["email", "in_app", "none"]
ReminderCustomMode = Literal["interval", "selected_days"]
ReminderCustomUnit = Literal["minutes", "hours", "days", "weeks"]


class ActionPlanGenerateRequest(BaseModel):
    assessment_id: str
    user_id: str
    regenerate: bool = False


class ActionPlanItemPayload(BaseModel):
    title: str
    priority: ActionPriority
    factor: str
    difficulty: ActionDifficulty
    reason: str
    timeframe: str
    specific_examples: list[str]
    next_step: str
    barrier_plan: str
    measure: str
    status: str = "not_started"


class ActionPlanPayload(BaseModel):
    title: str
    summary: str
    items: list[ActionPlanItemPayload] = Field(..., min_length=2, max_length=5)
    disclaimer: str


class ActionPlanGenerateResponse(BaseModel):
    action_plan: dict


ChatRole = Literal["user", "assistant"]


class ChatbotHistoryMessage(BaseModel):
    role: ChatRole
    content: str = Field(..., min_length=1, max_length=500)


class ChatbotMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)
    page_context: dict[str, Any] = Field(default_factory=lambda: {"page": "unknown"})
    conversation_history: list[ChatbotHistoryMessage] = Field(default_factory=list, max_length=6)


class ChatbotMessageResponse(BaseModel):
    reply: str
    suggested_questions: list[str]


class ReminderRequest(BaseModel):
    user_id: str
    title: str = Field(..., min_length=1, max_length=160)
    description: str | None = Field(None, max_length=500)
    reminder_time: str
    linked_item: str | None = Field(None, max_length=160)
    repeat_interval: ReminderRepeat = "once"
    custom_mode: ReminderCustomMode | None = None
    custom_interval: int | None = Field(None, gt=0)
    custom_unit: ReminderCustomUnit | None = None
    selected_days: list[ReminderRepeat] = Field(default_factory=list)
    email_enabled: bool = True
    notification_channel: ReminderNotificationChannel = "email"

    @model_validator(mode="after")
    def validate_repeat_settings(self) -> "ReminderRequest":
        if _parse_reminder_datetime(self.reminder_time) <= datetime.now(UTC):
            raise ValueError("reminder_time must be later than the current time")
        if self.repeat_interval != "custom":
            return self
        if self.custom_mode == "interval":
            if self.custom_interval is None or self.custom_unit is None:
                raise ValueError("custom_interval and custom_unit are required for custom interval reminders")
        elif self.custom_mode == "selected_days":
            valid_days = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
            if not self.selected_days or any(day not in valid_days for day in self.selected_days):
                raise ValueError("selected_days must include at least one weekday")
        else:
            raise ValueError("custom_mode is required when repeat_interval is custom")
        return self


class ReminderUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=160)
    description: str | None = Field(None, max_length=500)
    reminder_time: str | None = None
    linked_item: str | None = Field(None, max_length=160)
    repeat_interval: ReminderRepeat | None = None
    custom_mode: ReminderCustomMode | None = None
    custom_interval: int | None = Field(None, gt=0)
    custom_unit: ReminderCustomUnit | None = None
    selected_days: list[ReminderRepeat] | None = None
    status: ReminderStatus | None = None
    email_enabled: bool | None = None
    notification_channel: ReminderNotificationChannel | None = None

    @model_validator(mode="after")
    def validate_reminder_time(self) -> "ReminderUpdateRequest":
        if self.reminder_time and _parse_reminder_datetime(self.reminder_time) <= datetime.now(UTC):
            raise ValueError("reminder_time must be later than the current time")
        return self


class ReminderResponse(BaseModel):
    reminder: dict


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


def _parse_reminder_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)
