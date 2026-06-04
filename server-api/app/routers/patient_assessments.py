from fastapi import APIRouter

from app.models import PatientAssessmentRequest, PatientSimulationRequest
from app.services import patient_risk, storage


router = APIRouter(prefix="/api/patient-assessments", tags=["patient assessments"])


@router.post("")
async def create_patient_assessment(request: PatientAssessmentRequest) -> dict:
    prediction = patient_risk.predict_patient_risk(request)
    assessment_id, assessment_input_id = await storage.save_patient_assessment(
        request.model_dump(),
        prediction.model_dump(),
    )

    return {
        "success": True,
        "assessment_id": assessment_id,
        "assessment_input_id": assessment_input_id,
        "prediction": prediction.model_dump(),
    }


@router.post("/simulate")
def simulate_patient_assessment(request: PatientSimulationRequest) -> dict:
    prediction = patient_risk.simulate_patient_risk(request)
    return {
        "success": True,
        "prediction": prediction.model_dump(),
    }
