import httpx
from fastapi import APIRouter, HTTPException, Query

from app.models import ActivityLogResponse, AdminMonitoringResponse, AdminSummaryResponse, DefaultModelRequest
from app.services import clinical, ml_client, storage


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/summary", response_model=AdminSummaryResponse)
def get_admin_summary() -> dict:
    return {"success": True, "summary": storage.admin_summary()}


@router.get("/monitoring", response_model=AdminMonitoringResponse)
async def get_admin_monitoring() -> dict:
    model_metrics = None
    try:
        metrics_response = await ml_client.get_all_model_metrics()
        model_metrics = [metric.model_dump(mode="json") for metric in metrics_response.metrics]
        for metric in model_metrics:
            await storage.save_model_metric_snapshot(metric)
    except httpx.HTTPError:
        model_metrics = None

    return {"success": True, "dashboard": storage.admin_monitoring_dashboard(model_metrics)}


@router.get("/activity-logs", response_model=ActivityLogResponse)
def get_activity_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query("", max_length=100),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
) -> dict:
    return {"success": True, **storage.activity_logs(page, page_size, search, sort_order)}


@router.get("/models")
def get_models() -> dict:
    return {"success": True, "items": clinical.list_models(), "default_model": clinical.default_model_name()}


@router.put("/models/default")
async def set_default_model(request: DefaultModelRequest) -> dict:
    admin_id = str(request.admin_id) if request.admin_id else None
    try:
        model = await clinical.set_default_model(request.model_name, admin_id)
    except clinical.NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {"success": True, "model": model}
