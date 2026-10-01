"""Patient-centred clinician workflow: profiles, measurements, pre-filled assessments, review and sign-off.

Mirrors storage.py: Postgres when DATABASE_URL is set, in-memory lists otherwise.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import httpx

from app.features import (
    FEATURE_COLUMNS,
    HISTORY_FIELDS,
    MEASUREMENT_FIELDS,
    STALE_AFTER_DAYS,
    age_on,
    bmi_from,
    coerce_features,
    days_since,
    validate_features,
)
from app.services import ml_client, storage
from app.services.database import database_enabled, get_connection


DEFAULT_MODEL_FALLBACK = "logistic_regression"
MODEL_DISPLAY_NAMES = {
    "logistic_regression": "Logistic Regression",
    "random_forest": "Random Forest",
    "xgboost": "XGBoost",
    "neural_network": "Neural Network",
}

_measurements: list[dict[str, Any]] = []
_memory_default_model = DEFAULT_MODEL_FALLBACK


class NotFoundError(Exception):
    pass


class ConflictError(Exception):
    pass


class ValidationFailedError(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


# =========================
# DEFAULT MODEL (admin)
# =========================
def default_model_name() -> str:
    if database_enabled():
        rows = storage._query_database(
            "select model_name from public.ml_models where is_default and coalesce(is_active, true) limit 1"
        )
        return rows[0]["model_name"] if rows else DEFAULT_MODEL_FALLBACK
    return _memory_default_model


def list_models() -> list[dict[str, Any]]:
    if database_enabled():
        return storage._query_database(
            """
            select model_name, display_name, model_version, dataset_name, is_active, is_default,
                   auc_roc, brier_score, metrics_updated_at
            from public.ml_models
            order by is_default desc, model_name
            """
        )
    return [
        {
            "model_name": name,
            "display_name": display_name,
            "model_version": f"framingham-chd10-{name}",
            "dataset_name": "Framingham Heart Study",
            "is_active": True,
            "is_default": name == _memory_default_model,
        }
        for name, display_name in MODEL_DISPLAY_NAMES.items()
    ]


async def set_default_model(model_name: str, admin_id: str | None) -> dict[str, Any]:
    global _memory_default_model

    if database_enabled():
        with get_connection() as connection:
            with connection.cursor() as cursor:
                # Clear first: a partial unique index allows only one default.
                cursor.execute(
                    "update public.ml_models set is_default = false where is_default and model_name <> %(name)s",
                    {"name": model_name},
                )
                cursor.execute(
                    """
                    update public.ml_models set is_default = true
                    where model_name = %(name)s and coalesce(is_active, true)
                    returning model_name
                    """,
                    {"name": model_name},
                )
                if cursor.fetchone() is None:
                    connection.rollback()
                    raise NotFoundError(f"Model {model_name} does not exist or is not active.")
    else:
        _memory_default_model = model_name

    await storage.log_activity(admin_id, "SET_DEFAULT_MODEL", "ml_models", None)
    return next(model for model in list_models() if model["model_name"] == model_name)


# =========================
# PATIENT PROFILES
# =========================
def _history_sources(values: dict[str, Any], source: str, existing: dict[str, Any] | None = None) -> dict[str, Any]:
    sources = dict(existing or {})
    stamp = storage._now()
    for field, value in values.items():
        if value is not None:
            sources[field] = {"source": source, "updated_at": stamp}
    return sources


def _can_access(patient: dict[str, Any], clinician_id: str | None) -> bool:
    if not clinician_id:
        return True
    owners = {patient.get("assigned_clinician_id"), patient.get("created_by")}
    return clinician_id in owners or owners == {None}


def get_patient(patient_case_id: str, clinician_id: str | None = None) -> dict[str, Any]:
    if database_enabled():
        rows = storage._query_database(
            "select * from public.patient_cases where patient_case_id = %(id)s limit 1",
            {"id": patient_case_id},
        )
        patient = rows[0] if rows else None
    else:
        patient = next((case for case in storage._patient_cases if case["patient_case_id"] == patient_case_id), None)

    if not patient or not _can_access(patient, clinician_id):
        raise NotFoundError("Patient not found.")
    return patient


async def create_patient(payload: dict[str, Any]) -> dict[str, Any]:
    clinician_id = payload["clinician_id"]
    await storage.ensure_user_profile(clinician_id)
    reference = storage._normalise_patient_reference(payload.get("patient_reference_id"))
    if any(
        case["patient_reference_id"].lower() == reference.lower()
        for case in storage.search_patient_cases(patient_reference_id=reference)
    ):
        raise ConflictError(f"Patient reference {reference} already exists.")

    history = {field: payload.get(field) for field in HISTORY_FIELDS}
    record = {
        "patient_reference_id": reference,
        "created_by": clinician_id,
        "assigned_clinician_id": clinician_id,
        "case_status": "active",
        "display_name": payload.get("display_name"),
        "date_of_birth": payload.get("date_of_birth"),
        **history,
        "history_sources": _history_sources(history, payload.get("history_source", "clinician")),
        "created_at": storage._now(),
        "updated_at": storage._now(),
    }

    if database_enabled():
        patient = await storage._insert("patient_cases", record)
    else:
        patient = {"patient_case_id": str(uuid4()), **record}
        storage._patient_cases.append(patient)

    await storage.log_activity(clinician_id, "CREATE_PATIENT_PROFILE", "patient_cases", patient["patient_case_id"])
    return patient


async def update_patient(patient_case_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    clinician_id = payload["clinician_id"]
    patient = get_patient(patient_case_id, clinician_id)
    history = {field: payload.get(field) for field in HISTORY_FIELDS if payload.get(field) is not None}
    changes: dict[str, Any] = {
        **history,
        **{field: payload[field] for field in ("display_name", "date_of_birth", "case_status") if payload.get(field) is not None},
    }
    if not changes:
        return patient

    changes["history_sources"] = _history_sources(
        history,
        payload.get("history_source", "clinician"),
        patient.get("history_sources"),
    )
    changes["updated_at"] = storage._now()

    if database_enabled():
        storage._update_database("patient_cases", "patient_case_id", patient_case_id, changes)
    else:
        patient.update(changes)

    await storage.log_activity(clinician_id, "UPDATE_PATIENT_PROFILE", "patient_cases", patient_case_id)
    return get_patient(patient_case_id)


def list_patients(clinician_id: str, query: str | None = None) -> list[dict[str, Any]]:
    if database_enabled():
        params: dict[str, Any] = {"clinician_id": clinician_id}
        search = ""
        if query:
            search = "and (pc.patient_reference_id ilike %(query)s or pc.display_name ilike %(query)s)"
            params["query"] = f"%{query.strip()}%"
        return storage._query_database(
            f"""
            select
              pc.*,
              latest.result_id as latest_result_id,
              latest.risk_score as latest_risk_score,
              latest.risk_level as latest_risk_level,
              latest.created_at as latest_assessed_at,
              latest.review_status as latest_review_status
            from public.patient_cases pc
            left join lateral (
              select
                pr.result_id, pr.risk_score, pr.risk_level, pr.created_at,
                coalesce(
                  (select def.review_status from public.domain_expert_feedback def
                   where def.result_id = pr.result_id order by def.created_at desc limit 1),
                  'unreviewed'
                ) as review_status
              from public.prediction_requests req
              join public.prediction_results pr on pr.request_id = req.request_id
              where req.patient_case_id = pc.patient_case_id
              order by pr.created_at desc
              limit 1
            ) latest on true
            where (pc.assigned_clinician_id = %(clinician_id)s or pc.created_by = %(clinician_id)s)
              and pc.case_status = 'active'
              {search}
            order by coalesce(latest.created_at, pc.updated_at) desc
            limit 100
            """,
            params,
        )

    patients = [
        case
        for case in storage._patient_cases
        if clinician_id in (case.get("assigned_clinician_id"), case.get("created_by"))
        and case.get("case_status", "active") == "active"
    ]
    if query:
        needle = query.strip().lower()
        patients = [
            case
            for case in patients
            if needle in case["patient_reference_id"].lower() or needle in (case.get("display_name") or "").lower()
        ]

    rows = []
    for patient in patients:
        latest = next(iter(_memory_assessments(patient["patient_case_id"])), None)
        rows.append(
            {
                **patient,
                "latest_result_id": latest["result_id"] if latest else None,
                "latest_risk_score": latest["risk_score"] if latest else None,
                "latest_risk_level": latest["risk_level"] if latest else None,
                "latest_assessed_at": latest["assessed_at"] if latest else None,
                "latest_review_status": latest["review_status"] if latest else None,
            }
        )
    return sorted(rows, key=lambda row: row["latest_assessed_at"] or row.get("updated_at") or "", reverse=True)


# =========================
# MEASUREMENTS
# =========================
async def add_measurement(patient_case_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    readings = {field: payload.get(field) for field in [*MEASUREMENT_FIELDS, "height_cm", "weight_kg"]}
    if readings["bmi"] is None:
        readings["bmi"] = bmi_from(readings["height_cm"], readings["weight_kg"])
    if all(value is None for value in readings.values()):
        return None

    record = {
        "patient_case_id": patient_case_id,
        "measured_at": payload.get("measured_at") or storage._now(),
        **readings,
        "source": payload.get("source", "clinician"),
        "recorded_by": payload.get("recorded_by"),
        "notes": payload.get("notes"),
        "created_at": storage._now(),
    }

    if database_enabled():
        measurement = await storage._insert("patient_measurements", record)
    else:
        measurement = {"measurement_id": str(uuid4()), **record}
        _measurements.append(measurement)

    await storage.log_activity(payload.get("recorded_by"), "RECORD_MEASUREMENT", "patient_measurements", measurement["measurement_id"])
    return measurement


def list_measurements(patient_case_id: str) -> list[dict[str, Any]]:
    if database_enabled():
        return storage._query_database(
            """
            select * from public.patient_measurements
            where patient_case_id = %(id)s
            order by measured_at desc
            """,
            {"id": patient_case_id},
        )
    rows = [row for row in _measurements if row["patient_case_id"] == patient_case_id]
    return sorted(rows, key=lambda row: row["measured_at"], reverse=True)


# =========================
# PRE-FILL
# =========================
def prefill(patient_case_id: str, clinician_id: str | None = None) -> dict[str, Any]:
    """Assemble every model input from the profile and latest readings, with provenance and staleness."""
    patient = get_patient(patient_case_id, clinician_id)
    now = datetime.now(UTC)
    sources = patient.get("history_sources") or {}
    fields: dict[str, dict[str, Any]] = {}

    age = age_on(patient.get("date_of_birth"))
    fields["age"] = {
        "value": age,
        "source": "date_of_birth" if age is not None else None,
        "recorded_at": None,
        "days_old": None,
        "stale": False,
    }

    for field in HISTORY_FIELDS:
        value = patient.get(field)
        # A non-smoker smokes 0 cigarettes per day even if the count was never entered.
        if field == "cigs_per_day" and value is None and patient.get("current_smoker") == 0:
            value = 0
        source = sources.get(field, {})
        fields[field] = {
            "value": value,
            "source": source.get("source"),
            "recorded_at": source.get("updated_at"),
            "days_old": days_since(source.get("updated_at"), now),
            "stale": False,
        }

    measurements = list_measurements(patient_case_id)
    for field in MEASUREMENT_FIELDS:
        latest = next((row for row in measurements if row.get(field) is not None), None)
        days_old = days_since(latest["measured_at"], now) if latest else None
        fields[field] = {
            "value": latest[field] if latest else None,
            "source": latest["source"] if latest else None,
            "recorded_at": latest["measured_at"] if latest else None,
            "days_old": days_old,
            "stale": days_old is not None and days_old > STALE_AFTER_DAYS[field],
        }

    ordered = {feature: fields[feature] for feature in FEATURE_COLUMNS}
    missing = [feature for feature, item in ordered.items() if item["value"] is None]
    return {
        "patient_case_id": patient_case_id,
        "fields": ordered,
        "missing": missing,
        "stale": [feature for feature, item in ordered.items() if item["stale"]],
        "ready": not missing,
    }


# =========================
# ASSESSMENT
# =========================
async def run_assessment(patient_case_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    clinician_id = payload["clinician_id"]
    patient = get_patient(patient_case_id, clinician_id)

    history = {field: value for field, value in (payload.get("history") or {}).items() if value is not None}
    if history:
        await update_patient(
            patient_case_id,
            {"clinician_id": clinician_id, **history, "history_source": "clinician_verified"},
        )

    measurement = None
    if payload.get("measurement"):
        measurement = await add_measurement(
            patient_case_id,
            {**payload["measurement"], "recorded_by": payload["measurement"].get("recorded_by") or clinician_id},
        )

    inputs = prefill(patient_case_id, clinician_id)
    values = {feature: item["value"] for feature, item in inputs["fields"].items()}
    errors = validate_features(values)
    if errors:
        raise ValidationFailedError(errors)

    features = coerce_features(values)
    model_name = payload.get("model_name") or default_model_name()
    prediction = (await ml_client.predict({**features, "model_name": model_name})).model_dump(mode="json")
    agreement = await _model_agreement(features, model_name)

    input_sources = {
        feature: {key: item[key] for key in ("source", "recorded_at", "stale")}
        for feature, item in inputs["fields"].items()
    }
    request_id, result_id, _, patient_reference_id = await storage.save_prediction(
        {
            **features,
            "user_id": clinician_id,
            "model_name": model_name,
            "patient_reference_id": patient["patient_reference_id"],
            "visit_label": payload.get("visit_label"),
        },
        prediction,
        input_sources=input_sources,
        measurement_id=measurement["measurement_id"] if measurement else None,
    )

    return {
        "request_id": request_id,
        "result_id": result_id,
        "patient_case_id": patient_case_id,
        "patient_reference_id": patient_reference_id,
        "model_name": model_name,
        "prediction": prediction,
        "model_agreement": agreement,
        "inputs": inputs,
    }


async def _model_agreement(features: dict[str, Any], model_name: str) -> dict[str, Any]:
    try:
        scores = await ml_client.predict_scores(features)
    except httpx.HTTPError:
        return {"available": False, "scores": [], "spread": None, "agrees": None, "message": None}

    if not scores:
        return {"available": False, "scores": [], "spread": None, "agrees": None, "message": None}

    values = [score["risk_score"] for score in scores]
    spread = round(max(values) - min(values), 4)
    levels = {score["risk_level"] for score in scores}
    # The risk band drives the clinical action, so only a band disagreement is flagged;
    # within-band spread is reported but expected (models diverge most at high risk).
    agrees = len(levels) == 1
    message = None
    if not agrees:
        message = (
            f"Models disagree: scores range from {min(values):.0%} to {max(values):.0%}"
            f" across the {', '.join(sorted(levels))} risk bands. Review the inputs and drivers carefully."
        )
    return {
        "available": True,
        "scores": [{**score, "is_selected": score["model_name"] == model_name} for score in scores],
        "spread": spread,
        "agrees": agrees,
        "message": message,
    }


def get_assessment(result_id: str, clinician_id: str | None = None) -> dict[str, Any]:
    if database_enabled():
        rows = storage._query_database(
            """
            select
              pr.result_id, pr.request_id, pr.model_name, pr.model_version, pr.risk_score,
              pr.predicted_class, pr.risk_level, pr.explanation, pr.xai, pr.created_at as assessed_at,
              req.patient_case_id, req.input_features, req.input_sources, req.visit_label, req.feature_set,
              req.measurement_id
            from public.prediction_results pr
            join public.prediction_requests req on req.request_id = pr.request_id
            where pr.result_id = %(result_id)s
            limit 1
            """,
            {"result_id": result_id},
        )
        assessment = rows[0] if rows else None
    else:
        assessment = next((row for row in _memory_assessment_rows() if row["result_id"] == result_id), None)

    if not assessment:
        raise NotFoundError("Assessment not found.")

    patient = get_patient(assessment["patient_case_id"], clinician_id) if assessment.get("patient_case_id") else None
    reviews = storage.feedback_for_result(result_id)
    own_review = next((review for review in reviews if review.get("expert_id") == clinician_id), None) if clinician_id else None
    return {**assessment, "patient": patient, "reviews": reviews, "my_review": own_review}


# =========================
# REVIEW + SIGN-OFF
# =========================
async def review_assessment(result_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    clinician_id = payload["clinician_id"]
    get_assessment(result_id, clinician_id)

    unknown = [feature for feature in payload.get("flagged_features", []) if feature not in FEATURE_COLUMNS]
    if unknown:
        raise ValidationFailedError([f"Unknown flagged feature: {feature}" for feature in unknown])
    if payload.get("sign_off") and not payload.get("clinical_action"):
        raise ValidationFailedError(["Choose the clinical action taken before signing off."])

    existing = next(
        (review for review in storage.feedback_for_result(result_id) if review.get("expert_id") == clinician_id),
        None,
    )
    if existing and existing.get("review_status") == "signed_off":
        raise ConflictError("This assessment is already signed off and can no longer be edited.")

    now = storage._now()
    record = {
        "clinician_risk_level": payload.get("clinician_risk_level"),
        "agreement_level": payload.get("agreement_level"),
        "is_clinically_acceptable": payload.get("is_clinically_acceptable"),
        "confidence_level": payload.get("confidence_level"),
        "flagged_features": payload.get("flagged_features", []),
        "clinical_action": payload.get("clinical_action"),
        "feedback_comment": payload.get("feedback_comment"),
        "use_for_future_retraining": payload.get("use_for_future_retraining", False),
        "review_status": "signed_off" if payload.get("sign_off") else "draft",
        "signed_off_at": now if payload.get("sign_off") else None,
        "updated_at": now,
    }

    if existing:
        if database_enabled():
            storage._update_database("domain_expert_feedback", "feedback_id", existing["feedback_id"], record)
        else:
            existing.update(record)
        review = {**existing, **record}
    else:
        await storage.ensure_user_profile(clinician_id)
        review = {"result_id": result_id, "expert_id": clinician_id, **record, "created_at": now}
        if database_enabled():
            review = await storage._insert("domain_expert_feedback", review)
        else:
            review = {"feedback_id": str(uuid4()), **review}
            storage._feedback.append(review)

    action = "SIGN_OFF_ASSESSMENT" if payload.get("sign_off") else "SAVE_ASSESSMENT_REVIEW"
    await storage.log_activity(clinician_id, action, "prediction_results", result_id)
    return review


# =========================
# TIMELINE + WORKLIST
# =========================
_ASSESSMENT_LIST_COLUMNS = """
  pr.result_id, pr.model_name, pr.risk_score, pr.risk_level, pr.created_at as assessed_at,
  req.patient_case_id, req.visit_label, req.input_features,
  pc.patient_reference_id, pc.display_name,
  coalesce(def.review_status, 'unreviewed') as review_status,
  def.clinical_action, def.clinician_risk_level, def.signed_off_at
