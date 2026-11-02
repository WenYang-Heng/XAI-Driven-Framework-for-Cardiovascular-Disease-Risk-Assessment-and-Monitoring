import os
import re
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import httpx
from psycopg2.extras import Json, RealDictCursor

from app.services.database import database_enabled, get_connection


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")

_requests: list[dict[str, Any]] = []
_results: list[dict[str, Any]] = []
_uploads: list[dict[str, Any]] = []
_batch_rows: list[dict[str, Any]] = []
_activity_logs: list[dict[str, Any]] = []
_patient_cases: list[dict[str, Any]] = []
_feedback: list[dict[str, Any]] = []
_xai_explanations: list[dict[str, Any]] = []
_model_metric_snapshots: list[dict[str, Any]] = []
_upload_files: dict[str, dict[str, Any]] = {}
_profiles: list[dict[str, Any]] = []


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


async def _insert(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    if database_enabled():
        return _insert_database(table, payload)

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


def _insert_database(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    clean_payload = _database_payload(payload)
    columns = ", ".join(clean_payload.keys())
    values = ", ".join(f"%({key})s" for key in clean_payload)
    query = f"insert into public.{table} ({columns}) values ({values}) returning *"

    with get_connection() as connection:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, clean_payload)
            row = cursor.fetchone()

    return _serialize_row(dict(row)) if row else payload


def _update_database(table: str, key_name: str, key_value: str, payload: dict[str, Any]) -> None:
    if not database_enabled():
        return

    clean_payload = _database_payload(payload)
    assignments = ", ".join(f"{key} = %({key})s" for key in clean_payload)
    query = f"update public.{table} set {assignments} where {key_name} = %(_key_value)s"

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, _database_params({**clean_payload, "_key_value": key_value}))


def _delete_database(table: str, key_name: str, key_value: str) -> None:
    if not database_enabled():
        return

    query = f"delete from public.{table} where {key_name} = %(_key_value)s"
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, _database_params({"_key_value": key_value}))


def _database_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        key: _database_value(value)
        for key, value in payload.items()
    }


def _database_value(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (dict, list)):
        return Json(value)
    return value


def _database_params(params: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        key: _database_value(value)
        for key, value in (params or {}).items()
    }


def _query_database(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with get_connection() as connection:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, _database_params(params))
            rows = cursor.fetchall()
    return [_serialize_row(dict(row)) for row in rows]


def _serialize_row(row: dict[str, Any]) -> dict[str, Any]:
    serialized: dict[str, Any] = {}
    for key, value in row.items():
        if isinstance(value, UUID):
            serialized[key] = str(value)
        elif isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, Decimal):
            serialized[key] = float(value)
        else:
            serialized[key] = value
    return serialized


async def log_activity(
    user_id: str | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    payload = {
        "log_id": str(uuid4()),
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "metadata": metadata,
        "created_at": _now(),
    }
    _activity_logs.append(payload)
    await _insert("activity_logs", {key: value for key, value in payload.items() if key != "log_id"})


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


def _feature_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: payload[key] for key in _feature_keys()}


def _assessment_date(value: str | None) -> str:
    return value or date.today().isoformat()


def _normalise_patient_reference(value: str | None, fallback: str | None = None) -> str:
    cleaned = (value or fallback or "").strip()
    return cleaned or _next_patient_reference()


def _next_patient_reference() -> str:
    year = datetime.now(UTC).year
    prefix = f"CASE-{year}-"
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
    highest = 0

    if database_enabled():
        rows = _query_database(
            """
            select patient_reference_id
            from public.patient_cases
            where patient_reference_id like %(prefix)s
            """,
            {"prefix": f"{prefix}%"},
        )
        references = [row["patient_reference_id"] for row in rows]
    else:
        references = [case["patient_reference_id"] for case in _patient_cases]

    for reference in references:
        match = pattern.match(reference)
        if match:
            highest = max(highest, int(match.group(1)))

    return f"{prefix}{highest + 1:04d}"


def _model_id(model_name: str) -> str | None:
    if database_enabled():
        rows = _query_database(
            "select model_id from public.ml_models where model_name = %(model_name)s limit 1",
            {"model_name": model_name},
        )
        return rows[0]["model_id"] if rows else None

    return None


def _model_version(model_name: str) -> str | None:
    if database_enabled():
        rows = _query_database(
            "select model_version from public.ml_models where model_name = %(model_name)s limit 1",
            {"model_name": model_name},
        )
        return rows[0]["model_version"] if rows else None

    return None


