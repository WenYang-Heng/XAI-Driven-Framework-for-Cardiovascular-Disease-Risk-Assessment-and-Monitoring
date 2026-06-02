from typing import Literal

from pydantic import BaseModel, Field


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
