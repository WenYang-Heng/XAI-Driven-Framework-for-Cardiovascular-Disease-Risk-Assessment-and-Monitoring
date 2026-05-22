import os
from collections import Counter
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import httpx


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

_requests: list[dict[str, Any]] = []
_results: list[dict[str, Any]] = []
_uploads: list[dict[str, Any]] = []
_batch_rows: list[dict[str, Any]] = []
_activity_logs: list[dict[str, Any]] = []


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


async def _insert(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not _supabase_enabled():
        return {**payload}

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data[0] if data else payload


async def log_activity(user_id: str | None, action: str, entity_type: str | None = None, entity_id: str | None = None) -> None:
    payload = {
        "log_id": str(uuid4()),
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "created_at": _now(),
    }
    _activity_logs.append(payload)
    await _insert("activity_logs", {key: value for key, value in payload.items() if key != "log_id"})


async def save_prediction(
    request_payload: dict[str, Any],
    prediction: dict[str, Any],
    entry_type: str = "single",
) -> tuple[str, str]:
    request_id = str(uuid4())
    result_id = str(uuid4())
    user_id = request_payload.get("user_id")

    request_record = {
        "request_id": request_id,
        "user_id": user_id,
        "model_name": request_payload["model_name"],
        **{key: request_payload[key] for key in _feature_keys()},
        "entry_type": entry_type,
        "source": "server-api",
        "created_at": _now(),
    }
    result_record = {
        "result_id": result_id,
        "request_id": request_id,
        "user_id": user_id,
        "model_name": prediction["model_name"],
        "model_version": prediction["model_version"],
        "risk_score": prediction["risk_score"],
        "predicted_class": prediction["predicted_class"],
        "risk_level": prediction["risk_level"],
        "explanation": prediction.get("explanation", []),
        "created_at": _now(),
    }

    _requests.append(request_record)
    _results.append(result_record)
    inserted_request = await _insert("prediction_requests", {key: value for key, value in request_record.items() if key != "request_id"})
    request_id = inserted_request.get("request_id", request_id)
    result_record["request_id"] = request_id
    inserted_result = await _insert("prediction_results", {key: value for key, value in result_record.items() if key != "result_id"})
    result_id = inserted_result.get("result_id", result_id)
    await log_activity(user_id, "prediction_created", "prediction_results", result_id)
    return request_id, result_id


async def create_upload(user_id: str | None, file_name: str, file_type: str, model_name: str) -> str:
    upload_id = str(uuid4())
    record = {
        "upload_id": upload_id,
        "user_id": user_id,
        "file_name": file_name,
        "file_type": file_type,
        "model_name": model_name,
        "total_rows": 0,
        "successful_rows": 0,
        "failed_rows": 0,
        "upload_status": "processing",
        "created_at": _now(),
        "updated_at": _now(),
    }
    _uploads.append(record)
    inserted = await _insert("uploaded_files", {key: value for key, value in record.items() if key != "upload_id"})
    return inserted.get("upload_id", upload_id)


async def update_upload(upload_id: str, total_rows: int, successful_rows: int, failed_rows: int, status: str) -> None:
    for upload in _uploads:
        if upload["upload_id"] == upload_id:
            upload.update(
                total_rows=total_rows,
                successful_rows=successful_rows,
                failed_rows=failed_rows,
                upload_status=status,
                updated_at=_now(),
            )
            break


async def save_batch_row(
    upload_id: str,
    row_number: int,
    status: str,
    error_message: str | None = None,
    request_id: str | None = None,
    result_id: str | None = None,
) -> None:
    record = {
        "batch_row_id": str(uuid4()),
        "upload_id": upload_id,
        "request_id": request_id,
        "result_id": result_id,
        "row_number": row_number,
        "status": status,
        "error_message": error_message,
        "created_at": _now(),
    }
    _batch_rows.append(record)
    await _insert("batch_prediction_rows", {key: value for key, value in record.items() if key != "batch_row_id"})


def prediction_history(user_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for result in _results:
        if result.get("user_id") != user_id:
            continue
        items.append(
            {
                "request_id": result["request_id"],
                "result_id": result["result_id"],
                "model_name": result["model_name"],
                "risk_score": result["risk_score"],
                "predicted_class": result["predicted_class"],
                "risk_level": result["risk_level"],
                "created_at": result["created_at"],
            }
        )
    return sorted(items, key=lambda item: item["created_at"], reverse=True)


def upload_history(user_id: str) -> list[dict[str, Any]]:
    return sorted(
        [upload for upload in _uploads if upload.get("user_id") == user_id],
        key=lambda item: item["created_at"],
        reverse=True,
    )


def upload_detail(upload_id: str) -> list[dict[str, Any]]:
    return [row for row in _batch_rows if row.get("upload_id") == upload_id]


def admin_summary() -> dict[str, Any]:
    usage = Counter(result["model_name"] for result in _results)
    users = {result.get("user_id") for result in _results if result.get("user_id")}
    users.update(upload.get("user_id") for upload in _uploads if upload.get("user_id"))
    return {
        "total_users": len(users),
        "total_predictions": len(_results),
        "total_uploads": len(_uploads),
        "successful_batch_rows": sum(1 for row in _batch_rows if row["status"] == "success"),
        "failed_batch_rows": sum(1 for row in _batch_rows if row["status"] == "failed"),
        "model_usage": [{"model_name": model_name, "count": count} for model_name, count in usage.items()],
    }


def _feature_keys() -> list[str]:
    return [
        "age",
        "sex",
        "cp",
        "trestbps",
        "chol",
        "fbs",
        "restecg",
        "thalach",
        "exang",
        "oldpeak",
        "slope",
        "ca",
        "thal",
    ]