async def save_model_metric_snapshot(metrics: dict[str, Any]) -> dict[str, Any]:
    model_name = metrics["model_name"]
    confusion = metrics["confusion_matrix"]
    payload = {
        "metric_id": str(uuid4()),
        "model_id": _model_id(model_name),
        "model_name": model_name,
        "model_version": _model_version(model_name),
        "dataset_name": "UCI Heart Disease",
        "accuracy": metrics["accuracy"],
        "precision": metrics["precision"],
        "sensitivity_recall": metrics["sensitivity_recall"],
        "specificity": metrics["specificity"],
        "f1_score": metrics["f1_score"],
        "auc_roc": metrics["auc_roc"],
        "true_negative": confusion["true_negative"],
        "false_positive": confusion["false_positive"],
        "false_negative": confusion["false_negative"],
        "true_positive": confusion["true_positive"],
        "calibration_metrics": metrics.get("calibration_metrics"),
        "decision_curve_data": metrics.get("decision_curve_data"),
        "roc_curve_data": metrics.get("roc_curve_data"),
        "created_at": _now(),
    }

    previous = next((row for row in latest_model_metric_snapshots() if row["model_name"] == model_name), None)
    if previous and not _metrics_changed(previous, payload):
        return previous

    _model_metric_snapshots.append(payload)
    return await _insert("model_metric_snapshots", payload)


SNAPSHOT_COMPARE_KEYS = ("model_version", "accuracy", "precision", "sensitivity_recall", "specificity", "f1_score", "auc_roc")