"""


def patient_timeline(patient_case_id: str, clinician_id: str | None = None) -> list[dict[str, Any]]:
    get_patient(patient_case_id, clinician_id)
    if database_enabled():
        return storage._query_database(
            f"""
            select {_ASSESSMENT_LIST_COLUMNS}
            from public.prediction_requests req
            join public.prediction_results pr on pr.request_id = req.request_id
            join public.patient_cases pc on pc.patient_case_id = req.patient_case_id
            left join lateral (
              select * from public.domain_expert_feedback d
              where d.result_id = pr.result_id
              order by d.created_at desc limit 1
            ) def on true
            where req.patient_case_id = %(id)s
            order by pr.created_at desc
            """,
            {"id": patient_case_id},
        )
    return _memory_assessments(patient_case_id)


def worklist(clinician_id: str) -> dict[str, Any]:
    if database_enabled():
        base = f"""
            select {_ASSESSMENT_LIST_COLUMNS}
            from public.prediction_results pr
            join public.prediction_requests req on req.request_id = pr.request_id
            join public.patient_cases pc on pc.patient_case_id = req.patient_case_id
            left join lateral (
              select * from public.domain_expert_feedback d
              where d.result_id = pr.result_id and d.expert_id = %(clinician_id)s
              order by d.created_at desc limit 1
            ) def on true
            where req.feature_set = 'framingham'
              and (pc.assigned_clinician_id = %(clinician_id)s or pr.user_id = %(clinician_id)s)
        """
        params = {"clinician_id": clinician_id}
        needs_review = storage._query_database(
            base + " and def.feedback_id is null order by pr.risk_score desc, pr.created_at desc limit 50", params
        )
        drafts = storage._query_database(
            base + " and def.review_status = 'draft' order by def.updated_at desc limit 50", params
        )
        signed_off = storage._query_database(
            base + " and def.review_status = 'signed_off' order by def.signed_off_at desc limit 10", params
        )
    else:
        rows = [
            row
            for row in _memory_assessment_rows(clinician_id)
            if clinician_id in (row.get("assigned_clinician_id"), row.get("user_id"))
        ]
        needs_review = sorted(
            [row for row in rows if row["review_status"] == "unreviewed"],
            key=lambda row: (row["risk_score"], row["assessed_at"]),
            reverse=True,
        )
        drafts = [row for row in rows if row["review_status"] == "draft"]
        signed_off = sorted(
            [row for row in rows if row["review_status"] == "signed_off"],
            key=lambda row: row.get("signed_off_at") or "",
            reverse=True,
        )[:10]

    return {
        "counts": {
            "needs_review": len(needs_review),
            "high_risk_unreviewed": sum(1 for row in needs_review if row["risk_level"] == "high"),
            "drafts": len(drafts),
        },
        "needs_review": needs_review,
        "drafts": drafts,
        "recently_signed_off": signed_off,
    }


def _memory_assessment_rows(clinician_id: str | None = None) -> list[dict[str, Any]]:
    patients = {case["patient_case_id"]: case for case in storage._patient_cases}
    requests = {request["request_id"]: request for request in storage._requests}
    rows = []
    for result in storage._results:
        request = requests.get(result["request_id"])
        if not request:
            continue
        patient = patients.get(request.get("patient_case_id"), {})
        reviews = [item for item in storage._feedback if item["result_id"] == result["result_id"]]
        if clinician_id:
            reviews = [item for item in reviews if item.get("expert_id") == clinician_id]
        review = max(reviews, key=lambda item: item.get("created_at") or "", default={})
        rows.append(
            {
                "result_id": result["result_id"],
                "request_id": result["request_id"],
                "model_name": result["model_name"],
                "model_version": result.get("model_version"),
                "risk_score": result["risk_score"],
                "predicted_class": result.get("predicted_class"),
                "risk_level": result["risk_level"],
                "explanation": result.get("explanation"),
                "xai": result.get("xai"),
                "assessed_at": result["created_at"],
                "user_id": result.get("user_id"),
                "patient_case_id": request.get("patient_case_id"),
                "visit_label": request.get("visit_label"),
                "feature_set": request.get("feature_set"),
                "input_features": request.get("input_features"),
                "input_sources": request.get("input_sources"),
                "measurement_id": request.get("measurement_id"),
                "patient_reference_id": patient.get("patient_reference_id"),
                "display_name": patient.get("display_name"),
                "assigned_clinician_id": patient.get("assigned_clinician_id"),
                "review_status": review.get("review_status", "unreviewed"),
                "clinical_action": review.get("clinical_action"),
                "clinician_risk_level": review.get("clinician_risk_level"),
                "signed_off_at": review.get("signed_off_at"),
            }
        )
    return rows


def _memory_assessments(patient_case_id: str) -> list[dict[str, Any]]:
    rows = [row for row in _memory_assessment_rows() if row["patient_case_id"] == patient_case_id]
    return sorted(rows, key=lambda row: row["assessed_at"], reverse=True)

