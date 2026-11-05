from fastapi import APIRouter, HTTPException, Query

from app.models import PatientAssessmentRequest, PatientSimulationRequest
from app.services import ml_client, patient_risk, storage


router = APIRouter(prefix="/api/patient-assessments", tags=["patient assessments"])


@router.post("")
async def create_patient_assessment(request: PatientAssessmentRequest) -> dict:
    fallback_reason = None
    try:
        prediction = await ml_client.predict_non_domain_patient_risk(request)
    except Exception as error:
        fallback_reason = str(error)
        prediction = patient_risk.predict_patient_risk(request)
    assessment_id, assessment_input_id = await storage.save_patient_assessment(
        request.model_dump(),
        prediction.model_dump(),
    )

    response = {
        "success": True,
        "assessment_id": assessment_id,
        "assessment_input_id": assessment_input_id,
        "prediction": prediction.model_dump(),
    }
    if fallback_reason:
        response["fallback_reason"] = fallback_reason
    return response


@router.get("/history/{user_id}")
def list_patient_assessment_history(user_id: str) -> dict:
    return {
        "success": True,
        "items": storage.patient_assessment_history(user_id),
    }


@router.delete("/{assessment_id}")
async def delete_patient_assessment(assessment_id: str, user_id: str = Query(...)) -> dict:
    deleted = await storage.delete_patient_assessment(assessment_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return {"success": True}


@router.post("/simulate")
def simulate_patient_assessment(request: PatientSimulationRequest) -> dict:
    prediction = patient_risk.simulate_patient_risk(request)
    return {
        "success": True,
        "prediction": prediction.model_dump(),
    }
