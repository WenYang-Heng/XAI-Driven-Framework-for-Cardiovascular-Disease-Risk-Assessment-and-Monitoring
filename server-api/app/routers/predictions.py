import httpx
from fastapi import APIRouter, HTTPException

from app.models import PredictionRequest
from app.services import ml_client, storage


router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.post("")
async def create_prediction(request: PredictionRequest) -> dict:
    request_payload = request.model_dump()
    ml_payload = {key: value for key, value in request_payload.items() if key != "user_id"}

    try:
        prediction = await ml_client.predict(ml_payload)
        request_id, result_id = await storage.save_prediction(request_payload, prediction.model_dump())
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error

    return {
        "success": True,
        "request_id": request_id,
        "result_id": result_id,
        "prediction": prediction.model_dump(),
    }