def _metrics_changed(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    """One snapshot per model per day unless the metrics actually move."""
    if _local_day(previous.get("created_at")) != _local_day(current["created_at"]):
        return True
    return any(
        str(previous.get(key)) != str(current.get(key)) if key == "model_version"
        else abs(float(previous.get(key) or 0) - float(current.get(key) or 0)) > 1e-6
        for key in SNAPSHOT_COMPARE_KEYS
    )


async def get_global_shap_explanation(model_name: str) -> dict[str, Any] | None:
    if database_enabled():
        rows = _query_database(
            """
            select
              mge.global_explanation_id,
              mge.model_id,
              mge.dataset_name,
              mge.samples_explained,
              mge.explainer_type,
              mge.explanation_scope,
              mge.feature_importance,
              mge.beeswarm_data,
              mge.dependence_data,
              mge.summary_text,
              mge.generation_status,
              mge.generated_at,
              mge.updated_at,
              json_build_object(
                'model_name', mm.model_name,
                'display_name', mm.display_name,
                'model_version', mm.model_version
              ) as ml_models
            from public.model_global_explanations mge
            join public.ml_models mm on mm.model_id = mge.model_id
            where mm.model_name = %(model_name)s
              and mge.explanation_scope = 'global'
              and mge.generation_status = 'completed'
            order by mge.generated_at desc nulls last
            limit 1
            """,
            {"model_name": model_name},
        )
        return _normalise_global_shap_row(rows[0]) if rows else None

    if not _supabase_enabled():
        return None

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    params = {
        "select": (
            "global_explanation_id,model_id,dataset_name,samples_explained,"
            "explainer_type,explanation_scope,feature_importance,beeswarm_data,"
            "dependence_data,summary_text,generation_status,generated_at,updated_at,"
            "ml_models!inner(model_name,display_name,model_version)"
        ),
        "ml_models.model_name": f"eq.{model_name}",
        "explanation_scope": "eq.global",
        "generation_status": "eq.completed",
        "order": "generated_at.desc.nullslast",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/model_global_explanations",
            headers=headers,
            params=params,
        )
        response.raise_for_status()
        rows = response.json()

    return _normalise_global_shap_row(rows[0]) if rows else None


def _normalise_global_shap_row(row: dict[str, Any]) -> dict[str, Any]:
    feature_importance = row.get("feature_importance") or []
    if isinstance(feature_importance, list):
        cleaned_features = []
        for item in feature_importance:
            if not isinstance(item, dict):
                continue
            feature = str(item.get("feature") or "")
            mean_abs_shap = item.get("mean_abs_shap")
            if not feature:
                continue
            try:
                cleaned_features.append(
                    {
                        "rank": int(item.get("rank") or len(cleaned_features) + 1),
                        "feature": feature,
                        "display_name": item.get("display_name") or feature,
                        "mean_abs_shap": float(mean_abs_shap),
                    }
                )
            except (TypeError, ValueError):
                continue
        row["feature_importance"] = sorted(cleaned_features, key=lambda item: item["rank"])
    else:
        row["feature_importance"] = []

    return row


async def upsert_user_profile(payload: dict[str, Any]) -> dict[str, Any]:
    user_id = payload["user_id"]
    profile = {
        "user_id": user_id,
        "full_name": payload.get("full_name"),
        "email": payload.get("email"),
        "role": payload.get("role", "DOMAIN_EXPERT"),
        "updated_at": _now(),
    }

    if database_enabled():
        query = """
            insert into public.user_profiles (user_id, full_name, email, role, updated_at)
            values (%(user_id)s, %(full_name)s, %(email)s, %(role)s, %(updated_at)s)
            on conflict (user_id) do update
            set full_name = excluded.full_name,
                email = excluded.email,
                role = excluded.role,
                updated_at = excluded.updated_at
            returning *
        """
        rows = _query_database(query, profile)
        return rows[0] if rows else profile

    for existing in _profiles:
        if existing["user_id"] == user_id:
            existing.update(profile)
            return existing
    profile["created_at"] = _now()
    _profiles.append(profile)
    return profile


def get_user_profile(user_id: str) -> dict[str, Any] | None:
    if database_enabled():
        rows = _query_database(
            "select * from public.user_profiles where user_id = %(user_id)s limit 1",
            {"user_id": user_id},
        )
        return rows[0] if rows else None

    for profile in _profiles:
        if profile["user_id"] == user_id:
            return profile
    return None


async def get_or_create_patient_case(
    patient_reference_id: str | None,
    user_id: str | None,
) -> dict[str, Any]:
    reference = _normalise_patient_reference(patient_reference_id)

    if database_enabled():
        rows = _query_database(
            "select * from public.patient_cases where patient_reference_id = %(reference)s limit 1",
            {"reference": reference},
        )
        if rows:
            return rows[0]

        inserted = await _insert(
            "patient_cases",
            {
                "patient_reference_id": reference,
                "created_by": user_id,
                "case_status": "active",
                "created_at": _now(),
                "updated_at": _now(),
            },
        )
        await log_activity(user_id, "CREATE_PATIENT_CASE", "patient_cases", inserted.get("patient_case_id"))
        return inserted

    for patient_case in _patient_cases:
        if patient_case["patient_reference_id"] == reference:
            return patient_case

    record = {
        "patient_case_id": str(uuid4()),
        "patient_reference_id": reference,
        "created_by": user_id,
        "case_status": "active",
        "created_at": _now(),
        "updated_at": _now(),
    }
    _patient_cases.append(record)
    return record


def search_patient_cases(patient_reference_id: str | None = None, user_id: str | None = None) -> list[dict[str, Any]]:
    if database_enabled():
        filters = []
        params: dict[str, Any] = {}
        if patient_reference_id:
            filters.append("patient_reference_id ilike %(reference)s")
            params["reference"] = f"%{patient_reference_id.strip()}%"
        if user_id:
            filters.append("(created_by = %(user_id)s or created_by is null)")
            params["user_id"] = user_id
        where_clause = f"where {' and '.join(filters)}" if filters else ""
        return _query_database(
            f"""
            select *
            from public.patient_cases
            {where_clause}
            order by updated_at desc
            limit 50
            """,
            params,
        )

    cases = _patient_cases
    if patient_reference_id:
        needle = patient_reference_id.lower()
        cases = [case for case in cases if needle in case["patient_reference_id"].lower()]
    if user_id:
        cases = [case for case in cases if case.get("created_by") in (user_id, None)]
    return cases


async def save_prediction(
    request_payload: dict[str, Any],
    prediction: dict[str, Any],
    entry_type: str = "single",
) -> tuple[str, str, str | None, str | None]:
    request_id = str(uuid4())
    result_id = str(uuid4())
    user_id = request_payload.get("user_id")
    await ensure_user_profile(user_id)
    patient_case = await get_or_create_patient_case(request_payload.get("patient_reference_id"), user_id)
    patient_case_id = patient_case.get("patient_case_id")
    patient_reference_id = patient_case.get("patient_reference_id")
    model_id = _model_id(request_payload["model_name"])
    input_features = _feature_payload(request_payload)

    request_record = {
        "request_id": request_id,
        "user_id": user_id,
        "patient_case_id": patient_case_id,
        "model_id": model_id,
        "model_name": request_payload["model_name"],
        **input_features,
        "input_features": input_features,
        "entry_type": entry_type,
        "source": "server-api",
        "assessment_date": _assessment_date(request_payload.get("assessment_date")),
        "visit_label": request_payload.get("visit_label"),
        "created_at": _now(),
    }
    result_record = {
        "result_id": result_id,
        "request_id": request_id,
        "user_id": user_id,
        "model_id": model_id,
        "model_name": prediction["model_name"],
        "model_version": prediction["model_version"],
        "risk_score": prediction["risk_score"],
        "predicted_class": prediction["predicted_class"],
        "risk_level": prediction["risk_level"],
        "explanation": prediction.get("explanation", []),
        "xai": prediction.get("xai"),
        "created_at": _now(),
    }

    _requests.append(request_record)
    _results.append(result_record)
    inserted_request = await _insert("prediction_requests", {key: value for key, value in request_record.items() if key != "request_id"})
    request_id = inserted_request.get("request_id", request_id)
    result_record["request_id"] = request_id
    inserted_result = await _insert("prediction_results", {key: value for key, value in result_record.items() if key != "result_id"})
    result_id = inserted_result.get("result_id", result_id)
    await save_xai_explanations(result_id, prediction.get("xai"), request_payload)
    await log_activity(user_id, "CREATE_PREDICTION_REQUEST", "prediction_requests", request_id)
    await log_activity(user_id, "GENERATE_PREDICTION_RESULT", "prediction_results", result_id)
    return request_id, result_id, patient_case_id, patient_reference_id


async def save_xai_explanations(result_id: str, xai: dict[str, Any] | None, request_payload: dict[str, Any]) -> None:
    if not xai:
        return

    summary = xai.get("summary") or []
    explanation_text = "\n".join(summary) if isinstance(summary, list) else str(summary)
    shap = xai.get("shap") or {}
    lime = xai.get("lime") or {}
    shap_contributions = _normalise_contributions(shap.get("contributions") or [], request_payload)
    lime_contributions = _normalise_contributions(lime.get("contributions") or [], request_payload)

    records = [
        {
            "result_id": result_id,
            "xai_method": "SHAP",
            "all_feature_contributions": shap_contributions,
            "top_features": _top_features(shap_contributions),
            "shap_values": {
                "base_value": shap.get("base_value"),
                "final_value": shap.get("final_value"),
                "contributions": shap_contributions,
            },
            "explanation_text": explanation_text,
            "feature_value_context": _feature_payload(request_payload),
            "normalization_info": {"source": "server-ml"},
            "created_at": _now(),
        },
        {
            "result_id": result_id,
            "xai_method": "LIME",
            "all_feature_contributions": lime_contributions,
            "top_features": _top_features(lime_contributions),
            "shap_values": None,
            "explanation_text": explanation_text,
            "feature_value_context": _feature_payload(request_payload),
            "normalization_info": {"source": "server-ml"},
            "created_at": _now(),
        },
    ]

    for record in records:
        _xai_explanations.append({**record, "xai_id": str(uuid4())})
        await _insert("xai_explanations", record)


def _normalise_contributions(contributions: list[dict[str, Any]], request_payload: dict[str, Any]) -> list[dict[str, Any]]:
    by_feature = {
        item.get("feature"): item.get("value", item.get("contribution", 0))
        for item in contributions
    }
    rows = []
    sorted_features = sorted(_feature_keys(), key=lambda feature: abs(float(by_feature.get(feature, 0) or 0)), reverse=True)
    ranks = {feature: index + 1 for index, feature in enumerate(sorted_features)}
    for feature in _feature_keys():
        contribution = float(by_feature.get(feature, 0) or 0)
        direction = "neutral"
        if contribution > 0:
            direction = "increases_risk"
        elif contribution < 0:
            direction = "decreases_risk"
        rows.append(
            {
                "feature": feature,
                "input_value": request_payload.get(feature),
                "contribution": contribution,
                "direction": direction,
                "rank": ranks[feature],
            }
        )
    return rows


def _top_features(contributions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(contributions, key=lambda item: abs(item["contribution"]), reverse=True)[:5]


async def ensure_user_profile(user_id: str | None) -> None:
    if not user_id:
        return

    if get_user_profile(user_id):
        return

    if database_enabled():
        _ensure_user_profile_database(user_id)
        return

    if not _supabase_enabled():
        return

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = {
        "user_id": user_id,
        "full_name": "Domain Expert User",
        "email": f"{user_id}@local.cardioxai",
        "role": "DOMAIN_EXPERT",
        "updated_at": _now(),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{SUPABASE_URL}/rest/v1/user_profiles", headers=headers, json=payload)
        response.raise_for_status()


def _ensure_user_profile_database(user_id: str) -> None:
    query = """
        insert into public.user_profiles (user_id, full_name, email, role, updated_at)
        values (%(user_id)s, %(full_name)s, %(email)s, %(role)s, %(updated_at)s)
        on conflict (user_id) do update
        set updated_at = excluded.updated_at
    """
    payload = {
        "user_id": user_id,
        "full_name": "Domain Expert User",
        "email": f"{user_id}@local.cardioxai",
        "role": "DOMAIN_EXPERT",
        "updated_at": _now(),
    }
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, payload)


async def save_feedback(result_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    expert_id = payload["expert_id"]
    await ensure_user_profile(expert_id)
    record = {
        "feedback_id": str(uuid4()),
        "result_id": result_id,
        "expert_id": expert_id,
        "clinician_risk_level": payload.get("clinician_risk_level"),
        "agreement_level": payload.get("agreement_level"),
        "is_clinically_acceptable": payload.get("is_clinically_acceptable"),
        "confidence_level": payload.get("confidence_level"),
        "feedback_comment": payload.get("feedback_comment"),
        "use_for_future_retraining": payload.get("use_for_future_retraining", False),
        "created_at": _now(),
    }
    _feedback.append(record)
    inserted = await _insert("domain_expert_feedback", {key: value for key, value in record.items() if key != "feedback_id"})
    await log_activity(expert_id, "SUBMIT_DOMAIN_EXPERT_FEEDBACK", "prediction_results", result_id)
    return {**record, **inserted}


def feedback_for_result(result_id: str) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select *
            from public.domain_expert_feedback
            where result_id = %(result_id)s
            order by created_at desc
            """,
            {"result_id": result_id},
        )

    return [item for item in _feedback if item["result_id"] == result_id]


def delete_prediction_result(result_id: str, user_id: str | None = None) -> None:
    if database_enabled():
        if user_id:
            rows = _query_database(
                "select result_id from public.prediction_results where result_id = %(result_id)s and user_id = %(user_id)s",
                {"result_id": result_id, "user_id": user_id},
            )
            if not rows:
                return
        _delete_database("prediction_results", "result_id", result_id)
        return

    _results[:] = [item for item in _results if item["result_id"] != result_id]
    _feedback[:] = [item for item in _feedback if item["result_id"] != result_id]
    _xai_explanations[:] = [item for item in _xai_explanations if item["result_id"] != result_id]


async def create_upload(
    user_id: str | None,
    file_name: str,
    file_type: str,
    model_name: str,
    patient_reference_mode: str = "csv_column",
    content: bytes | None = None,
) -> str:
    await ensure_user_profile(user_id)
    upload_id = str(uuid4())
    model_id = _model_id(model_name)
    record = {
        "upload_id": upload_id,
        "user_id": user_id,
        "model_id": model_id,
        "file_name": file_name,
        "file_type": file_type,
        "model_name": model_name,
        "patient_reference_mode": patient_reference_mode,
        "total_rows": 0,
        "successful_rows": 0,
        "failed_rows": 0,
        "upload_status": "pending",
        "created_at": _now(),
        "updated_at": _now(),
    }
    _uploads.append(record)
    if content is not None:
        _upload_files[upload_id] = {
            "content": content,
            "file_name": file_name,
            "file_type": file_type,
            "model_name": model_name,
            "patient_reference_mode": patient_reference_mode,
        }
    inserted = await _insert("uploaded_files", {key: value for key, value in record.items() if key != "upload_id"})
    persisted_upload_id = inserted.get("upload_id", upload_id)
    if persisted_upload_id != upload_id:
        record["upload_id"] = persisted_upload_id
        if content is not None:
            _upload_files[persisted_upload_id] = _upload_files.pop(upload_id)
    return persisted_upload_id


def get_upload_file(upload_id: str) -> dict[str, Any] | None:
    return _upload_files.get(upload_id)


def set_upload_file(upload_id: str, payload: dict[str, Any]) -> None:
    _upload_files[upload_id] = payload


async def update_upload(upload_id: str, total_rows: int, successful_rows: int, failed_rows: int, status: str) -> None:
    update_payload = {
        "total_rows": total_rows,
        "successful_rows": successful_rows,
        "failed_rows": failed_rows,
        "upload_status": status,
        "updated_at": _now(),
    }
    for upload in _uploads:
        if upload["upload_id"] == upload_id:
            upload.update(**update_payload)
            break
    _update_database("uploaded_files", "upload_id", upload_id, update_payload)


async def save_batch_row(
    upload_id: str,
    row_number: int,
    status: str,
    error_message: str | None = None,
    request_id: str | None = None,
    result_id: str | None = None,
    patient_case_id: str | None = None,
    patient_reference_id: str | None = None,
) -> None:
    record = {
        "batch_row_id": str(uuid4()),
        "upload_id": upload_id,
        "request_id": request_id,
        "result_id": result_id,
        "patient_case_id": patient_case_id,
        "patient_reference_id": patient_reference_id,
        "row_number": row_number,
        "status": status,
        "error_message": error_message,
        "created_at": _now(),
    }
    _batch_rows.append(record)
    await _insert("batch_prediction_rows", {key: value for key, value in record.items() if key != "batch_row_id"})


def prediction_history(user_id: str) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select
              pr.request_id,
              pr.result_id,
              req.patient_case_id,
              pc.patient_reference_id,
              coalesce(req.assessment_date, pr.created_at::date) as assessment_date,
              req.entry_type,
              pr.model_name,
              pr.model_version,
              pr.risk_score,
              pr.predicted_class,
              pr.risk_level,
              pr.explanation,
              pr.xai,
              req.input_features,
              pr.created_at,
              case when def.feedback_id is null then 'pending' else 'reviewed' end as feedback_status
            from public.prediction_results pr
            left join public.prediction_requests req on req.request_id = pr.request_id
            left join public.patient_cases pc on pc.patient_case_id = req.patient_case_id
            left join lateral (
              select feedback_id
              from public.domain_expert_feedback
              where result_id = pr.result_id
              limit 1
            ) def on true
            where pr.user_id = %(user_id)s
            order by pr.created_at desc
            """,
            {"user_id": user_id},
        )

    items: list[dict[str, Any]] = []
    for result in _results:
        if result.get("user_id") != user_id:
            continue
        items.append(
            {
                "request_id": result["request_id"],
                "result_id": result["result_id"],
                "patient_case_id": next((request.get("patient_case_id") for request in _requests if request["request_id"] == result["request_id"]), None),
                "patient_reference_id": next(
                    (
                        case["patient_reference_id"]
                        for request in _requests
                        for case in _patient_cases
                        if request["request_id"] == result["request_id"]
                        and request.get("patient_case_id") == case["patient_case_id"]
                    ),
                    None,
                ),
                "assessment_date": next((request.get("assessment_date") for request in _requests if request["request_id"] == result["request_id"]), result["created_at"]),
                "entry_type": next((request.get("entry_type") for request in _requests if request["request_id"] == result["request_id"]), "single"),
                "model_name": result["model_name"],
                "model_version": result.get("model_version"),
                "risk_score": result["risk_score"],
                "predicted_class": result["predicted_class"],
                "risk_level": result["risk_level"],
                "explanation": result.get("explanation", []),
                "xai": result.get("xai"),
                "input_features": next((request.get("input_features") for request in _requests if request["request_id"] == result["request_id"]), None),
                "created_at": result["created_at"],
                "feedback_status": "reviewed" if any(item["result_id"] == result["result_id"] for item in _feedback) else "pending",
            }
        )
    return sorted(items, key=lambda item: item["created_at"], reverse=True)


def upload_history(user_id: str) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select *
            from public.uploaded_files
            where user_id = %(user_id)s
            order by created_at desc
            """,
            {"user_id": user_id},
        )

    return sorted(
        [upload for upload in _uploads if upload.get("user_id") == user_id],
        key=lambda item: item["created_at"],
        reverse=True,
    )


def upload_detail(upload_id: str) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select *
            from public.batch_prediction_rows
            where upload_id = %(upload_id)s
            order by row_number asc
            """,
            {"upload_id": upload_id},
        )

    return [row for row in _batch_rows if row.get("upload_id") == upload_id]


# --- Admin monitoring -------------------------------------------------------

REPORTING_TIMEZONE = "Asia/Kuala_Lumpur"

# Activity categories map to action-name fragments so the same filter works for
# the database (ILIKE) and the in-memory store.
ACTIVITY_CATEGORIES: dict[str, tuple[str, ...]] = {
    "auth": ("LOGIN", "LOGOUT"),
    "assessment": ("PREDICTION",),
    "batch": ("BATCH", "UPLOAD"),
    "feedback": ("FEEDBACK",),
    "patient": ("PATIENT",),
    "report": ("REPORT",),
}
ACTIVITY_STATUS_PATTERNS: dict[str, tuple[str, ...]] = {
    "failed": ("FAIL", "ERROR"),
    "warning": ("PREVIEW", "RETRY", "DENIED"),
}


def _local_day(value: Any) -> date | None:
    from zoneinfo import ZoneInfo

    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(ZoneInfo(REPORTING_TIMEZONE)).date()


def _range_start(days: int) -> date:
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo(REPORTING_TIMEZONE)).date() - timedelta(days=days - 1)


