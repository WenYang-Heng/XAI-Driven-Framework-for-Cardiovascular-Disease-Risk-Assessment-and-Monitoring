from fastapi import APIRouter, HTTPException

from app.schemas import FraminghamRiskRequest, FraminghamRiskResponse, FraminghamScoreCardResponse
from app.services.framingham_score import get_score_card, predict_framingham_risk


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
