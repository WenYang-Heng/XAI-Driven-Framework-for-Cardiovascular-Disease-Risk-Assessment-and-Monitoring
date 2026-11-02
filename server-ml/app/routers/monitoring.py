from fastapi import APIRouter

from app.schemas import DriftRequest, DriftResponse, FairnessResponse, ModelName
from app.services.monitoring import compute_drift, compute_fairness


router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/fairness/{model_name}", response_model=FairnessResponse)
def fairness(model_name: ModelName) -> FairnessResponse:
    return compute_fairness(model_name)


@router.post("/drift", response_model=DriftResponse)
def drift(request: DriftRequest) -> DriftResponse:
    return compute_drift(request)
