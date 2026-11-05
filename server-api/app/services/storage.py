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
from app.services.email_service import EmailNotConfiguredError, send_reminder_email


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
_assessments: list[dict[str, Any]] = []
_assessment_inputs: list[dict[str, Any]] = []
_action_plans: list[dict[str, Any]] = []
_action_items: list[dict[str, Any]] = []
_reminders: list[dict[str, Any]] = []
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

    _model_metric_snapshots.append(payload)
    return await _insert("model_metric_snapshots", payload)


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


async def ensure_user_profile(user_id: str | None, default_role: str = "DOMAIN_EXPERT") -> None:
    if not user_id:
        return

    if get_user_profile(user_id):
        return

    if database_enabled():
        _ensure_user_profile_database(user_id, default_role)
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
        "full_name": "Patient User" if default_role == "PATIENT" else "Clinician User",
        "email": f"{user_id}@local.cardioxai",
        "role": default_role,
        "updated_at": _now(),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{SUPABASE_URL}/rest/v1/user_profiles", headers=headers, json=payload)
        response.raise_for_status()


def _ensure_user_profile_database(user_id: str, default_role: str = "DOMAIN_EXPERT") -> None:
    query = """
        insert into public.user_profiles (user_id, full_name, email, role, updated_at)
        values (%(user_id)s, %(full_name)s, %(email)s, %(role)s, %(updated_at)s)
        on conflict (user_id) do update
        set updated_at = excluded.updated_at
    """
    payload = {
        "user_id": user_id,
        "full_name": "Patient User" if default_role == "PATIENT" else "Clinician User",
        "email": f"{user_id}@local.cardioxai",
        "role": default_role,
        "updated_at": _now(),
    }
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, payload)


async def save_patient_assessment(request_payload: dict[str, Any], prediction: dict[str, Any]) -> tuple[str, str]:
    user_id = request_payload["user_id"]
    await ensure_user_profile(user_id, default_role="PATIENT")

    assessment_record = {
        "assessment_id": str(uuid4()),
        "user_id": user_id,
        "model_id": None,
        "assessed_at": _now(),
        "created_at": _now(),
        "risk_score": prediction["risk_score"],
        "risk_category": prediction["risk_level"],
        "confidence_level": prediction["confidence_level"],
        "prediction_method": prediction["prediction_method"],
        "estimated_inputs": prediction["estimated_inputs"],
        "missing_inputs": prediction["missing_inputs"],
        "explanation": prediction["explanation"],
    }
    _assessments.append(assessment_record)
    inserted_assessment = await _insert(
        "assessments",
        {key: value for key, value in assessment_record.items() if key != "assessment_id"},
    )
    assessment_id = inserted_assessment.get("assessment_id", assessment_record["assessment_id"])

    input_record = {
        "assessment_input_id": str(uuid4()),
        "assessment_id": assessment_id,
        "age": request_payload["age"],
        "sex": 1 if request_payload["sex"] == "male" else 0,
        "height_cm": request_payload.get("height_cm"),
        "bp_input_type": request_payload["bp_input_type"],
        "systolic_bp": request_payload.get("systolic_bp"),
        "diastolic_bp": request_payload.get("diastolic_bp"),
        "bp_category": request_payload.get("bp_category"),
        "cholesterol_input_type": request_payload["cholesterol_input_type"],
        "total_cholesterol": request_payload.get("total_cholesterol"),
        "cholesterol_category": request_payload.get("cholesterol_category"),
        "glucose_category": request_payload.get("glucose_category"),
        "diabetes_history": request_payload.get("diabetes_history"),
        "smoking_status": request_payload.get("smoking_status"),
        "activity_level": request_payload.get("activity_level"),
        "weight": request_payload.get("weight"),
        "weight_category": request_payload.get("weight_category"),
        "alcohol_intake": request_payload.get("alcohol_intake"),
        "created_at": _now(),
    }
    _assessment_inputs.append(input_record)
    inserted_input = await _insert(
        "assessments_input",
        {key: value for key, value in input_record.items() if key != "assessment_input_id"},
    )
    assessment_input_id = inserted_input.get("assessment_input_id", input_record["assessment_input_id"])

    await log_activity(user_id, "CREATE_PATIENT_ASSESSMENT", "assessments", assessment_id)
    return assessment_id, assessment_input_id


def patient_assessment_history(user_id: str) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select
              a.assessment_id,
              ai.assessment_input_id,
              a.assessed_at,
              a.created_at,
              a.risk_score,
              a.risk_category,
              a.confidence_level,
              a.prediction_method,
              a.estimated_inputs,
              a.missing_inputs,
              a.explanation,
              ai.age,
              ai.sex,
              ai.height_cm,
              ai.bp_input_type,
              ai.systolic_bp,
              ai.diastolic_bp,
              ai.bp_category,
              ai.cholesterol_input_type,
              ai.total_cholesterol,
              ai.cholesterol_category,
              ai.glucose_category,
              ai.diabetes_history,
              ai.smoking_status,
              ai.activity_level,
              ai.weight,
              ai.weight_category,
              ai.alcohol_intake
            from public.assessments a
            left join public.assessments_input ai on ai.assessment_id = a.assessment_id
            where a.user_id = %(user_id)s
            order by a.created_at desc
            """,
            {"user_id": user_id},
        )

    items = []
    for assessment in _assessments:
        if assessment.get("user_id") != user_id:
            continue
        assessment_input = next(
            (
                item
                for item in _assessment_inputs
                if item.get("assessment_id") == assessment.get("assessment_id")
            ),
            {},
        )
        items.append({**assessment, **assessment_input})
    return sorted(items, key=lambda item: item.get("created_at", ""), reverse=True)


async def delete_patient_assessment(assessment_id: str, user_id: str) -> bool:
    if database_enabled():
        rows = _query_database(
            """
            select assessment_id
            from public.assessments
            where assessment_id = %(assessment_id)s
              and user_id = %(user_id)s
            limit 1
            """,
            {"assessment_id": assessment_id, "user_id": user_id},
        )
        if not rows:
            return False

        _query_database(
            """
            delete from public.assessments_input
            where assessment_id = %(assessment_id)s
            """,
            {"assessment_id": assessment_id},
        )
        rows = _query_database(
            """
            delete from public.assessments
            where assessment_id = %(assessment_id)s
              and user_id = %(user_id)s
            returning assessment_id
            """,
            {"assessment_id": assessment_id, "user_id": user_id},
        )
        return bool(rows)

    before = len(_assessments)
    _assessments[:] = [
        assessment for assessment in _assessments
        if not (assessment.get("assessment_id") == assessment_id and assessment.get("user_id") == user_id)
    ]
    _assessment_inputs[:] = [
        assessment_input for assessment_input in _assessment_inputs
        if assessment_input.get("assessment_id") != assessment_id
    ]
    return len(_assessments) < before


def get_patient_assessment_with_input(assessment_id: str, user_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    if database_enabled():
        assessment_rows = _query_database(
            """
            select *
            from public.assessments
            where assessment_id = %(assessment_id)s
              and user_id = %(user_id)s
            limit 1
            """,
            {"assessment_id": assessment_id, "user_id": user_id},
        )
        if not assessment_rows:
            return None

        input_rows = _query_database(
            """
            select *
            from public.assessments_input
            where assessment_id = %(assessment_id)s
            limit 1
            """,
            {"assessment_id": assessment_id},
        )
        return assessment_rows[0], input_rows[0] if input_rows else {}

    assessment = next(
        (
            item
            for item in _assessments
            if item.get("assessment_id") == assessment_id and item.get("user_id") == user_id
        ),
        None,
    )
    if not assessment:
        return None
    assessment_input = next(
        (item for item in _assessment_inputs if item.get("assessment_id") == assessment_id),
        {},
    )
    return assessment, assessment_input


def list_reminders(user_id: str) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select *
            from public.reminders
            where user_id = %(user_id)s
            order by
              case when status = 'scheduled' then 0 else 1 end,
              reminder_time asc
            """,
            {"user_id": user_id},
        )

    return sorted(
        [reminder for reminder in _reminders if reminder.get("user_id") == user_id],
        key=lambda reminder: (reminder.get("status") != "scheduled", reminder.get("reminder_time", "")),
    )


