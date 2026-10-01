"""Framingham feature definitions shared by predictions, batch uploads and clinician workflows."""

from datetime import date, datetime
from typing import Any


FEATURE_SET = "framingham"

FEATURE_COLUMNS = [
    "sex",
    "age",
    "current_smoker",
    "cigs_per_day",
    "bp_meds",
    "prevalent_stroke",
    "prevalent_hyp",
    "diabetes",
    "tot_chol",
    "sys_bp",
    "dia_bp",
    "bmi",
    "heart_rate",
    "glucose",
]

# Stable patient history, stored on patient_cases. `age` is derived from date_of_birth.
HISTORY_FIELDS = [
    "sex",
    "current_smoker",
    "cigs_per_day",
    "bp_meds",
    "prevalent_stroke",
    "prevalent_hyp",
    "diabetes",
]

# Per-visit readings, stored on patient_measurements.
VITAL_FIELDS = ["sys_bp", "dia_bp", "heart_rate", "bmi"]
LAB_FIELDS = ["tot_chol", "glucose"]
MEASUREMENT_FIELDS = VITAL_FIELDS + LAB_FIELDS

# Readings older than this are flagged as stale when pre-filling an assessment.
STALE_AFTER_DAYS = {**{field: 90 for field in VITAL_FIELDS}, **{field: 365 for field in LAB_FIELDS}}

BINARY_FIELDS = {"sex", "current_smoker", "bp_meds", "prevalent_stroke", "prevalent_hyp", "diabetes"}

# Inclusive numeric ranges; must match server-ml's RiskPredictionRequest.
FEATURE_RANGES: dict[str, tuple[float, float]] = {
    "age": (18, 100),
    "cigs_per_day": (0, 100),
    "tot_chol": (80, 700),
    "sys_bp": (70, 300),
    "dia_bp": (40, 160),
    "bmi": (12, 70),
    "heart_rate": (30, 200),
    "glucose": (40, 500),
}

FEATURE_LABELS = {
    "sex": "Sex",
    "age": "Age",
    "current_smoker": "Current Smoker",
    "cigs_per_day": "Cigarettes per Day",
    "bp_meds": "On BP Medication",
    "prevalent_stroke": "Previous Stroke",
    "prevalent_hyp": "Hypertension",
    "diabetes": "Diabetes",
    "tot_chol": "Total Cholesterol",
    "sys_bp": "Systolic BP",
    "dia_bp": "Diastolic BP",
    "bmi": "BMI",
    "heart_rate": "Resting Heart Rate",
    "glucose": "Glucose",
}

# Training-set means, used as the drift baseline in admin monitoring.
TRAINING_MEANS = {
    "sys_bp": 132.4,
    "dia_bp": 82.9,
    "tot_chol": 236.7,
    "heart_rate": 75.9,
    "bmi": 25.8,
    "glucose": 82.0,
    "cigs_per_day": 9.0,
}


def validate_features(values: dict[str, Any]) -> list[str]:
    """Return human-readable errors for missing or out-of-range Framingham inputs."""
    missing = [feature for feature in FEATURE_COLUMNS if values.get(feature) in (None, "")]
    if missing:
        return [f"Missing required fields: {', '.join(missing)}"]

    errors = []
    for feature in FEATURE_COLUMNS:
        try:
            number = float(values[feature])
        except (TypeError, ValueError):
            errors.append(f"Invalid value for {feature}.")
            continue

        if feature in BINARY_FIELDS:
            if number not in (0, 1):
                errors.append(f"{feature} must be 0 or 1.")
            continue

        low, high = FEATURE_RANGES[feature]
        if not low <= number <= high:
            errors.append(f"{feature} must be between {low:g} and {high:g}.")

    if not errors and float(values["current_smoker"]) == 0 and float(values["cigs_per_day"]) > 0:
        errors.append("cigs_per_day must be 0 when current_smoker is 0.")
    return errors


def coerce_features(values: dict[str, Any]) -> dict[str, float | int]:
    """Cast validated inputs to the numeric types server-ml expects."""
    return {
        feature: int(float(values[feature])) if feature in BINARY_FIELDS or feature == "age" else float(values[feature])
        for feature in FEATURE_COLUMNS
    }


def age_on(date_of_birth: date | str | None, on: date | None = None) -> int | None:
    if not date_of_birth:
        return None
    born = date.fromisoformat(date_of_birth[:10]) if isinstance(date_of_birth, str) else date_of_birth
    today = on or date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def bmi_from(height_cm: float | None, weight_kg: float | None) -> float | None:
    if not height_cm or not weight_kg:
        return None
    return round(float(weight_kg) / (float(height_cm) / 100) ** 2, 1)


def days_since(value: datetime | str | None, now: datetime) -> int | None:
    if not value:
        return None
    moment = datetime.fromisoformat(value) if isinstance(value, str) else value
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=now.tzinfo)
    return (now - moment).days
