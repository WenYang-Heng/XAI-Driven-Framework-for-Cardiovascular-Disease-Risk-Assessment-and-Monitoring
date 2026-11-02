from fastapi import APIRouter, HTTPException

from app.schemas import (
    FraminghamModelMetricsListResponse,
    FraminghamModelPredictionRequest,
    FraminghamModelPredictionResponse,
    FraminghamRiskRequest,
    FraminghamRiskResponse,
    FraminghamScoreCardResponse,
)
from app.services.framingham_models import compare_all_models
from app.services.framingham_score import get_score_card, predict_framingham_risk
from app.services.framingham_xai import predict_with_xai


router = APIRouter(prefix="/framingham", tags=["framingham"])


@router.get("/score-card", response_model=FraminghamScoreCardResponse)
def score_card() -> FraminghamScoreCardResponse:
    return get_score_card()


@router.post("/predict", response_model=FraminghamRiskResponse)
def predict(request: FraminghamRiskRequest) -> FraminghamRiskResponse:
    try:
        return predict_framingham_risk(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/models/predict", response_model=FraminghamModelPredictionResponse)
def predict_with_model(request: FraminghamModelPredictionRequest) -> FraminghamModelPredictionResponse:
    try:
        return predict_with_xai(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/models/metrics", response_model=FraminghamModelMetricsListResponse)
def models_metrics() -> FraminghamModelMetricsListResponse:
    return compare_all_models()
