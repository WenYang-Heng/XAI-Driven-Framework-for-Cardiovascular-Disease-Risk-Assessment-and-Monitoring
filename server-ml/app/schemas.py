from typing import Any, Literal

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
    ca: int = Field(..., ge=0, le=3, description="Number of Major Vessels Coloured by Fluoroscopy", examples=[0])
    thal: Literal[3, 6, 7] = Field(..., description="3 = normal; 6 = fixed defect; 7 = reversible defect", examples=[7])


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
    predicted_class: Literal[0, 1] = Field(..., description="0 = no heart disease; 1 = heart disease")
    risk_level: Literal["low", "moderate", "high"] = Field(..., examples=["high"])
    explanation: list[str] = Field(..., examples=[["Exercise induced angina increased the risk estimate."]])
    model_version: str = Field(..., examples=["uci-heart-logistic-regression"])
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


class ModelMetricsResponse(BaseModel):
    model_name: ModelName
    accuracy: float
    precision: float
    sensitivity_recall: float
    specificity: float
    f1_score: float
    auc_roc: float
    confusion_matrix: ConfusionMatrix


class ModelMetricsListResponse(BaseModel):
    metrics: list[ModelMetricsResponse]


class DatasetSummary(BaseModel):
    dataset_id: int
    dataset_name: str
    input_features: list[str]
    target: str
    rows_after_cleaning: int


class FairnessGroupMetrics(BaseModel):
    group: str
    sample_size: int
    prevalence: float | None = None
    selection_rate: float | None = None
    true_positive_rate: float | None = None
    false_positive_rate: float | None = None
    accuracy: float | None = None
    is_reference: bool = False
    tpr_gap: float | None = None
    fpr_gap: float | None = None
    selection_rate_gap: float | None = None
    disparate_impact: float | None = None
    limited_confidence: bool = False


class FairnessAttributeResult(BaseModel):
    attribute: str
    label: str
    reference_group: str
    demographic_parity_difference: float | None = None
    equal_opportunity_difference: float | None = None
    status: Literal["within_limit", "watch", "investigate"]
    groups: list[FairnessGroupMetrics]


class FairnessResponse(BaseModel):
    model_name: ModelName
    evaluation_method: str
    sample_size: int
    min_group_size: int
    thresholds: dict[str, float]
    attributes: list[FairnessAttributeResult]


class DriftRecord(BaseModel):
    day: str | None = Field(None, description="ISO date the assessment was made, used for the daily trend")
    age: float
    sex: float
    cp: float
    trestbps: float
    chol: float
    fbs: float
    restecg: float
    thalach: float
    exang: float
    oldpeak: float
    slope: float
    ca: float
    thal: float


class DriftRequest(BaseModel):
    records: list[DriftRecord] = Field(default_factory=list, max_length=50_000)


class DriftDistributionBin(BaseModel):
    bin: str
    baseline: float
    current: float


class DriftFeatureResult(BaseModel):
    feature: str
    label: str
    kind: Literal["numeric", "categorical"]
    psi: float
    status: Literal["stable", "moderate", "significant", "no_data"]
    baseline_mean: float
    current_mean: float | None = None
    distribution: list[DriftDistributionBin]


class DriftTrendPoint(BaseModel):
    day: str
    records: int
    psi: dict[str, float] = Field(default_factory=dict)


class DriftResponse(BaseModel):
    method: str
    baseline: str
    baseline_size: int
    current_size: int
    limited_confidence: bool
    min_records: int
    thresholds: dict[str, float]
    overall_psi: float
    features: list[DriftFeatureResult]
    trend: list[DriftTrendPoint]


class FraminghamRiskRequest(BaseModel):
    """Patient inputs for the Framingham score card. Only fields used by the card are required."""

    male: Literal[0, 1] | None = Field(None, description="1 = male; 0 = female", examples=[1])
    age: float | None = Field(None, ge=0, le=120, examples=[52])
    currentSmoker: Literal[0, 1] | None = Field(None, examples=[1])
    cigsPerDay: float | None = Field(None, ge=0, description="Cigarettes smoked per day", examples=[15])
    BPMeds: Literal[0, 1] | None = Field(None, description="Takes blood pressure medication", examples=[0])
    prevalentStroke: Literal[0, 1] | None = Field(None, description="Has had a stroke", examples=[0])
    prevalentHyp: Literal[0, 1] | None = Field(None, description="Diagnosed with hypertension", examples=[1])
    diabetes: Literal[0, 1] | None = Field(None, examples=[0])
    totChol: float | None = Field(None, gt=0, description="Total cholesterol in mg/dL", examples=[230])
    sysBP: float | None = Field(None, gt=0, description="Systolic blood pressure in mmHg", examples=[145])
    diaBP: float | None = Field(None, gt=0, description="Diastolic blood pressure in mmHg", examples=[90])
    BMI: float | None = Field(None, gt=0, examples=[27.5])
    heartRate: float | None = Field(None, gt=0, description="Resting heart rate in bpm", examples=[75])
    glucose: float | None = Field(None, gt=0, description="Glucose in mg/dL", examples=[85])


class ScoreCardItem(BaseModel):
    label: str
    field: str
    threshold: float
    points: int


class ScoreCardLine(ScoreCardItem):
    applies: bool = Field(..., description="Whether the patient meets this rule and gets its points")


class ScoreToRisk(BaseModel):
    total_points: int
    risk: float


class FraminghamScoreCardResponse(BaseModel):
    name: str
    description: str
    dataset: str
    outcome: str
    intercept: float
    multiplier: float
    items: list[ScoreCardItem]
    score_to_risk: list[ScoreToRisk]
    metrics: dict[str, float]


class FraminghamRiskResponse(BaseModel):
    total_points: int
    risk: float = Field(..., ge=0, le=1, description="Estimated 10-year CHD risk")
    risk_level: Literal["low", "moderate", "high"]
    breakdown: list[ScoreCardLine]


FraminghamModelName = Literal["xgboost", "random_forest", "neural_network", "logistic_regression"]


class FraminghamModelPredictionRequest(FraminghamRiskRequest):
    """Same inputs as the score card, but the ML models need all of them."""

    model_name: FraminghamModelName = Field("xgboost", description="ML model to use for prediction")


class FraminghamModelPredictionResponse(BaseModel):
    model_name: FraminghamModelName
    risk: float = Field(..., ge=0, le=1, description="Estimated 10-year CHD risk")
    risk_level: Literal["low", "moderate", "high"]
    shap: ShapExplanation
    lime: LimeExplanation


class FraminghamModelMetrics(BaseModel):
    model_name: str
    train_auc: float
    test_auc: float
    test_brier_score: float = Field(..., description="Mean squared error of the predicted risk; lower is better")


class FraminghamModelMetricsListResponse(BaseModel):
    metrics: list[FraminghamModelMetrics]