def _day_series(days: int) -> list[str]:
    start = _range_start(days)
    return [(start + timedelta(days=offset)).isoformat() for offset in range(days)]


def _range_params(days: int) -> dict[str, Any]:
    return {"tz": REPORTING_TIMEZONE, "start_day": _range_start(days)}


RANGE_FILTER = "(created_at at time zone %(tz)s)::date >= %(start_day)s"


def admin_overview(days: int) -> dict[str, Any]:
    rows = _overview_rows(days)
    risk_counts = Counter(row["risk_level"] for row in rows)
    daily: dict[str, Counter] = {day: Counter() for day in _day_series(days)}
    for row in rows:
        day = str(row["day"])
        if day in daily:
            daily[day][row["risk_level"]] += 1

    totals = _overview_totals(days)
    return {
        "days": days,
        "totals": {
            **totals,
            "assessments": len(rows),
            "high_risk": risk_counts.get("high", 0),
            "active_users": len({row["user_id"] for row in rows if row.get("user_id")}),
            "single_assessments": sum(1 for row in rows if row.get("entry_type") != "batch"),
            "batch_assessments": sum(1 for row in rows if row.get("entry_type") == "batch"),
        },
        "risk_distribution": [
            {"risk_level": level, "count": risk_counts.get(level, 0)} for level in ("low", "moderate", "high")
        ],
        "daily": [
            {
                "day": day,
                "total": sum(counts.values()),
                "low": counts.get("low", 0),
                "moderate": counts.get("moderate", 0),
                "high": counts.get("high", 0),
            }
            for day, counts in daily.items()
        ],
        "model_usage": [
            {"model_name": name, "count": count}
            for name, count in Counter(row["model_name"] for row in rows).most_common()
        ],
    }


