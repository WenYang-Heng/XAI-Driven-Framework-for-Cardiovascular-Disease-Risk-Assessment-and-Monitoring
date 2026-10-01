from fastapi import APIRouter

from app.schemas import (
    GlobalShapRequest,
    GlobalShapResponse,
    ModelListResponse,
    ModelMetricsListResponse,
    ModelMetricsResponse,
    ModelName,
    ModelScoresResponse,
    RiskPredictionRequest,
    RiskPredictionResponse,
)
from app.services.risk_model import (
    all_model_metrics,
    compute_global_shap,
    get_model_metrics,
    list_models,
    predict_risk,
    score_all_models,
)


router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=RiskPredictionResponse)
def predict(request: RiskPredictionRequest) -> RiskPredictionResponse:
    return predict_risk(request)


@router.post("/predict/scores", response_model=ModelScoresResponse)
def predict_scores(request: RiskPredictionRequest) -> ModelScoresResponse:
    return score_all_models(request)


@router.post("/explanations/global-shap", response_model=GlobalShapResponse)
def global_shap(request: GlobalShapRequest) -> GlobalShapResponse:
    return compute_global_shap(request.model_name)


@router.get("/models", response_model=ModelListResponse)
def models() -> ModelListResponse:
    return list_models()


@router.get("/models/metrics", response_model=ModelMetricsListResponse)
def models_metrics() -> ModelMetricsListResponse:
    return all_model_metrics()


@router.get("/models/{model_name}/metrics", response_model=ModelMetricsResponse)
def model_metrics(model_name: ModelName) -> ModelMetricsResponse:
    return get_model_metrics(model_name)