async def create_reminder(payload: dict[str, Any]) -> dict[str, Any]:
    reminder = {
        "reminder_id": str(uuid4()),
        "user_id": payload["user_id"],
        "title": payload["title"],
        "description": payload.get("description"),
        "reminder_time": payload["reminder_time"],
        "linked_item": payload.get("linked_item"),
        "repeat_interval": payload.get("repeat_interval", "once"),
        "custom_mode": payload.get("custom_mode"),
        "custom_interval": payload.get("custom_interval"),
        "custom_unit": payload.get("custom_unit"),
        "selected_days": payload.get("selected_days", []),
        "status": "scheduled",
        "completed_at": None,
        "notified_at": None,
        "email_enabled": payload.get("email_enabled", True),
        "notification_channel": payload.get("notification_channel", "email"),
        "notification_error": None,
        "created_at": _now(),
        "updated_at": _now(),
    }

    _reminders.append(reminder)
    inserted = await _insert("reminders", {key: value for key, value in reminder.items() if key != "reminder_id"})
    reminder_id = inserted.get("reminder_id", reminder["reminder_id"])
    await log_activity(payload.get("user_id"), "CREATE_REMINDER", "reminders", reminder_id)
    return {**reminder, **inserted, "reminder_id": reminder_id}


async def update_reminder(reminder_id: str, user_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    update_payload = {key: value for key, value in payload.items() if value is not None}
    if not update_payload:
        return get_reminder(reminder_id, user_id)

    update_payload["updated_at"] = _now()
    if update_payload.get("status") == "completed":
        update_payload["completed_at"] = update_payload.get("completed_at") or _now()
    elif update_payload.get("status") == "scheduled":
        update_payload["completed_at"] = None
    reset_notification = any(
        key in update_payload
        for key in (
            "reminder_time",
            "repeat_interval",
            "custom_mode",
            "custom_interval",
            "custom_unit",
            "selected_days",
            "email_enabled",
            "notification_channel",
        )
    ) or update_payload.get("status") == "scheduled"
    reset_custom = update_payload.get("repeat_interval") is not None and update_payload.get("repeat_interval") != "custom"

    if database_enabled():
        rows = _query_database(
            """
            update public.reminders
            set
              title = coalesce(%(title)s, title),
              description = coalesce(%(description)s, description),
              reminder_time = coalesce(%(reminder_time)s, reminder_time),
              linked_item = coalesce(%(linked_item)s, linked_item),
              repeat_interval = coalesce(%(repeat_interval)s, repeat_interval),
              custom_mode = case when %(reset_custom)s then null else coalesce(%(custom_mode)s, custom_mode) end,
              custom_interval = case when %(reset_custom)s then null else coalesce(%(custom_interval)s, custom_interval) end,
              custom_unit = case when %(reset_custom)s then null else coalesce(%(custom_unit)s, custom_unit) end,
              selected_days = case when %(reset_custom)s then '[]'::jsonb else coalesce(%(selected_days)s, selected_days) end,
              status = coalesce(%(status)s, status),
              completed_at = case
                when %(status)s = 'completed' then coalesce(%(completed_at)s, completed_at, %(updated_at)s)
                when %(status)s = 'scheduled' then null
                else completed_at
              end,
              email_enabled = coalesce(%(email_enabled)s, email_enabled),
              notification_channel = coalesce(%(notification_channel)s, notification_channel),
              notified_at = case when %(reset_notification)s then null else notified_at end,
              notification_error = case when %(reset_notification)s then null else notification_error end,
              updated_at = %(updated_at)s
            where reminder_id = %(reminder_id)s
              and user_id = %(user_id)s
            returning *
            """,
            {
                "reminder_id": reminder_id,
                "user_id": user_id,
                "title": update_payload.get("title"),
                "description": update_payload.get("description"),
                "reminder_time": update_payload.get("reminder_time"),
                "linked_item": update_payload.get("linked_item"),
                "repeat_interval": update_payload.get("repeat_interval"),
                "custom_mode": update_payload.get("custom_mode"),
                "custom_interval": update_payload.get("custom_interval"),
                "custom_unit": update_payload.get("custom_unit"),
                "selected_days": update_payload.get("selected_days"),
                "reset_custom": reset_custom,
                "status": update_payload.get("status"),
                "completed_at": update_payload.get("completed_at"),
                "email_enabled": update_payload.get("email_enabled"),
                "notification_channel": update_payload.get("notification_channel"),
                "reset_notification": reset_notification,
                "updated_at": update_payload["updated_at"],
            },
        )
        return rows[0] if rows else None

    reminder = get_reminder(reminder_id, user_id)
    if not reminder:
        return None
    if reset_notification:
        update_payload["notified_at"] = None
        update_payload["notification_error"] = None
    reminder.update(update_payload)
    return reminder


async def delete_reminder(reminder_id: str, user_id: str) -> bool:
    if database_enabled():
        rows = _query_database(
            """
            delete from public.reminders
            where reminder_id = %(reminder_id)s
              and user_id = %(user_id)s
            returning reminder_id
            """,
            {"reminder_id": reminder_id, "user_id": user_id},
        )
        return bool(rows)

    before = len(_reminders)
    _reminders[:] = [
        reminder for reminder in _reminders
        if not (reminder.get("reminder_id") == reminder_id and reminder.get("user_id") == user_id)
    ]
    return len(_reminders) < before


def get_reminder(reminder_id: str, user_id: str) -> dict[str, Any] | None:
    if database_enabled():
        rows = _query_database(
            """
            select *
            from public.reminders
            where reminder_id = %(reminder_id)s
              and user_id = %(user_id)s
            limit 1
            """,
            {"reminder_id": reminder_id, "user_id": user_id},
        )
        return rows[0] if rows else None

    return next(
        (
            reminder
            for reminder in _reminders
            if reminder.get("reminder_id") == reminder_id and reminder.get("user_id") == user_id
        ),
        None,
    )


def due_email_reminders(limit: int = 25) -> list[dict[str, Any]]:
    if database_enabled():
        return _query_database(
            """
            select
              r.*,
              up.email as user_email,
              up.full_name as user_full_name
            from public.reminders r
            left join public.user_profiles up on up.user_id = r.user_id
            where r.status = 'scheduled'
              and r.email_enabled = true
              and r.notification_channel = 'email'
              and r.notified_at is null
              and r.notification_error is null
              and r.reminder_time <= now()
            order by r.reminder_time asc
            limit %(limit)s
            """,
            {"limit": limit},
        )

    now = _now()
    rows = []
    for reminder in _reminders:
        if len(rows) >= limit:
            break
        if reminder.get("status") != "scheduled":
            continue
        if reminder.get("email_enabled") is False or reminder.get("notification_channel") not in (None, "email"):
            continue
        if reminder.get("notified_at") or reminder.get("notification_error") or reminder.get("reminder_time", "") > now:
            continue
        profile = get_user_profile(reminder.get("user_id", "")) or {}
        rows.append({**reminder, "user_email": profile.get("email"), "user_full_name": profile.get("full_name")})
    return rows


def mark_reminder_notified(reminder_id: str, error: str | None = None, next_time: str | None = None) -> None:
    if next_time and error is None:
        payload = {
            "reminder_time": next_time,
            "notified_at": None,
            "notification_error": None,
            "updated_at": _now(),
        }
    else:
        payload = {
            "notified_at": _now() if error is None else None,
            "notification_error": error,
            "updated_at": _now(),
        }

    if database_enabled():
        _update_database("reminders", "reminder_id", reminder_id, payload)
        return

    for reminder in _reminders:
        if reminder.get("reminder_id") == reminder_id:
            reminder.update(payload)
            return


async def process_due_reminder_emails(limit: int = 25, dry_run: bool = False) -> dict[str, Any]:
    reminders = due_email_reminders(limit)
    results = []

    for reminder in reminders:
        reminder_id = reminder["reminder_id"]
        user_email = reminder.get("user_email")
        if not user_email:
            error = "User email is missing."
            if not dry_run:
                mark_reminder_notified(reminder_id, error)
            results.append({"reminder_id": reminder_id, "status": "failed", "error": error})
            continue

        subject = f"Reminder: {reminder['title']}"
        body = _reminder_email_body(reminder)
        if dry_run:
            results.append({"reminder_id": reminder_id, "status": "dry_run", "to": user_email, "subject": subject})
            continue

        try:
            email_result = await send_reminder_email(user_email, subject, body)
        except EmailNotConfiguredError as error:
            results.append({"reminder_id": reminder_id, "status": "skipped", "error": str(error)})
            continue
        except Exception as error:
            mark_reminder_notified(reminder_id, str(error))
            results.append({"reminder_id": reminder_id, "status": "failed", "error": str(error)})
            continue

        mark_reminder_notified(reminder_id, next_time=_next_reminder_time(reminder))
        await log_activity(reminder.get("user_id"), "SEND_REMINDER_EMAIL", "reminders", reminder_id)
        results.append(
            {
                "reminder_id": reminder_id,
                "status": "sent",
                "provider": email_result.provider,
                "message_id": email_result.message_id,
            }
        )

    return {
        "processed": len(results),
        "sent": sum(1 for item in results if item["status"] == "sent"),
        "failed": sum(1 for item in results if item["status"] == "failed"),
        "skipped": sum(1 for item in results if item["status"] == "skipped"),
        "dry_run": dry_run,
        "results": results,
    }


async def send_test_reminder_email(
    reminder_id: str,
    user_id: str,
    to_email: str | None = None,
    recipient_name: str | None = None,
) -> dict[str, Any] | None:
    reminder = get_reminder(reminder_id, user_id)
    if not reminder:
        return None

    profile = get_user_profile(user_id) or {}
    recipient = to_email or profile.get("email")
    if not recipient:
        raise ValueError("No email address is available for this user.")

    reminder_with_profile = {
        **reminder,
        "user_email": recipient,
        "user_full_name": recipient_name or profile.get("full_name"),
    }
    subject = f"Reminder: {reminder.get('title', 'Health reminder')}"
    body = _reminder_email_body(reminder_with_profile)
    email_result = await send_reminder_email(recipient, subject, body)
    await log_activity(user_id, "SEND_TEST_REMINDER_EMAIL", "reminders", reminder_id)

    return {
        "reminder_id": reminder_id,
        "status": "sent",
        "provider": email_result.provider,
        "message_id": email_result.message_id,
        "to": recipient,
        "subject": subject,
        "body": body,
    }


def _reminder_email_body(reminder: dict[str, Any]) -> str:
    name = reminder.get("user_full_name") or "there"
    description = reminder.get("description")
    linked_item = reminder.get("linked_item")
    repeat_summary = _format_repeat_summary(reminder)
    details = []
    if description:
        details.append(description)
    if linked_item:
        details.append(f"Linked item: {linked_item}")

    details_text = "\n".join(details) if details else "No extra details were added."
    return (
        f"Hi {name},\n\n"
        "This is your CardioXAI reminder:\n\n"
        f"{reminder['title']}\n\n"
        f"Scheduled time: {reminder['reminder_time']}\n\n"
        f"Repeat: {repeat_summary}\n\n"
        f"{details_text}\n\n"
        "This reminder supports your self-management plan and does not replace medical advice or prescribed treatment."
    )


def _format_repeat_summary(reminder: dict[str, Any]) -> str:
    repeat = reminder.get("repeat_interval") or "once"
    if repeat == "once":
        return "Once"
    if repeat == "daily":
        return "Daily"
    if repeat == "weekly":
        return "Weekly"
    if repeat in WEEKDAY_INDEX:
        return repeat.capitalize()
    if repeat == "custom" and reminder.get("custom_mode") == "interval":
        interval = reminder.get("custom_interval") or 1
        unit = reminder.get("custom_unit") or "days"
        unit_label = unit[:-1] if interval == 1 and unit.endswith("s") else unit
        return f"Every {interval} {unit_label}"
    if repeat == "custom" and reminder.get("custom_mode") == "selected_days":
        days = reminder.get("selected_days") or []
        if days:
            return "Custom days: " + ", ".join(str(day).capitalize() for day in days)
    return "Custom"


def _next_reminder_time(reminder: dict[str, Any]) -> str | None:
    repeat = reminder.get("repeat_interval", "once")
    current_time = _parse_datetime(reminder.get("reminder_time"))
    if repeat in ("once", "none", None):
        return None
    if repeat == "daily":
        return (current_time + timedelta(days=1)).isoformat()
    if repeat == "weekly":
        return (current_time + timedelta(days=7)).isoformat()
    if repeat in WEEKDAY_INDEX:
        return _next_weekday_time(current_time, WEEKDAY_INDEX[repeat]).isoformat()
    if repeat == "custom":
        if reminder.get("custom_mode") == "interval":
            return _next_custom_interval_time(
                current_time,
                int(reminder.get("custom_interval") or 1),
                reminder.get("custom_unit") or "days",
            ).isoformat()
        if reminder.get("custom_mode") == "selected_days":
            days = reminder.get("selected_days") or []
            if isinstance(days, str):
                try:
                    import json

                    days = json.loads(days)
                except Exception:
                    days = []
            indexes = sorted(WEEKDAY_INDEX[day] for day in days if day in WEEKDAY_INDEX)
            if indexes:
                return _next_selected_day_time(current_time, indexes).isoformat()
    return None


WEEKDAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _parse_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _next_weekday_time(current_time: datetime, weekday_index: int) -> datetime:
    days_ahead = (weekday_index - current_time.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return current_time + timedelta(days=days_ahead)


def _next_selected_day_time(current_time: datetime, weekday_indexes: list[int]) -> datetime:
    candidates = [_next_weekday_time(current_time, weekday_index) for weekday_index in weekday_indexes]
    return min(candidates)


def _next_custom_interval_time(current_time: datetime, interval: int, unit: str) -> datetime:
    if unit == "minutes":
        return current_time + timedelta(minutes=interval)
    if unit == "hours":
        return current_time + timedelta(hours=interval)
    if unit == "weeks":
        return current_time + timedelta(weeks=interval)
    return current_time + timedelta(days=interval)


def get_action_plan_for_assessment(assessment_id: str, user_id: str) -> dict[str, Any] | None:
    if database_enabled():
        rows = _query_database(
            """
            select *
            from public.action_plans
            where assessment_id = %(assessment_id)s
              and user_id = %(user_id)s
            order by created_at desc
            limit 1
            """,
            {"assessment_id": assessment_id, "user_id": user_id},
        )
        if not rows:
            return None
        return _with_action_items(rows[0])

    plan = next(
        (
            item
            for item in sorted(_action_plans, key=lambda row: row.get("created_at", ""), reverse=True)
            if item.get("assessment_id") == assessment_id and item.get("user_id") == user_id
        ),
        None,
    )
    return _with_action_items(plan) if plan else None


async def save_action_plan(
    user_id: str,
    assessment: dict[str, Any],
    plan_payload: dict[str, Any],
    generated_by: str,
    ai_model: str | None,
    generation_metadata: dict[str, Any],
) -> dict[str, Any]:
    await ensure_user_profile(user_id, default_role="PATIENT")

    plan_record = {
        "action_plan_id": str(uuid4()),
        "user_id": user_id,
        "assessment_id": assessment.get("assessment_id"),
        "title": plan_payload["title"],
        "summary": plan_payload["summary"],
        "risk_score": assessment.get("risk_score"),
        "risk_category": assessment.get("risk_category"),
        "generated_by": generated_by,
        "ai_model": ai_model,
        "generation_metadata": generation_metadata,
        "created_at": _now(),
        "updated_at": _now(),
    }
    _action_plans.append(plan_record)
    inserted_plan = await _insert(
        "action_plans",
        {key: value for key, value in plan_record.items() if key != "action_plan_id"},
    )
    action_plan_id = inserted_plan.get("action_plan_id", plan_record["action_plan_id"])
    plan_record = {**plan_record, **inserted_plan, "action_plan_id": action_plan_id}

    saved_items = []
    for item in plan_payload["items"]:
        item_record = {
            "action_item_id": str(uuid4()),
            "action_plan_id": action_plan_id,
            "title": item["title"],
            "priority": item["priority"],
            "factor": item["factor"],
            "difficulty": item["difficulty"],
            "reason": item["reason"],
            "timeframe": item["timeframe"],
            "specific_examples": item.get("specific_examples", []),
            "next_step": item["next_step"],
            "barrier_plan": item["barrier_plan"],
            "measure": item["measure"],
            "status": item.get("status", "not_started"),
            "created_at": _now(),
            "updated_at": _now(),
        }
        _action_items.append(item_record)
        inserted_item = await _insert(
            "action_items",
            {key: value for key, value in item_record.items() if key != "action_item_id"},
        )
        saved_items.append({**item_record, **inserted_item})

    await log_activity(user_id, "GENERATE_ACTION_PLAN", "action_plans", action_plan_id)
    return {**plan_record, "items": saved_items}


def _with_action_items(plan: dict[str, Any]) -> dict[str, Any]:
    if database_enabled():
        items = _query_database(
            """
            select *
            from public.action_items
            where action_plan_id = %(action_plan_id)s
            order by created_at asc
            """,
            {"action_plan_id": plan["action_plan_id"]},
        )
        return {**plan, "items": items}

    items = [
        item
        for item in _action_items
        if item.get("action_plan_id") == plan.get("action_plan_id")
    ]
    return {**plan, "items": items}


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


def activity_logs(
    page: int = 1,
    page_size: int = 10,
    search: str = "",
    sort_order: str = "desc",
) -> dict[str, Any]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size
    clean_search = search.strip()
    clean_sort = "asc" if sort_order == "asc" else "desc"

    if database_enabled():
        where_clause = ""
        params: dict[str, Any] = {"limit": page_size, "offset": offset}
        if clean_search:
            params["search"] = f"%{clean_search}%"
            where_clause = """
            where
              coalesce(user_id::text, '') ilike %(search)s
              or coalesce(action, '') ilike %(search)s
              or coalesce(entity_type, '') ilike %(search)s
              or coalesce(entity_id::text, '') ilike %(search)s
            """

        count_rows = _query_database(
            f"select count(*)::int as total from public.activity_logs {where_clause}",
            params,
        )
        rows = _query_database(
            f"""
            select
              log_id,
              created_at,
              user_id,
              action,
              entity_type,
              entity_id
            from public.activity_logs
            {where_clause}
            order by created_at {clean_sort}
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

    items = [_activity_log_item(row) for row in _activity_logs]
    if clean_search:
        needle = clean_search.lower()
        items = [
            item
            for item in items
            if needle
            in " ".join(
                str(value or "")
                for value in (
                    item.get("actor"),
                    item.get("event_type"),
                    item.get("action"),
                    item.get("entity_type"),
                    item.get("entity_id"),
                    item.get("status"),
                )
            ).lower()
        ]

    reverse = clean_sort == "desc"
    items = sorted(items, key=lambda item: str(item.get("timestamp") or ""), reverse=reverse)
    total = len(items)
    return {
        "items": items[offset : offset + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def admin_monitoring_dashboard(model_metrics: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    if database_enabled():
        return _database_admin_monitoring_dashboard(model_metrics)

    performance = _memory_performance_monitoring(model_metrics)
    fairness = _memory_fairness_monitoring()
    drift = _memory_drift_monitoring()
    errors = _memory_error_monitoring()

    return {
        "summary": admin_summary(),
        "performance": performance,
        "fairness": fairness,
        "drift": drift,
        "errors": errors,
        "last_updated": _now(),
    }


def _database_admin_monitoring_dashboard(model_metrics: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "summary": _database_admin_summary(),
        "performance": _database_performance_monitoring(model_metrics),
        "fairness": _database_fairness_monitoring(),
        "drift": _database_drift_monitoring(),
        "errors": _database_error_monitoring(),
        "last_updated": _now(),
    }


def _database_admin_summary() -> dict[str, Any]:
    rows = _query_database(
        """
        select
          (select count(*) from public.user_profiles) as total_users,
          (select count(*) from public.prediction_results) as total_predictions,
          (select count(*) from public.uploaded_files) as total_uploads,
          (select count(*) from public.batch_prediction_rows where status = 'success') as successful_batch_rows,
          (select count(*) from public.batch_prediction_rows where status = 'failed') as failed_batch_rows
        """
    )
    usage = _query_database(
        """
        select model_name, count(*)::int as count
        from public.prediction_results
        group by model_name
        order by count desc
        """
    )
    summary = rows[0] if rows else {}
    return {
        "total_users": int(summary.get("total_users", 0) or 0),
        "total_predictions": int(summary.get("total_predictions", 0) or 0),
        "total_uploads": int(summary.get("total_uploads", 0) or 0),
        "successful_batch_rows": int(summary.get("successful_batch_rows", 0) or 0),
        "failed_batch_rows": int(summary.get("failed_batch_rows", 0) or 0),
        "model_usage": usage,
    }


def _database_performance_monitoring(model_metrics: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    latest = _normalise_metric_rows(model_metrics) if model_metrics else []
    if not latest:
        latest = _query_database(
            """
            select distinct on (model_name)
              model_name, model_version, accuracy, precision, sensitivity_recall,
              specificity, f1_score, auc_roc, created_at
            from public.model_metric_snapshots
            order by model_name, created_at desc
            """
        )
    trend = _query_database(
        """
        select
          to_char(created_at::date, 'Mon DD') as day,
          round(avg(auc_roc)::numeric, 4) as auc,
          round(avg(f1_score)::numeric, 4) as f1,
          round(avg(abs(precision - sensitivity_recall))::numeric, 4) as calibration
        from public.model_metric_snapshots
        where created_at >= now() - interval '7 days'
        group by created_at::date
        order by created_at::date
        """
    )
    total_today = _query_database(
        """
        select count(*)::int as count
        from public.prediction_results
        where created_at::date = current_date
        """
    )
    latest_best = max(latest, key=lambda item: float(item.get("auc_roc") or 0), default={})
    avg_f1 = _avg([row.get("f1_score") for row in latest])
    avg_calibration = _avg([abs(float(row.get("precision") or 0) - float(row.get("sensitivity_recall") or 0)) for row in latest])

    return {
        "metrics": [
            _metric("Current AUC", _format_decimal(latest_best.get("auc_roc"), "0.91"), "Best latest model snapshot", "TrendingUp", "cyan"),
            _metric("F1 score", _format_decimal(avg_f1, "0.85"), "Average across latest model snapshots", "Gauge", "green"),
            _metric("Calibration proxy", _format_decimal(avg_calibration, "0.06"), "Precision-recall gap; lower is better", "TrendingDown", "green"),
            _metric("Assessments today", f"{int(total_today[0].get('count', 0) if total_today else 0):,}", "Completed prediction results", "Activity", "slate"),
        ],
        "trend": trend or _default_performance_trend(),
        "model_comparison": _model_comparison_rows(latest)
        or _default_model_comparison(),
    }


def _database_fairness_monitoring() -> dict[str, Any]:
    rows = _query_database(
        """
        select distinct on (sensitive_attribute, group_name, metric_name)
          sensitive_attribute, group_name, metric_name, metric_value, created_at
        from public.fairness_metric_snapshots
        order by sensitive_attribute, group_name, metric_name, created_at desc
        """
    )
    if not rows:
        return _memory_fairness_monitoring()

    grouped: dict[str, dict[str, Any]] = defaultdict(dict)
    for row in rows:
        group = row["group_name"]
        grouped[group]["group"] = group
        grouped[group]["sample"] = "Snapshot"
        grouped[group][row["metric_name"]] = row["metric_value"]

    cohorts = []
    for item in grouped.values():
        tpr = float(item.get("tpr") or item.get("true_positive_rate") or item.get("equal_opportunity") or 0)
        fpr = float(item.get("fpr") or item.get("false_positive_rate") or 0)
        gap = float(item.get("disparity_gap") or item.get("demographic_parity_difference") or 0)
        cohorts.append(_fairness_row(item["group"], item["sample"], tpr, fpr, gap))

    return {
        "cohorts": cohorts,
        "chart": [{"cohort": row["group"], "disparity": row["disparity"]} for row in cohorts],
        "watch_count": sum(1 for row in cohorts if row["tone"] in ("amber", "red")),
    }


def _database_drift_monitoring() -> dict[str, Any]:
    latest = _query_database(
        """
        select distinct on (feature_name)
          feature_name, drift_score, threshold_value, drift_status, alert_triggered
        from public.data_drift_snapshots
        order by feature_name, created_at desc
        """
    )
    trend = _query_database(
        """
        select
          to_char(created_at::date, 'Mon DD') as day,
          round(avg(drift_score) filter (where feature_name in ('thalach', 'max_heart_rate'))::numeric, 4) as hr,
          round(avg(drift_score) filter (where feature_name in ('trestbps', 'resting_bp'))::numeric, 4) as bp,
          round(avg(drift_score) filter (where feature_name in ('chol', 'cholesterol'))::numeric, 4) as cholesterol
        from public.data_drift_snapshots
        where created_at >= now() - interval '7 days'
        group by created_at::date
        order by created_at::date
        """
    )
    if not latest:
        return _memory_drift_monitoring()

    features = [
        {
            "feature": _feature_label_for_admin(row["feature_name"]),
            "psi": round(float(row.get("drift_score") or 0), 4),
            "status": _drift_status_label(float(row.get("drift_score") or 0), float(row.get("threshold_value") or 0.2)),
            "tone": _drift_tone(float(row.get("drift_score") or 0), float(row.get("threshold_value") or 0.2)),
        }
        for row in latest
    ]
    max_score = max((feature["psi"] for feature in features), default=0)
    active_alerts = sum(1 for feature in features if feature["tone"] == "red")
    threshold_progress = min(round((max_score / 0.2) * 100), 100) if max_score else 0

    return {
        "metrics": [
            _metric("Overall drift score", _format_decimal(max_score, "0.16"), "Highest latest PSI across features", "DatabaseZap", _drift_tone(max_score, 0.2)),
            _metric("Features monitored", str(len(features)), "Clinical inputs with drift snapshots", "BarChart3", "slate"),
            _metric("Retrain trigger", f"{threshold_progress}%", "Of policy threshold reached", "RefreshCw", "cyan"),
            _metric("Active alerts", str(active_alerts), "Features above drift threshold", "AlertTriangle", "red" if active_alerts else "green"),
        ],
        "trend": _fill_drift_trend(trend),
        "features": features,
        "active_alerts": active_alerts,
    }


def _database_error_monitoring() -> dict[str, Any]:
    rows = _query_database(
        """
        select
          bpr.batch_row_id::text as id,
          coalesce(bpr.patient_reference_id, 'Unassigned') as patient,
          coalesce(bpr.error_message, 'Batch row failed') as issue,
          coalesce(uf.file_name, 'Batch upload') as source,
          bpr.created_at,
          bpr.status
        from public.batch_prediction_rows bpr
        left join public.uploaded_files uf on uf.upload_id = bpr.upload_id
        where bpr.status = 'failed'
        order by bpr.created_at desc
        limit 12
        """
    )
    trend = _query_database(
        """
        select
          to_char(created_at::date, 'Mon DD') as day,
          count(*) filter (where status = 'failed')::int as failed,
          count(*) filter (where status = 'success')::int as resolved
        from public.batch_prediction_rows
        where created_at >= now() - interval '7 days'
        group by created_at::date
        order by created_at::date
        """
    )
    return _error_payload(rows, trend)


def _memory_performance_monitoring(model_metrics: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    if model_metrics:
        latest = _normalise_metric_rows(model_metrics)
        best = max(latest, key=lambda item: float(item.get("auc_roc") or 0), default={})
        today = date.today().isoformat()
        assessments_today = sum(1 for result in _results if str(result.get("created_at", "")).startswith(today))
        return {
            "metrics": [
                _metric("Current AUC", _format_decimal(best.get("auc_roc"), "0.91"), "Best current model", "TrendingUp", "cyan"),
                _metric("F1 score", _format_decimal(_avg([row.get("f1_score") for row in latest]), "0.85"), "Average across all 4 models", "Gauge", "green"),
                _metric("Calibration proxy", _format_decimal(_avg([abs(float(row.get("precision") or 0) - float(row.get("sensitivity_recall") or 0)) for row in latest]), "0.06"), "Precision-recall gap; lower is better", "TrendingDown", "green"),
                _metric("Assessments today", f"{assessments_today:,}", "Completed prediction results", "Activity", "slate"),
            ],
            "trend": _default_performance_trend(),
            "model_comparison": _model_comparison_rows(latest),
        }

    latest_by_model: dict[str, dict[str, Any]] = {}
    for row in _model_metric_snapshots:
        current = latest_by_model.get(row["model_name"])
        if not current or row["created_at"] > current["created_at"]:
            latest_by_model[row["model_name"]] = row

    latest = list(latest_by_model.values())
    best = max(latest, key=lambda item: float(item.get("auc_roc") or 0), default={})
    today = date.today().isoformat()
    assessments_today = sum(1 for result in _results if str(result.get("created_at", "")).startswith(today))

    return {
        "metrics": [
            _metric("Current AUC", _format_decimal(best.get("auc_roc"), "0.91"), "Best latest model snapshot", "TrendingUp", "cyan"),
            _metric("F1 score", _format_decimal(_avg([row.get("f1_score") for row in latest]), "0.85"), "Average across latest model snapshots", "Gauge", "green"),
            _metric("Calibration proxy", _format_decimal(_avg([abs(float(row.get("precision") or 0) - float(row.get("sensitivity_recall") or 0)) for row in latest]), "0.06"), "Precision-recall gap; lower is better", "TrendingDown", "green"),
            _metric("Assessments today", f"{assessments_today:,}", "Completed prediction results", "Activity", "slate"),
        ],
        "trend": _memory_performance_trend(latest),
        "model_comparison": _model_comparison_rows(latest)
        or _default_model_comparison(),
    }


def _memory_fairness_monitoring() -> dict[str, Any]:
    if not _requests or not _results:
        cohorts = [
            _fairness_row("Female patients", "Demo", 0.848, 0.071, 1.6),
            _fairness_row("Male patients", "Demo", 0.832, 0.079, 0),
            _fairness_row("Age 65+", "Demo", 0.794, 0.098, -3.8),
            _fairness_row("High cholesterol", "Demo", 0.811, 0.085, -2.1),
        ]
        return {
            "cohorts": cohorts,
            "chart": [{"cohort": row["group"].replace(" patients", ""), "disparity": row["disparity"]} for row in cohorts],
            "watch_count": 1,
        }

    joined = []
    request_by_id = {request["request_id"]: request for request in _requests}
    for result in _results:
        request = request_by_id.get(result["request_id"])
        if request:
            joined.append({**request, **result})

    groups = [
        ("Female patients", lambda row: row.get("sex") == 0),
        ("Male patients", lambda row: row.get("sex") == 1),
        ("Age 65+", lambda row: int(row.get("age") or 0) >= 65),
        ("High cholesterol", lambda row: float(row.get("chol") or 0) >= 240),
    ]
    baseline_rate = _positive_rate([row for row in joined if row.get("sex") == 1])
    cohorts = []
    for name, predicate in groups:
        rows = [row for row in joined if predicate(row)]
        rate = _positive_rate(rows)
        gap = (rate - baseline_rate) * 100
        cohorts.append(_fairness_row(name, f"{len(rows):,}", rate, max(rate * 0.12, 0.01), gap))

    return {
        "cohorts": cohorts,
        "chart": [{"cohort": row["group"].replace(" patients", ""), "disparity": row["disparity"]} for row in cohorts],
        "watch_count": sum(1 for row in cohorts if row["tone"] in ("amber", "red")),
    }


def _memory_drift_monitoring() -> dict[str, Any]:
    features = _memory_feature_drift()
    max_score = max((feature["psi"] for feature in features), default=0)
    alerts = sum(1 for feature in features if feature["tone"] == "red")
    return {
        "metrics": [
            _metric("Overall drift score", _format_decimal(max_score, "0.16"), "Estimated shift from training baseline", "DatabaseZap", _drift_tone(max_score, 0.2)),
            _metric("Features monitored", str(len(features)), "Clinical inputs derived from assessments", "BarChart3", "slate"),
            _metric("Retrain trigger", f"{min(round((max_score / 0.2) * 100), 100) if max_score else 72}%", "Of policy threshold reached", "RefreshCw", "cyan"),
            _metric("Active alerts", str(alerts), "Features above drift threshold", "AlertTriangle", "red" if alerts else "green"),
        ],
        "trend": _default_drift_trend(),
        "features": features,
        "active_alerts": alerts,
    }


def _memory_error_monitoring() -> dict[str, Any]:
    rows = [
        {
            "id": row["batch_row_id"],
            "patient": row.get("patient_reference_id") or "Unassigned",
            "issue": row.get("error_message") or "Batch row failed",
            "source": "Batch prediction",
            "created_at": row.get("created_at"),
            "status": row.get("status"),
        }
        for row in _batch_rows
        if row.get("status") == "failed"
    ]
    return _error_payload(rows, _memory_error_trend())


def _memory_feature_drift() -> list[dict[str, Any]]:
    if not _requests:
        return [
            {"feature": "Resting BP", "psi": 0.18, "status": "Moderate", "tone": "amber"},
            {"feature": "Cholesterol", "psi": 0.11, "status": "Stable", "tone": "green"},
            {"feature": "Max heart rate", "psi": 0.24, "status": "Investigate", "tone": "red"},
            {"feature": "Oldpeak", "psi": 0.08, "status": "Stable", "tone": "green"},
            {"feature": "Chest pain type", "psi": 0.15, "status": "Moderate", "tone": "amber"},
        ]

    baseline = {
        "trestbps": 131.6,
        "chol": 246.7,
        "thalach": 149.6,
        "oldpeak": 1.04,
        "cp": 3.16,
    }
    labels = {
        "trestbps": "Resting BP",
        "chol": "Cholesterol",
        "thalach": "Max heart rate",
        "oldpeak": "Oldpeak",
        "cp": "Chest pain type",
    }
    features = []
    for feature, baseline_mean in baseline.items():
        values = [float(row.get(feature) or 0) for row in _requests if row.get(feature) is not None]
        current = sum(values) / len(values) if values else baseline_mean
        score = min(abs(current - baseline_mean) / max(abs(baseline_mean), 1), 0.35)
        features.append(
            {
                "feature": labels[feature],
                "psi": round(score, 4),
                "status": _drift_status_label(score, 0.2),
                "tone": _drift_tone(score, 0.2),
            }
        )
    return features


def _memory_performance_trend(latest: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in latest:
        day = str(row.get("created_at", ""))[:10]
        if day:
            by_day[day].append(row)
    trend = []
    for day in sorted(by_day)[-7:]:
        rows = by_day[day]
        trend.append(
            {
                "day": _short_day(day),
                "auc": round(_avg([row.get("auc_roc") for row in rows]) or 0, 4),
                "f1": round(_avg([row.get("f1_score") for row in rows]) or 0, 4),
                "calibration": round(_avg([abs(float(row.get("precision") or 0) - float(row.get("sensitivity_recall") or 0)) for row in rows]) or 0, 4),
            }
        )
    return trend or _default_performance_trend()


def _memory_error_trend() -> list[dict[str, Any]]:
    start = date.today() - timedelta(days=6)
    rows = []
    for offset in range(7):
        day = start + timedelta(days=offset)
        day_key = day.isoformat()
        rows.append(
            {
                "day": day.strftime("%b %d"),
                "failed": sum(1 for row in _batch_rows if str(row.get("created_at", "")).startswith(day_key) and row.get("status") == "failed"),
                "resolved": sum(1 for row in _batch_rows if str(row.get("created_at", "")).startswith(day_key) and row.get("status") == "success"),
            }
        )
    return rows


def _error_payload(rows: list[dict[str, Any]], trend: list[dict[str, Any]]) -> dict[str, Any]:
    chart_trend = trend or _default_error_trend()
    error_rows = [
        {
            "id": str(row.get("id", ""))[:12] or "ERR",
            "patient": row.get("patient") or "Unassigned",
            "issue": row.get("issue") or "Assessment failed",
            "source": row.get("source") or "Batch prediction",
            "time": _relative_time(row.get("created_at")),
            "status": "Needs review",
            "tone": "amber",
        }
        for row in rows[:8]
    ]
    failed_total = sum(int(row.get("failed") or 0) for row in chart_trend)
    resolved_total = sum(int(row.get("resolved") or 0) for row in chart_trend)
    sla = round((resolved_total / (failed_total + resolved_total)) * 100) if failed_total + resolved_total else 100
    return {
        "rows": error_rows,
        "trend": chart_trend,
        "open_failures": len(rows),
        "resolved_today": int((chart_trend[-1] if chart_trend else {}).get("resolved") or 0),
        "sla": sla,
    }


def _metric(label: str, value: str, detail: str, icon: str, tone: str) -> dict[str, str]:
    return {"label": label, "value": value, "detail": detail, "icon": icon, "tone": tone}


def _activity_log_item(row: dict[str, Any]) -> dict[str, Any]:
    action = str(row.get("action") or "SYSTEM_EVENT")
    entity_type = row.get("entity_type")
    created_at = row.get("created_at") or _now()
    return {
        "log_id": row.get("log_id") or str(uuid4()),
        "timestamp": created_at,
        "actor": row.get("user_id"),
        "event_type": entity_type or _activity_event_type(action),
        "action": action,
        "entity_type": entity_type,
        "entity_id": row.get("entity_id"),
        "status": _activity_status(action),
    }


def _activity_event_type(action: str) -> str:
    if "PREDICTION" in action or "ASSESSMENT" in action:
        return "assessment"
    if "BATCH" in action or "UPLOAD" in action:
        return "batch"
    if "FEEDBACK" in action:
        return "feedback"
    if "ERROR" in action or "FAILED" in action:
        return "error"
    return "system"


def _activity_status(action: str) -> str:
    if "FAILED" in action or "ERROR" in action or "FAILURE" in action:
        return "failed"
    if "PREVIEW" in action or "RETRY" in action:
        return "warning"
    return "success"


def _fairness_row(group: str, sample: str, tpr: float, fpr: float, gap: float) -> dict[str, Any]:
    absolute_gap = abs(gap)
    tone = "red" if absolute_gap >= 5 else "amber" if absolute_gap >= 3 else "green"
    status = "Investigate" if tone == "red" else "Watch" if tone == "amber" else "Within limit"
    if absolute_gap == 0:
        tone = "cyan"
        status = "Reference"
    return {
        "group": group,
        "sample": sample,
        "tpr": _percent(tpr),
        "fpr": _percent(fpr),
        "gap": "Baseline" if absolute_gap == 0 else f"{gap:+.1f}%",
        "disparity": round(gap, 2),
        "status": status,
        "tone": tone,
    }


def _avg(values: list[Any]) -> float | None:
    clean = [float(value) for value in values if value is not None]
    return sum(clean) / len(clean) if clean else None


def _positive_rate(rows: list[dict[str, Any]]) -> float:
    if not rows:
        return 0.0
    return sum(1 for row in rows if int(row.get("predicted_class") or 0) == 1) / len(rows)


def _format_decimal(value: Any, fallback: str) -> str:
    if value is None:
        return fallback
    return f"{float(value):.2f}"


def _percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def _display_model_name(model_name: str) -> str:
    labels = {
        "xgboost": "XGBoost",
        "random_forest": "Random Forest",
        "neural_network": "Neural Network",
        "logistic_regression": "Logistic Regression",
    }
    return labels.get(model_name, model_name.replace("_", " ").title())


def _normalise_metric_rows(metrics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    order = {
        "xgboost": 0,
        "random_forest": 1,
        "neural_network": 2,
        "logistic_regression": 3,
    }
    return sorted(
        [{**metric, "created_at": metric.get("created_at") or _now()} for metric in metrics],
        key=lambda item: order.get(str(item.get("model_name")), 99),
    )


def _model_comparison_rows(metrics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "model": _display_model_name(row["model_name"]),
            "accuracy": round(float(row.get("accuracy") or 0) * 100),
            "auc": round(float(row.get("auc_roc") or 0) * 100),
            "precision": round(float(row.get("precision") or 0) * 100),
            "recall": round(float(row.get("sensitivity_recall") or 0) * 100),
            "f1": round(float(row.get("f1_score") or 0) * 100),
        }
        for row in metrics
    ]


def _feature_label_for_admin(feature_name: str) -> str:
    labels = {
        "trestbps": "Resting BP",
        "chol": "Cholesterol",
        "thalach": "Max heart rate",
        "cp": "Chest pain type",
    }
    return labels.get(feature_name, feature_name.replace("_", " ").title())


def _drift_tone(score: float, threshold: float) -> str:
    if score >= threshold:
        return "red"
    if score >= threshold * 0.6:
        return "amber"
    return "green"


def _drift_status_label(score: float, threshold: float) -> str:
    tone = _drift_tone(score, threshold)
    return "Investigate" if tone == "red" else "Moderate" if tone == "amber" else "Stable"


def _fill_drift_trend(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clean = [
        {
            "day": row["day"],
            "hr": float(row.get("hr") or 0),
            "bp": float(row.get("bp") or 0),
            "cholesterol": float(row.get("cholesterol") or 0),
        }
        for row in rows
    ]
    return clean or _default_drift_trend()


def _relative_time(value: Any) -> str:
    if not value:
        return "Recently"
    try:
        created = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    delta = datetime.now(UTC) - created.astimezone(UTC)
    if delta.days == 0:
        return "Today"
    if delta.days == 1:
        return "Yesterday"
    return f"{delta.days} days ago"


def _short_day(value: str) -> str:
    try:
        return datetime.fromisoformat(value).strftime("%b %d")
    except ValueError:
        return value


def _default_performance_trend() -> list[dict[str, Any]]:
    return [
        {"day": "Jun 06", "auc": 0.91, "f1": 0.84, "calibration": 0.07},
        {"day": "Jun 07", "auc": 0.92, "f1": 0.85, "calibration": 0.06},
        {"day": "Jun 08", "auc": 0.9, "f1": 0.83, "calibration": 0.08},
        {"day": "Jun 09", "auc": 0.93, "f1": 0.86, "calibration": 0.05},
        {"day": "Jun 10", "auc": 0.92, "f1": 0.85, "calibration": 0.06},
        {"day": "Jun 11", "auc": 0.91, "f1": 0.84, "calibration": 0.07},
        {"day": "Jun 12", "auc": 0.94, "f1": 0.87, "calibration": 0.05},
    ]


def _default_model_comparison() -> list[dict[str, Any]]:
    return [
        {"model": "XGBoost", "accuracy": 87, "auc": 93, "precision": 88, "recall": 86, "f1": 87},
        {"model": "Random Forest", "accuracy": 85, "auc": 91, "precision": 86, "recall": 84, "f1": 85},
        {"model": "Neural Network", "accuracy": 84, "auc": 90, "precision": 85, "recall": 83, "f1": 84},
        {"model": "Logistic Regression", "accuracy": 81, "auc": 86, "precision": 82, "recall": 81, "f1": 81},
    ]


def _default_drift_trend() -> list[dict[str, Any]]:
    return [
        {"day": "Jun 06", "bp": 0.08, "hr": 0.12, "cholesterol": 0.09},
        {"day": "Jun 07", "bp": 0.1, "hr": 0.15, "cholesterol": 0.1},
        {"day": "Jun 08", "bp": 0.11, "hr": 0.18, "cholesterol": 0.1},
        {"day": "Jun 09", "bp": 0.13, "hr": 0.2, "cholesterol": 0.11},
        {"day": "Jun 10", "bp": 0.15, "hr": 0.22, "cholesterol": 0.1},
        {"day": "Jun 11", "bp": 0.17, "hr": 0.23, "cholesterol": 0.12},
        {"day": "Jun 12", "bp": 0.18, "hr": 0.24, "cholesterol": 0.11},
    ]


def _default_error_trend() -> list[dict[str, Any]]:
    return [
        {"day": "Jun 06", "failed": 7, "resolved": 5},
        {"day": "Jun 07", "failed": 6, "resolved": 6},
        {"day": "Jun 08", "failed": 9, "resolved": 7},
        {"day": "Jun 09", "failed": 5, "resolved": 6},
        {"day": "Jun 10", "failed": 8, "resolved": 8},
        {"day": "Jun 11", "failed": 11, "resolved": 9},
        {"day": "Jun 12", "failed": 4, "resolved": 7},
    ]


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
