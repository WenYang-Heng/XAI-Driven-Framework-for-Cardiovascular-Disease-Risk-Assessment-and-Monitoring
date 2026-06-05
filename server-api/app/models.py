from typing import Literal
from typing import Any

from pydantic import BaseModel, Field, model_validator


ModelName = Literal["xgboost", "random_forest", "neural_network", "logistic_regression"]


class PatientSummary(BaseModel):
    id: str = Field(..., examples=["patient-001"])
    name: str = Field(..., examples=["Sample Patient"])
    age: int = Field(..., ge=0, examples=[52])
    risk_level: str = Field(..., examples=["moderate"])


class PredictionRequest(BaseModel):
    user_id: str | None = None
    patient_reference_id: str | None = Field(None, max_length=64)
    assessment_date: str | None = None
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
    feature: str
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
    summary: list[str]


class PredictionResponse(BaseModel):
    model_name: ModelName
    risk_score: float
    predicted_class: Literal[0, 1]
    risk_level: Literal["low", "moderate", "high"]
    explanation: list[str]
    model_version: str
    xai: XaiExplanation


class UserProfileRequest(BaseModel):
    user_id: str
    full_name: str | None = None
    email: str | None = None
    role: Literal["ADMIN", "DOMAIN_EXPERT", "PATIENT"] = "DOMAIN_EXPERT"


class UserProfileResponse(UserProfileRequest):
    created_at: str | None = None
    updated_at: str | None = None


class PatientCaseRequest(BaseModel):
    user_id: str
    patient_reference_id: str = Field(..., min_length=1, max_length=64)
    case_status: Literal["active", "archived"] = "active"


class PatientCaseResponse(BaseModel):
    patient_case_id: str
    patient_reference_id: str
    created_by: str | None = None
    case_status: str
    created_at: str | None = None
    updated_at: str | None = None


class DomainExpertFeedbackRequest(BaseModel):
    expert_id: str
    clinician_risk_level: Literal["low", "moderate", "high"] | None = None
    agreement_level: int | None = Field(None, ge=1, le=5)
    is_clinically_acceptable: bool | None = None
    confidence_level: int | None = Field(None, ge=1, le=5)
    feedback_comment: str | None = None
    use_for_future_retraining: bool = False


class DomainExpertFeedbackResponse(DomainExpertFeedbackRequest):
    feedback_id: str
    result_id: str
    created_at: str | None = None


class ModelInfo(BaseModel):
    name: ModelName
    display_name: str
    description: str


class ConfusionMatrix(BaseModel):
    true_negative: int
    false_positive: int
    false_negative: int
    true_positive: int


class ModelMetricsResponse(BaseModel):
    model_name: ModelName
    accuracy: float
    precision: float
    sensitivity_recall: float
    specificity: float
    f1_score: float
    auc_roc: float
    confusion_matrix: ConfusionMatrix


class BatchPredictionRowResult(BaseModel):
    row_number: int
    patient_reference_id: str | None = None
    risk_score: float | None = None
    predicted_class: int | None = None
    risk_level: str | None = None
    explanation: list[str] | None = None
    xai: XaiExplanation | None = None
    model_version: str | None = None
    status: Literal["success", "failed"]
    error_message: str | None = None


class BatchPredictionSummary(BaseModel):
    total_rows: int
    successful_rows: int
    failed_rows: int


class BatchPredictionResponse(BaseModel):
    model_name: ModelName
    summary: BatchPredictionSummary
    results: list[BatchPredictionRowResult]


PatientReferenceMode = Literal["csv_column", "auto_generate", "single_case"]


class BatchUploadResponse(BaseModel):
    success: bool
    upload_id: str


class BatchPreviewRequest(BaseModel):
    upload_id: str
    user_id: str | None = None
    model_name: ModelName
    patient_reference_mode: PatientReferenceMode = "csv_column"
    single_patient_reference_id: str | None = None


class BatchPreviewRow(BaseModel):
    row_number: int
    patient_reference_id: str | None = None
    status: Literal["valid", "invalid"]
    errors: list[str] = []
    will_create_patient_case: bool = False
    existing_patient_case_id: str | None = None


class BatchPreviewResponse(BaseModel):
    success: bool
    upload_id: str
    summary: dict[str, int]
    rows: list[BatchPreviewRow]


class BatchConfirmRequest(BaseModel):
    user_id: str | None = None
    model_name: ModelName
    patient_reference_mode: PatientReferenceMode = "csv_column"
    single_patient_reference_id: str | None = None


PatientSex = Literal["female", "male"]
PatientInputType = Literal["exact", "category", "unknown"]
BpCategory = Literal["low", "normal", "elevated", "stage_1", "stage_2", "crisis"]
CholesterolCategory = Literal["desirable", "borderline", "high"]
DiabetesHistory = Literal["no", "prediabetes", "yes", "unsure"]
SmokingStatus = Literal["no", "former", "yes"]
ActivityLevel = Literal["low", "medium", "high"]
WeightCategory = Literal["healthy", "overweight", "obese", "unsure"]
PatientRiskLevel = Literal["low", "moderate", "high"]
PatientConfidenceLevel = Literal["low", "medium", "high"]


class PatientAssessmentRequest(BaseModel):
    user_id: str
    age: int = Field(..., ge=18, le=120)
    sex: PatientSex
    bp_input_type: PatientInputType
    systolic_bp: float | None = Field(None, ge=70, le=260)
    bp_category: BpCategory | None = None
    cholesterol_input_type: PatientInputType
    total_cholesterol: float | None = Field(None, ge=80, le=500)
    cholesterol_category: CholesterolCategory | None = None
    diabetes_history: DiabetesHistory = "unsure"
    smoking_status: SmokingStatus = "no"
    activity_level: ActivityLevel = "medium"
    weight: float | None = Field(None, ge=20, le=350)
    weight_category: WeightCategory = "unsure"

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
    explanation: list[str]


class PatientAssessmentResponse(BaseModel):
    success: bool
    assessment_id: str | None = None
    assessment_input_id: str | None = None
    prediction: PatientAssessmentPrediction


ActionPriority = Literal["low", "medium", "high"]
ActionDifficulty = Literal["easy", "moderate", "hard"]
ReminderRepeat = Literal["none", "daily", "weekly", "twice_weekly"]
ReminderStatus = Literal["scheduled", "completed"]


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
    repeat_interval: ReminderRepeat = "none"


class ReminderUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=160)
    description: str | None = Field(None, max_length=500)
    reminder_time: str | None = None
    linked_item: str | None = Field(None, max_length=160)
    repeat_interval: ReminderRepeat | None = None
    status: ReminderStatus | None = None


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
