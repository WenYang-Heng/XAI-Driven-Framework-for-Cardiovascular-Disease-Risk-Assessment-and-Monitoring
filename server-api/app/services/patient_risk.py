from app.models import PatientAssessmentPrediction, PatientAssessmentRequest, PatientSimulationRequest


BP_CATEGORY_VALUES = {
    "normal": 115.0,
    "above_normal": 135.0,
    "well_above_normal": 155.0,
}

CHOLESTEROL_CATEGORY_VALUES = {
    "normal": 170.0,
    "above_normal": 220.0,
    "well_above_normal": 260.0,
}


def predict_patient_risk(request: PatientAssessmentRequest) -> PatientAssessmentPrediction:
    systolic_bp, bp_missing, bp_estimated = _resolve_bp(request)
    cholesterol, cholesterol_missing, cholesterol_estimated = _resolve_cholesterol(request)

    missing_inputs = []
    if bp_missing:
        missing_inputs.append("blood_pressure")
    if cholesterol_missing:
        missing_inputs.append("cholesterol")
    if request.diabetes_history == "unsure":
        missing_inputs.append("diabetes_history")
    if request.weight_category == "unsure" and request.weight is None:
        missing_inputs.append("weight_status")

    points = 0.0
    points += max(0.0, (request.age - 35) * 0.08)
    points += 0.9 if request.sex == "male" else 0.35
    points += max(0.0, (systolic_bp - 115) * 0.055)
    points += max(0.0, (cholesterol - 170) * 0.018)
    points += _diabetes_points(request.diabetes_history)
    points += _smoking_points(request.smoking_status)
    points += _activity_points(request.activity_level)
    points += _weight_points(request.weight_category, request.weight)

    risk_score = round(min(0.95, max(0.03, points / 16)), 4)
    risk_level = _risk_level(risk_score)
    confidence_level = _confidence_level(request, missing_inputs)
    explanation = _explanation(
        request,
        risk_level,
        systolic_bp,
        cholesterol,
        bp_estimated,
        cholesterol_estimated,
        missing_inputs,
    )

    return PatientAssessmentPrediction(
        risk_score=risk_score,
        risk_level=risk_level,
        confidence_level=confidence_level,
        prediction_method="framingham_ascvd_inspired_screening_v1",
        estimated_inputs={
            "systolic_bp": round(systolic_bp, 1),
            "total_cholesterol": round(cholesterol, 1),
        },
        missing_inputs=missing_inputs,
        explanation=explanation,
    )


def simulate_patient_risk(request: PatientSimulationRequest) -> PatientAssessmentPrediction:
    payload = request.model_dump()

    if request.target_bp is not None:
        payload["bp_input_type"] = "exact"
        payload["systolic_bp"] = request.target_bp
        payload["bp_category"] = None

    if request.target_cholesterol is not None:
        payload["cholesterol_input_type"] = "exact"
        payload["total_cholesterol"] = request.target_cholesterol
        payload["cholesterol_category"] = None

    if request.nicotine_exposure is not None and request.nicotine_exposure <= 5:
        payload["smoking_status"] = "no"

    if request.activity_minutes is not None:
        if request.activity_minutes >= 150:
            payload["activity_level"] = "high"
        elif request.activity_minutes >= 60:
            payload["activity_level"] = "medium"
        else:
            payload["activity_level"] = "low"

    if request.weight_change is not None and request.weight_category != "healthy":
        if request.weight_change <= -7:
            payload["weight_category"] = "healthy"
        elif request.weight_change <= -3:
            payload["weight_category"] = "overweight"

    prediction = predict_patient_risk(PatientAssessmentRequest(**payload))
    prediction.prediction_method = "framingham_ascvd_inspired_lifestyle_simulation_v1"
    prediction.explanation = [
        "This is a projected scenario based on changed lifestyle or target values, not a new clinical measurement.",
        *prediction.explanation,
    ]
    return prediction


def _resolve_bp(request: PatientAssessmentRequest) -> tuple[float, bool, bool]:
    if request.bp_input_type == "exact" and request.systolic_bp is not None:
        return request.systolic_bp, False, False
    if request.bp_input_type == "category" and request.bp_category:
        return BP_CATEGORY_VALUES[request.bp_category], False, True
    return 125.0, True, True


def _resolve_cholesterol(request: PatientAssessmentRequest) -> tuple[float, bool, bool]:
    if request.cholesterol_input_type == "exact" and request.total_cholesterol is not None:
        return request.total_cholesterol, False, False
    if request.cholesterol_input_type == "category" and request.cholesterol_category:
        return CHOLESTEROL_CATEGORY_VALUES[request.cholesterol_category], False, True
    return 200.0, True, True


def _diabetes_points(value: str) -> float:
    return {
        "no": 0.0,
        "prediabetes": 1.1,
        "yes": 2.2,
        "unsure": 0.6,
    }[value]


def _smoking_points(value: str) -> float:
    return {
        "no": 0.0,
        "yes": 2.4,
    }[value]


def _activity_points(value: str) -> float:
    return {
        "high": 0.0,
        "medium": 0.7,
        "low": 1.6,
    }[value]


def _weight_points(category: str, weight: float | None) -> float:
    if category == "healthy":
        return 0.0
    if category == "overweight":
        return 0.8
    if category == "obese":
        return 1.6
    if weight is not None and weight >= 90:
        return 0.8
    return 0.3


def _risk_level(score: float) -> str:
    if score >= 0.55:
        return "high"
    if score >= 0.25:
        return "moderate"
    return "low"


def _confidence_level(request: PatientAssessmentRequest, missing_inputs: list[str]) -> str:
    exact_count = sum(
        [
            request.bp_input_type == "exact",
            request.cholesterol_input_type == "exact",
            request.diabetes_history != "unsure",
            request.weight_category != "unsure" or request.weight is not None,
        ]
    )
    if len(missing_inputs) >= 3:
        return "low"
    if exact_count >= 3 and not missing_inputs:
        return "high"
    return "medium"


def _explanation(
    request: PatientAssessmentRequest,
    risk_level: str,
    systolic_bp: float,
    cholesterol: float,
    bp_estimated: bool,
    cholesterol_estimated: bool,
    missing_inputs: list[str],
) -> list[str]:
    messages = [f"The assessment estimates a {risk_level} cardiovascular risk level from patient-friendly inputs."]

    if systolic_bp >= 140:
        messages.append("Blood pressure is a major contributor in this estimate.")
    elif systolic_bp >= 130:
        messages.append("Blood pressure is slightly above the usual healthy range.")

    if cholesterol >= 240:
        messages.append("Cholesterol is a major contributor in this estimate.")
    elif cholesterol >= 200:
        messages.append("Cholesterol is above the usual healthy range.")

    if request.smoking_status == "yes":
        messages.append("Current smoking increases the estimated risk.")
    if request.diabetes_history in ("prediabetes", "yes"):
        messages.append("Diabetes or prediabetes history increases the estimated risk.")
    if request.activity_level == "low":
        messages.append("Low activity level is treated as a modifiable risk factor.")

    if bp_estimated:
        messages.append("Blood pressure was estimated from a category or fallback value.")
    if cholesterol_estimated:
        messages.append("Cholesterol was estimated from a category or fallback value.")
    if missing_inputs:
        messages.append("Missing or uncertain inputs lower confidence in this estimate.")

    messages.append("This screening estimate supports health awareness and is not a medical diagnosis.")
    return messages
