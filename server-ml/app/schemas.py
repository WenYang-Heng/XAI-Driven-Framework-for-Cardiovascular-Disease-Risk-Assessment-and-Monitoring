from typing import Literal

from pydantic import BaseModel, Field


ModelName = Literal["xgboost", "random_forest", "neural_network", "logistic_regression"]


class RiskPredictionRequest(BaseModel):
    model_name: ModelName = Field("logistic_regression", description="ML model to use for prediction")
    age: int = Field(..., ge=0, le=120, examples=[55])
    sex: Literal[0, 1] = Field(..., description="1 = male; 0 = female", examples=[1])
    cp: Literal[1, 2, 3, 4] = Field(..., description="Chest pain type", examples=[4])
    trestbps: float = Field(..., gt=0, description="Resting blood pressure in mm Hg", examples=[145])
    chol: float = Field(..., gt=0, description="Serum cholesterol in mg/dl", examples=[220])
    fbs: Literal[0, 1] = Field(..., description="Fasting blood sugar > 120 mg/dl", examples=[0])
    restecg: Literal[0, 1, 2] = Field(..., description="Resting ECG results", examples=[1])
    thalach: float = Field(..., gt=0, description="Maximum heart rate achieved", examples=[150])
    exang: Literal[0, 1] = Field(..., description="Exercise induced angina", examples=[1])
    oldpeak: float = Field(..., ge=0, description="ST depression induced by exercise relative to rest", examples=[1.4])
    slope: Literal[1, 2, 3] = Field(..., description="Slope of peak exercise ST segment", examples=[2])
    ca: int = Field(..., ge=0, le=3, description="Number of major vessels colored by fluoroscopy", examples=[0])
    thal: Literal[3, 6, 7] = Field(..., description="3 = normal; 6 = fixed defect; 7 = reversible defect", examples=[7])


class RiskPredictionResponse(BaseModel):
    model_name: ModelName
    risk_score: float = Field(..., ge=0, le=1, examples=[0.68])
    predicted_class: Literal[0, 1] = Field(..., description="0 = no heart disease; 1 = heart disease")
    risk_level: Literal["low", "moderate", "high"] = Field(..., examples=["high"])
    explanation: list[str] = Field(..., examples=[["Exercise induced angina increased the risk estimate."]])
    model_version: str = Field(..., examples=["uci-heart-logistic-regression"])


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


class ModelInfo(BaseModel):
    name: ModelName
    display_name: str
    description: str


class ModelListResponse(BaseModel):
    models: list[ModelInfo]


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


class DatasetSummary(BaseModel):
    dataset_id: int
    dataset_name: str
    input_features: list[str]
    target: str
    rows_after_cleaning: int
