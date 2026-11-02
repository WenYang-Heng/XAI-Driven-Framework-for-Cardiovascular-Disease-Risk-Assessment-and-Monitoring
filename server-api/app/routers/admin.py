from datetime import UTC, datetime
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.models import ActivityLogResponse, ModelName
from app.services import ml_client, storage
from app.services.auth import require_admin


router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

RangeDays = Query(30, ge=1, le=365, description="Number of days back from today to include")
ReportSection = Literal["activity", "performance", "fairness", "drift", "activity_log"]

# Acceptance criteria for the deployed model (NFR-02 in the FYP report).
PERFORMANCE_TARGETS = {"auc_roc": 0.85, "sensitivity_recall": 0.80, "specificity": 0.75}


class ReportRequest(BaseModel):
    sections: list[ReportSection] = Field(..., min_length=1)
    days: int = Field(30, ge=1, le=365)
    model_name: ModelName = "xgboost"


@router.get("/overview")
def get_overview(days: int = RangeDays) -> dict:
    return {"success": True, **storage.admin_overview(days)}


@router.get("/performance")
async def get_performance(days: int = RangeDays) -> dict:
    return {"success": True, **await _performance_section(days)}


@router.get("/fairness")
async def get_fairness(model_name: ModelName = "xgboost", days: int = RangeDays) -> dict:
    return {"success": True, **await _fairness_section(model_name, days)}


@router.get("/drift")
async def get_drift(days: int = RangeDays) -> dict:
    return {"success": True, **await _drift_section(days)}


@router.get("/activity-logs", response_model=ActivityLogResponse)
def get_activity_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query("", max_length=100),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    category: str | None = Query(None, max_length=32),
    status: Literal["success", "warning", "failed"] | None = None,
    days: int | None = Query(None, ge=1, le=365),
) -> dict:
    return {"success": True, **storage.activity_logs(page, page_size, search, sort_order, category, status, days)}


@router.post("/reports")
async def generate_report(request: ReportRequest, admin_id: str | None = Depends(require_admin)) -> dict:
    sections: dict[str, dict] = {}
    unavailable: list[dict[str, str]] = []

    for name in dict.fromkeys(request.sections):
        try:
            section = await _report_section(name, request)
        except Exception as error:  # one failing source should not sink the whole report
            unavailable.append({"section": name, "reason": _reason(error)})
            continue
        reason = _section_gap(name, section)
        if reason:
            unavailable.append({"section": name, "reason": reason})
        sections[name] = section

    if not sections:
        await storage.log_activity(admin_id, "REPORT_GENERATION_FAILED", metadata={"unavailable": unavailable})
        raise HTTPException(status_code=503, detail="Report generation failed: none of the selected sections could be compiled.")

    await storage.log_activity(
        admin_id,
        "GENERATE_MONITORING_REPORT",
        metadata={"sections": list(sections), "days": request.days, "model_name": request.model_name, "unavailable": unavailable},
    )
    return {
        "success": True,
        "generated_at": datetime.now(UTC).isoformat(),
        "days": request.days,
        "model_name": request.model_name,
        "partial": bool(unavailable),
        "unavailable": unavailable,
        "sections": sections,
    }


async def _report_section(name: str, request: ReportRequest) -> dict:
    if name == "activity":
        return storage.admin_overview(request.days)
    if name == "performance":
        return await _performance_section(request.days)
    if name == "fairness":
        return await _fairness_section(request.model_name, request.days)
    if name == "drift":
        return await _drift_section(request.days)
    return storage.activity_logs(1, 100, days=request.days)


def _reason(error: Exception) -> str:
    if isinstance(error, httpx.HTTPError):
        return "server-ml is unreachable"
    if isinstance(error, HTTPException):
        return str(error.detail)
    return error.__class__.__name__


def _section_gap(name: str, section: dict) -> str | None:
    if name == "performance" and section["source"] == "snapshot":
        return "Live metrics unavailable; using the latest stored snapshot"
    if name == "fairness" and not section["fairness_available"]:
        return section["message"]
    if name == "drift" and not section["drift_available"]:
        return section["message"]
    return None


async def _performance_section(days: int) -> dict:
    source = "live"
    try:
        metrics = [metric.model_dump(mode="json") for metric in (await ml_client.get_all_model_metrics()).metrics]
        for metric in metrics:
            await storage.save_model_metric_snapshot(metric)
    except httpx.HTTPError:
        source = "snapshot"
        metrics = [_snapshot_as_metric(row) for row in storage.latest_model_metric_snapshots()]
        if not metrics:
            raise HTTPException(status_code=503, detail="Model performance data is unavailable. Check that server-ml is running and retry.")

    return {
        "source": source,
        "dataset": "UCI Heart Disease, stratified 20% held-out test split",
        "targets": PERFORMANCE_TARGETS,
        "models": [
            {
                **metric,
                "meets_targets": all(float(metric[key]) >= target for key, target in PERFORMANCE_TARGETS.items()),
            }
            for metric in metrics
        ],
        "history": storage.model_metric_history(days),
    }


def _snapshot_as_metric(row: dict) -> dict:
    return {
        **{key: row.get(key) for key in ("model_name", "accuracy", "precision", "sensitivity_recall", "specificity", "f1_score", "auc_roc")},
        "confusion_matrix": {
            key: row.get(key) for key in ("true_negative", "false_positive", "false_negative", "true_positive")
        },
        "snapshot_at": row.get("created_at"),
    }


async def _fairness_section(model_name: str, days: int) -> dict:
    live_parity = storage.live_prediction_parity(storage.assessment_inputs(days))
    try:
        evaluation = await ml_client.get_fairness(model_name)
    except httpx.HTTPError:
        return {
            "fairness_available": False,
            "message": "Labelled fairness evaluation is unavailable because server-ml could not be reached.",
            "evaluation": None,
            "live_parity": live_parity,
        }
    return {"fairness_available": True, "message": None, "evaluation": evaluation, "live_parity": live_parity}


async def _drift_section(days: int) -> dict:
    records = storage.assessment_inputs(days)
    volume = storage.admin_overview(days)["daily"]
    feature_keys = storage._feature_keys()
    clean_records = [
        {"day": row.get("day"), **{key: float(row[key]) for key in feature_keys}}
        for row in records
        if all(row.get(key) is not None for key in feature_keys)
    ]
    try:
        drift = await ml_client.compute_drift(clean_records)
    except httpx.HTTPError:
        return {
            "drift_available": False,
            "message": "Drift cannot be calculated because the training baseline (server-ml) is unreachable. Showing input volume only.",
            "drift": None,
            "volume": volume,
        }
    return {"drift_available": True, "message": None, "drift": drift, "volume": volume}
