import httpx
from fastapi import APIRouter, HTTPException

from app.models import DomainExpertFeedbackRequest, PredictionRequest
from app.services import ml_client, storage


router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.post("")
async def create_prediction(request: PredictionRequest) -> dict:
    request_payload = request.model_dump()
    ml_payload = {
        key: value
        for key, value in request_payload.items()
        if key
        not in {
            "user_id",
            "patient_reference_id",
            "assessment_date",
            "visit_label",
        }
    }

    try:
        prediction = await ml_client.predict(ml_payload)
        request_id, result_id, patient_case_id = await storage.save_prediction(request_payload, prediction.model_dump())
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error

    return {
        "success": True,
        "request_id": request_id,
        "result_id": result_id,
        "patient_case_id": patient_case_id,
        "patient_reference_id": request.patient_reference_id,
        "prediction": prediction.model_dump(),
    }


@router.post("/{result_id}/feedback")
async def create_feedback(result_id: str, request: DomainExpertFeedbackRequest) -> dict:
    feedback = await storage.save_feedback(result_id, request.model_dump())
    return {"success": True, "feedback": feedback}


@router.get("/{result_id}/feedback")
def get_feedback(result_id: str) -> dict:
    return {"success": True, "items": storage.feedback_for_result(result_id)}


@router.delete("/{result_id}")
def delete_prediction(result_id: str, user_id: str | None = None) -> dict:
    storage.delete_prediction_result(result_id, user_id)
    return {"success": True}
