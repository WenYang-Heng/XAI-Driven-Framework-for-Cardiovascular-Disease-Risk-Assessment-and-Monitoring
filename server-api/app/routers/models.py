import httpx
from fastapi import APIRouter, HTTPException

from app.models import ModelMetricsListResponse, ModelName
from app.services import ml_client, storage


router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models() -> dict:
    try:
        models = await ml_client.list_models()
        return {"success": True, "models": models}
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error


@router.get("/metrics", response_model=ModelMetricsListResponse)
async def get_all_model_metrics() -> ModelMetricsListResponse:
    try:
        metrics = await ml_client.get_all_model_metrics()
        for metric in metrics.metrics:
            await storage.save_model_metric_snapshot(metric.model_dump(mode="json"))
        return metrics
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error


@router.get("/{model_name}/metrics")
async def get_model_metrics(model_name: ModelName) -> dict:
    try:
        metrics = await ml_client.get_model_metrics(model_name)
        payload = metrics.model_dump(mode="json")
        await storage.save_model_metric_snapshot(payload)
        return payload
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error
