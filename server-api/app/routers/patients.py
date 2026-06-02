from fastapi import APIRouter, Query

from app.models import PatientCaseRequest
from app.services import storage


router = APIRouter(prefix="/api/patient-cases", tags=["patient cases"])


@router.get("")
def list_patient_cases(
    user_id: str | None = Query(None),
    patient_reference_id: str | None = Query(None),
) -> dict:
    return {
        "success": True,
        "items": storage.search_patient_cases(patient_reference_id=patient_reference_id, user_id=user_id),
    }


@router.post("")
async def create_patient_case(request: PatientCaseRequest) -> dict:
    patient_case = await storage.get_or_create_patient_case(request.patient_reference_id, request.user_id)
    return {"success": True, "patient_case": patient_case}


@router.get("/search")
def search_patient_cases(
    patient_reference_id: str = Query(...),
    user_id: str | None = Query(None),
) -> dict:
    return {
        "success": True,
        "items": storage.search_patient_cases(patient_reference_id=patient_reference_id, user_id=user_id),
    }
