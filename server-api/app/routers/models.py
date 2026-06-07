import httpx
from fastapi import APIRouter, HTTPException

from app.models import ModelName
from app.services import ml_client, storage


router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models() -> dict:
    try:
        models = await ml_client.list_models()
        return {"success": True, "models": models}
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error


@router.get("/{model_name}/metrics")
async def get_model_metrics(model_name: ModelName) -> dict:
    try:
        metrics = await ml_client.get_model_metrics(model_name)
        payload = metrics.model_dump()
        await storage.save_model_metric_snapshot(payload)
        return payload
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error
