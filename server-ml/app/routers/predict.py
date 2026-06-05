from fastapi import APIRouter

from app.schemas import (
    ModelListResponse,
    ModelMetricsResponse,
    ModelName,
    NonDomainPredictionRequest,
    NonDomainPredictionResponse,
    RiskPredictionRequest,
    RiskPredictionResponse,
)
from app.services.non_domain_model import comparison_table, predict_non_domain_risk
from app.services.risk_model import get_model_metrics, list_models, predict_risk


router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=RiskPredictionResponse)
def predict(request: RiskPredictionRequest) -> RiskPredictionResponse:
    return predict_risk(request)


@router.post("/predict/non-domain", response_model=NonDomainPredictionResponse)
def predict_non_domain(request: NonDomainPredictionRequest) -> NonDomainPredictionResponse:
    return predict_non_domain_risk(request)


@router.get("/models", response_model=ModelListResponse)
def models() -> ModelListResponse:
    return list_models()


@router.get("/models/non-domain/comparison")
def non_domain_model_comparison() -> dict[str, str]:
    return {"table": comparison_table()}


@router.get("/models/{model_name}/metrics", response_model=ModelMetricsResponse)
def model_metrics(model_name: ModelName) -> ModelMetricsResponse:
    return get_model_metrics(model_name)
