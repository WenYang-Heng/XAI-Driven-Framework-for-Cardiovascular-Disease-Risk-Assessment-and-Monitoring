import os
from typing import Any

import httpx
from fastapi import UploadFile

from app.models import BatchPredictionResponse, ModelMetricsResponse, PatientAssessmentPrediction, PatientAssessmentRequest, PredictionResponse


SERVER_ML_BASE_URL = os.getenv("SERVER_ML_BASE_URL", "http://localhost:8001").rstrip("/")


async def list_models() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{SERVER_ML_BASE_URL}/models")
        response.raise_for_status()
        data = response.json()
        return data.get("models", [])


async def get_model_metrics(model_name: str) -> ModelMetricsResponse:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(f"{SERVER_ML_BASE_URL}/models/{model_name}/metrics")
        response.raise_for_status()
        return ModelMetricsResponse(**response.json())


async def predict(payload: dict[str, Any]) -> PredictionResponse:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict", json=payload)
        response.raise_for_status()
        return PredictionResponse(**response.json())


async def predict_non_domain_patient_risk(request: PatientAssessmentRequest) -> PatientAssessmentPrediction:
    payload, locally_estimated, locally_missing = _non_domain_payload(request)
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict/non-domain", json=payload)
        response.raise_for_status()
        data = response.json()

    explanation = data.get("explanation", {})
    top_factors = explanation.get("top_factors", []) if isinstance(explanation, dict) else []
    explanation_messages = [
        factor.get("plain_language")
        for factor in top_factors
        if isinstance(factor, dict) and factor.get("plain_language")
    ]
    if not explanation_messages:
        explanation_messages = ["The non-domain ML model estimated your CVD risk from patient-friendly inputs."]
    explanation_messages.append(data.get("disclaimer", "This result is an estimate and is not a medical diagnosis."))

    estimated_inputs = {**data.get("estimated_inputs", {}), **locally_estimated}
    missing_inputs = sorted(set(data.get("missing_inputs", []) + locally_missing))
    confidence_level = data.get("confidence_level", "medium")
    if len(missing_inputs) >= 3:
        confidence_level = "low"
    elif missing_inputs and confidence_level == "high":
        confidence_level = "medium"

    return PatientAssessmentPrediction(
        risk_score=data["risk_score"],
        risk_level=data["risk_category"],
        confidence_level=confidence_level,
        prediction_method="non_domain_ml_model",
        estimated_inputs=estimated_inputs,
        missing_inputs=missing_inputs,
        explanation=explanation_messages,
    )


def _non_domain_payload(request: PatientAssessmentRequest) -> tuple[dict[str, Any], dict[str, float | None], list[str]]:
    estimated: dict[str, float | None] = {}
    missing: list[str] = []
    if request.height_cm is None:
        raise ValueError("height_cm is required for the non-domain ML model")
    if request.weight is None:
        raise ValueError("weight is required for the non-domain ML model")

    systolic_bp = request.systolic_bp
    if systolic_bp is None and request.bp_category:
        systolic_bp = _bp_category_value(request.bp_category)
        estimated["systolic_bp"] = systolic_bp
        missing.append("blood_pressure")
    if systolic_bp is None:
        raise ValueError("blood pressure is required for the non-domain ML model")

    diastolic_bp = request.diastolic_bp
    if diastolic_bp is None:
        diastolic_bp = max(40.0, min(140.0, systolic_bp * 0.65))
        estimated["diastolic_bp"] = round(diastolic_bp, 1)
        missing.append("diastolic_bp")

    return (
        {
            "age": request.age,
            "sex": request.sex,
            "height_cm": request.height_cm,
            "weight_kg": request.weight,
            "systolic_bp": systolic_bp,
            "diastolic_bp": diastolic_bp,
            "cholesterol_category": _cholesterol_category(request),
            "glucose_category": _glucose_category(request),
            "smoking_status": "yes" if request.smoking_status == "yes" else "no",
            "physical_activity": "no" if request.activity_level == "low" else "yes",
            "alcohol_intake": request.alcohol_intake,
        },
        estimated,
        missing,
    )


def _bp_category_value(category: str) -> float:
    return {
        "normal": 115.0,
        "above_normal": 135.0,
        "well_above_normal": 155.0,
    }[category]


def _cholesterol_category(request: PatientAssessmentRequest) -> str:
    if request.cholesterol_input_type == "exact" and request.total_cholesterol is not None:
        if request.total_cholesterol >= 240:
            return "well_above_normal"
        if request.total_cholesterol >= 200:
            return "above_normal"
        return "normal"
    if request.cholesterol_input_type == "category" and request.cholesterol_category:
        return request.cholesterol_category
    return "unknown"


def _glucose_category(request: PatientAssessmentRequest) -> str:
    if request.glucose_category != "unknown":
        return request.glucose_category
    return {
        "no": "normal",
        "prediabetes": "above_normal",
        "yes": "well_above_normal",
        "unsure": "unknown",
    }[request.diabetes_history]


async def predict_batch(file: UploadFile, model_name: str) -> BatchPredictionResponse:
    content = await file.read()
    await file.seek(0)
    files = {"file": (file.filename or "upload.csv", content, file.content_type or "application/octet-stream")}
    data = {"model_name": model_name}

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict/batch", data=data, files=files)
        response.raise_for_status()
        return BatchPredictionResponse(**response.json())


async def predict_batch_bytes(
    content: bytes,
    file_name: str,
    content_type: str,
    model_name: str,
) -> BatchPredictionResponse:
    files = {"file": (file_name or "upload.csv", content, content_type or "application/octet-stream")}
    data = {"model_name": model_name}

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict/batch", data=data, files=files)
        response.raise_for_status()
        return BatchPredictionResponse(**response.json())
