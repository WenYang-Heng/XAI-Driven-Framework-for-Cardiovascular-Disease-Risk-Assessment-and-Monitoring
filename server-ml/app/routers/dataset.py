from fastapi import APIRouter

from app.schemas import DatasetSummary
from app.services.dataset import get_dataset_summary


router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.get("/summary", response_model=DatasetSummary)
def dataset_summary() -> DatasetSummary:
    return get_dataset_summary()
