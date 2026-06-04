from fastapi import APIRouter

from app.schemas import ModelListResponse, ModelMetricsResponse, ModelName, RiskPredictionRequest, RiskPredictionResponse
from app.services.risk_model import get_model_metrics, list_models, predict_risk


router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=RiskPredictionResponse)
def predict(request: RiskPredictionRequest) -> RiskPredictionResponse:
    return predict_risk(request)


@router.get("/models", response_model=ModelListResponse)
def models() -> ModelListResponse:
    return list_models()


@router.get("/models/{model_name}/metrics", response_model=ModelMetricsResponse)
def model_metrics(model_name: ModelName) -> ModelMetricsResponse:
    return get_model_metrics(model_name)
