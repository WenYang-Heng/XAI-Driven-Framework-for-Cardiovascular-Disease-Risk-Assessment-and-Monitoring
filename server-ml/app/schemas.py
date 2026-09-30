from typing import Any, Literal

from pydantic import BaseModel, Field


ModelName = Literal["xgboost", "random_forest", "neural_network", "logistic_regression"]


class RiskPredictionRequest(BaseModel):
    model_name: ModelName = Field("logistic_regression", description="ML model to use for prediction")
    sex: Literal[0, 1] = Field(..., description="1 = male; 0 = female", examples=[1])
    age: int = Field(..., ge=18, le=100, examples=[55])
    current_smoker: Literal[0, 1] = Field(..., description="1 = currently smokes", examples=[1])
    cigs_per_day: float = Field(..., ge=0, le=100, description="Cigarettes smoked per day", examples=[10])
    bp_meds: Literal[0, 1] = Field(..., description="1 = on blood pressure medication", examples=[0])
    prevalent_stroke: Literal[0, 1] = Field(..., description="1 = previous stroke", examples=[0])
    prevalent_hyp: Literal[0, 1] = Field(..., description="1 = diagnosed hypertension", examples=[1])
    diabetes: Literal[0, 1] = Field(..., description="1 = diabetic", examples=[0])
    tot_chol: float = Field(..., ge=80, le=700, description="Total cholesterol in mg/dL", examples=[240])
    sys_bp: float = Field(..., ge=70, le=300, description="Systolic blood pressure in mmHg", examples=[145])
    dia_bp: float = Field(..., ge=40, le=160, description="Diastolic blood pressure in mmHg", examples=[90])
    bmi: float = Field(..., ge=12, le=70, description="Body mass index in kg/m2", examples=[27.5])
    heart_rate: float = Field(..., ge=30, le=200, description="Resting heart rate in bpm", examples=[75])
    glucose: float = Field(..., ge=40, le=500, description="Glucose in mg/dL", examples=[85])


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


class GlobalShapRequest(BaseModel):
    model_name: ModelName


class GlobalShapFeatureImportance(BaseModel):
    feature: str
    display_name: str
    mean_abs_shap: float
    rank: int


class GlobalShapResponse(BaseModel):
    model_name: ModelName
    dataset_name: str
    samples_explained: int
    explainer_type: str | None
    feature_importance: list[GlobalShapFeatureImportance]
    beeswarm_data: Any | None = None
    dependence_data: Any | None = None
    summary_text: str | None = None
    generation_status: Literal["completed", "failed", "unavailable"]
    error_message: str | None = None


class RiskPredictionResponse(BaseModel):
    model_name: ModelName
    risk_score: float = Field(..., ge=0, le=1, examples=[0.68])
    predicted_class: Literal[0, 1] = Field(..., description="1 = high 10-year CHD risk (score >= 0.20)")
    risk_level: Literal["low", "moderate", "high"] = Field(..., examples=["high"])
    explanation: list[str] = Field(..., examples=[["Exercise induced angina increased the risk estimate."]])
    model_version: str = Field(..., examples=["framingham-chd10-logistic_regression"])
    xai: XaiExplanation


class BatchPredictionRowResult(BaseModel):
    row_number: int
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


class CrossValidationMetrics(BaseModel):
    folds: int
    auc_roc_mean: float
    auc_roc_std: float
    brier_score_mean: float
    brier_score_std: float


class ModelMetricsResponse(BaseModel):
    model_name: ModelName
    accuracy: float
    precision: float
    sensitivity_recall: float
    specificity: float
    f1_score: float
    auc_roc: float
    brier_score: float
    decision_threshold: float
    cross_validation: CrossValidationMetrics | None = None
    confusion_matrix: ConfusionMatrix


class ModelMetricsListResponse(BaseModel):
    metrics: list[ModelMetricsResponse]


class DatasetSummary(BaseModel):
    dataset_name: str
    input_features: list[str]
    target: str
    rows: int
    positive_rate: float
    missing_values: dict[str, int]