def _overview_rows(days: int) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            f"""
            select
              pr.user_id::text as user_id,
              pr.model_name,
              pr.risk_level,
              coalesce(req.entry_type, 'single') as entry_type,
              (pr.created_at at time zone %(tz)s)::date::text as day
            from public.prediction_results pr
            left join public.prediction_requests req on req.request_id = pr.request_id
            where {RANGE_FILTER.replace("created_at", "pr.created_at")}
            """,
            _range_params(days),
        )

    start = _range_start(days)
    request_by_id = {request["request_id"]: request for request in _requests}
    rows = []
    for result in _results:
        day = _local_day(result.get("created_at"))
        if day and day >= start:
            request = request_by_id.get(result["request_id"], {})
            rows.append(
                {
                    "user_id": result.get("user_id"),
                    "model_name": result["model_name"],
                    "risk_level": result["risk_level"],
                    "entry_type": request.get("entry_type", "single"),
                    "day": day.isoformat(),
                }
            )
    return rows


def _overview_totals(days: int) -> dict[str, int]:
    if database_enabled():
        rows = _query_database(
            f"""
            select
              (select count(*) from public.prediction_results)::int as all_time_assessments,
              (select count(*) from public.user_profiles)::int as registered_users,
              (select count(*) from public.domain_expert_feedback where {RANGE_FILTER})::int as feedback,
              (select count(*) from public.uploaded_files where {RANGE_FILTER})::int as batch_uploads,
              (select count(*) from public.batch_prediction_rows where status = 'failed' and {RANGE_FILTER})::int as failed_batch_rows
            """,
            _range_params(days),
        )
        return {key: int(value or 0) for key, value in (rows[0] if rows else {}).items()}

    start = _range_start(days)

    def in_range(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [item for item in items if (_local_day(item.get("created_at")) or date.min) >= start]

    return {
        "all_time_assessments": len(_results),
        "registered_users": len(_profiles),
        "feedback": len(in_range(_feedback)),
        "batch_uploads": len(in_range(_uploads)),
        "failed_batch_rows": sum(1 for row in in_range(_batch_rows) if row.get("status") == "failed"),
    }


def assessment_inputs(days: int) -> list[dict[str, Any]]:
    """Clinical inputs of assessments made in the range, for drift and parity checks."""
    features = _feature_keys()
    if database_enabled():
        return _query_database(
            f"""
            select
              {", ".join(f"req.{feature}" for feature in features)},
              (req.created_at at time zone %(tz)s)::date::text as day,
              res.risk_level,
              res.predicted_class
            from public.prediction_requests req
            left join public.prediction_results res on res.request_id = req.request_id
            where {RANGE_FILTER.replace("created_at", "req.created_at")}
            """,
            _range_params(days),
        )

    start = _range_start(days)
    result_by_request = {result["request_id"]: result for result in _results}
    rows = []
    for request in _requests:
        day = _local_day(request.get("created_at"))
        if day and day >= start:
            result = result_by_request.get(request["request_id"], {})
            rows.append(
                {
                    **{feature: request.get(feature) for feature in features},
                    "day": day.isoformat(),
                    "risk_level": result.get("risk_level"),
                    "predicted_class": result.get("predicted_class"),
                }
            )
    return rows


def live_prediction_parity(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """High-risk rate by subgroup over real assessments (no ground truth available)."""
    groups = {
        "sex": [("Female", lambda row: row["sex"] == 0), ("Male", lambda row: row["sex"] == 1)],
        "age_group": [
            ("Under 50", lambda row: row["age"] < 50),
            ("50-64", lambda row: 50 <= row["age"] < 65),
            ("65 and over", lambda row: row["age"] >= 65),
        ],
        "fasting_blood_sugar": [
            ("Normal (<= 120 mg/dl)", lambda row: row["fbs"] == 0),
            ("Elevated (> 120 mg/dl)", lambda row: row["fbs"] == 1),
        ],
    }
    scored = [
        {**row, "age": float(row["age"]), "sex": int(row["sex"]), "fbs": int(row["fbs"])}
        for row in rows
        if row.get("risk_level") and row.get("age") is not None
    ]
    parity = []
    for attribute, definitions in groups.items():
        for name, predicate in definitions:
            members = [row for row in scored if predicate(row)]
            parity.append(
                {
                    "attribute": attribute,
                    "group": name,
                    "assessments": len(members),
                    "high_risk_rate": round(sum(1 for row in members if row["risk_level"] == "high") / len(members), 4)
                    if members
                    else None,
                    "positive_rate": round(sum(1 for row in members if int(row.get("predicted_class") or 0) == 1) / len(members), 4)
                    if members
                    else None,
                }
            )
    return parity


def model_metric_history(days: int, model_name: str | None = None) -> list[dict[str, Any]]:
    if database_enabled():
        model_filter = "and model_name = %(model_name)s" if model_name else ""
        return _query_database(
            f"""
            select distinct on (model_name, (created_at at time zone %(tz)s)::date)
              model_name,
              model_version,
              (created_at at time zone %(tz)s)::date::text as day,
              accuracy, precision, sensitivity_recall, specificity, f1_score, auc_roc
            from public.model_metric_snapshots
            where {RANGE_FILTER} {model_filter}
            order by model_name, (created_at at time zone %(tz)s)::date, created_at desc
            """,
            {**_range_params(days), "model_name": model_name},
        )

    start = _range_start(days)
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for snapshot in sorted(_model_metric_snapshots, key=lambda item: item["created_at"]):
        day = _local_day(snapshot["created_at"])
        if day and day >= start and (not model_name or snapshot["model_name"] == model_name):
            latest[(snapshot["model_name"], day.isoformat())] = {**snapshot, "day": day.isoformat()}
    return list(latest.values())


def latest_model_metric_snapshots() -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select distinct on (model_name)
              model_name, model_version, accuracy, precision, sensitivity_recall,
              specificity, f1_score, auc_roc, true_negative, false_positive,
              false_negative, true_positive, created_at
            from public.model_metric_snapshots
            order by model_name, created_at desc
            """
        )

    latest: dict[str, dict[str, Any]] = {}
    for snapshot in sorted(_model_metric_snapshots, key=lambda item: item["created_at"]):
        latest[snapshot["model_name"]] = snapshot
    return list(latest.values())


def _pattern_clause(column: str, patterns: tuple[str, ...], prefix: str, params: dict[str, Any]) -> str:
    clauses = []
    for index, pattern in enumerate(patterns):
        key = f"{prefix}_{index}"
        params[key] = f"%{pattern}%"
        clauses.append(f"{column} ilike %({key})s")
    return "(" + " or ".join(clauses) + ")"


def activity_logs(
    page: int = 1,
    page_size: int = 10,
    search: str = "",
    sort_order: str = "desc",
    category: str | None = None,
    status: str | None = None,
    days: int | None = None,
) -> dict[str, Any]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size
    clean_search = search.strip()
    clean_sort = "asc" if sort_order == "asc" else "desc"

    if database_enabled():
        params: dict[str, Any] = {"limit": page_size, "offset": offset, "tz": REPORTING_TIMEZONE}
        conditions = []
        if clean_search:
            params["search"] = f"%{clean_search}%"
            conditions.append(
                """(
                  coalesce(log.user_id::text, '') ilike %(search)s
                  or coalesce(profile.email, '') ilike %(search)s
                  or coalesce(profile.full_name, '') ilike %(search)s
                  or log.action ilike %(search)s
                  or coalesce(log.entity_type, '') ilike %(search)s
                  or coalesce(log.entity_id::text, '') ilike %(search)s
                )"""
            )
        if category in ACTIVITY_CATEGORIES:
            conditions.append(_pattern_clause("log.action", ACTIVITY_CATEGORIES[category], "category", params))
        if status in ACTIVITY_STATUS_PATTERNS:
            conditions.append(_pattern_clause("log.action", ACTIVITY_STATUS_PATTERNS[status], "status", params))
        elif status == "success":
            failed_or_warning = ACTIVITY_STATUS_PATTERNS["failed"] + ACTIVITY_STATUS_PATTERNS["warning"]
            conditions.append("not " + _pattern_clause("log.action", failed_or_warning, "status", params))
        if days:
            params["start_day"] = _range_start(days)
            conditions.append("(log.created_at at time zone %(tz)s)::date >= %(start_day)s")
        where_clause = f"where {' and '.join(conditions)}" if conditions else ""
        source = """
            from public.activity_logs log
            left join public.user_profiles profile on profile.user_id = log.user_id
        """

        count_rows = _query_database(f"select count(*)::int as total {source} {where_clause}", params)
        rows = _query_database(
            f"""
            select
              log.log_id, log.created_at, log.user_id, log.action, log.entity_type,
              log.entity_id, log.metadata, profile.email, profile.full_name, profile.role
            {source}
            {where_clause}
            order by log.created_at {clean_sort}
            limit %(limit)s offset %(offset)s
            """,
            params,
        )
        return {
            "items": [_activity_log_item(row) for row in rows],
            "total": int((count_rows[0] if count_rows else {}).get("total") or 0),
            "page": page,
            "page_size": page_size,
        }

    profiles = {profile["user_id"]: profile for profile in _profiles}
    items = [
        _activity_log_item({**row, **{key: profiles.get(row.get("user_id"), {}).get(key) for key in ("email", "full_name", "role")}})
        for row in _activity_logs
    ]
    if clean_search:
        needle = clean_search.lower()
        items = [
            item
            for item in items
            if needle
            in " ".join(
                str(item.get(key) or "")
                for key in ("actor", "actor_name", "actor_email", "action", "entity_type", "entity_id", "status")
            ).lower()
        ]
    if category in ACTIVITY_CATEGORIES:
        items = [item for item in items if item["category"] == category]
    if status:
        items = [item for item in items if item["status"] == status]
    if days:
        start = _range_start(days)
        items = [item for item in items if (_local_day(item["timestamp"]) or date.min) >= start]

    items = sorted(items, key=lambda item: str(item.get("timestamp") or ""), reverse=clean_sort == "desc")
    return {
        "items": items[offset : offset + page_size],
        "total": len(items),
        "page": page,
        "page_size": page_size,
    }


def _activity_log_item(row: dict[str, Any]) -> dict[str, Any]:
    action = str(row.get("action") or "SYSTEM_EVENT")
    return {
        "log_id": row.get("log_id") or str(uuid4()),
        "timestamp": row.get("created_at") or _now(),
        "actor": row.get("user_id"),
        "actor_name": row.get("full_name"),
        "actor_email": row.get("email"),
        "actor_role": row.get("role"),
        "category": _activity_category(action),
        "action": action,
        "entity_type": row.get("entity_type"),
        "entity_id": row.get("entity_id"),
        "status": _activity_status(action),
        "details": row.get("metadata"),
    }


def _activity_category(action: str) -> str:
    for category, patterns in ACTIVITY_CATEGORIES.items():
        if any(pattern in action for pattern in patterns):
            return category
    return "system"


def _activity_status(action: str) -> str:
    for status, patterns in ACTIVITY_STATUS_PATTERNS.items():
        if any(pattern in action for pattern in patterns):
            return status
    return "success"
