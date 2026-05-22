from fastapi import APIRouter

from app.models import PatientSummary


router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/sample", response_model=PatientSummary)
def get_sample_patient() -> PatientSummary:
    return PatientSummary(
        id="patient-001",
        name="Sample Patient",
        age=52,
        risk_level="moderate",
    )

