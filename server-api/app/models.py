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


class PredictionResponse(BaseModel):
    model_name: ModelName
    risk_score: float
    predicted_class: Literal[0, 1]
    risk_level: Literal["low", "moderate", "high"]
    explanation: list[str]
    model_version: str


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
    risk_score: float | None = None
    predicted_class: int | None = None
    risk_level: str | None = None
    explanation: list[str] | None = None
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
