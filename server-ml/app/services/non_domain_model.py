from __future__ import annotations

import json
import pickle
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover - optional dependency guard
    XGBClassifier = None  # type: ignore[assignment]

try:
    import shap
except Exception:  # pragma: no cover - optional dependency guard
    shap = None  # type: ignore[assignment]

from app.schemas import NonDomainPredictionRequest, NonDomainPredictionResponse
from app.services.non_domain_dataset import DATASET_NAME, load_cardio_dataset


APP_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = APP_DIR / "models"
MODEL_PATH = MODEL_DIR / "non_domain_cvd_model.pkl"
METADATA_PATH = MODEL_DIR / "non_domain_cvd_metadata.json"
COMPARISON_PATH = MODEL_DIR / "non_domain_model_comparison.json"

MODEL_VERSION = "non-domain-kaggle-cvd-v1"
DISCLAIMER = "This result is an estimate and is not a medical diagnosis."
FEATURE_LABELS = {
    "age_years": "Age",
    "gender": "Sex",
    "bmi": "Weight category / BMI",
    "ap_hi": "Systolic blood pressure",
    "ap_lo": "Diastolic blood pressure",
    "cholesterol": "Cholesterol level",
    "gluc": "Blood sugar level",
    "smoke": "Smoking status",
    "active": "Physical activity",
    "alco": "Alcohol intake",
}


def _build_models() -> dict[str, Pipeline]:
    models = {
        "Logistic Regression": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)),
            ]
        ),
        "Random Forest": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("classifier", RandomForestClassifier(n_estimators=300, random_state=42, class_weight="balanced")),
            ]
        ),
        "Gradient Boosting": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("classifier", GradientBoostingClassifier(random_state=42)),
            ]
        ),
    }
    if XGBClassifier is not None:
        models["XGBoost"] = Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    XGBClassifier(
                        n_estimators=220,
                        max_depth=3,
                        learning_rate=0.05,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        eval_metric="logloss",
                        random_state=42,
                    ),
                ),
            ]
        )
    return models


def train_and_compare_non_domain_models() -> dict[str, Any]:
    features, target, dataset_metadata = load_cardio_dataset()
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
        stratify=target,
    )

    compared: dict[str, dict[str, Any]] = {}
    fitted_models: dict[str, Pipeline] = {}
    for name, pipeline in _build_models().items():
        pipeline.fit(x_train, y_train)
        probabilities = pipeline.predict_proba(x_test)[:, 1]
        predictions = (probabilities >= 0.5).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_test, predictions).ravel()
        compared[name] = {
            "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
            "confusion_matrix": {
                "true_negative": int(tn),
                "false_positive": int(fp),
                "false_negative": int(fn),
                "true_positive": int(tp),
            },
        }
        fitted_models[name] = pipeline

    selected_name = _select_best_model(compared)
    selected_pipeline = fitted_models[selected_name]
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with MODEL_PATH.open("wb") as file:
        pickle.dump(selected_pipeline, file)

    metadata = {
        **dataset_metadata,
        "training_date": datetime.now(UTC).isoformat(),
        "selected_model_name": selected_name,
        "selected_model_path": str(MODEL_PATH),
        "model_version": MODEL_VERSION,
        "model_performance": compared[selected_name],
        "all_compared_model_metrics": compared,
        "target_definition": "cardio = 1 indicates cardiovascular disease in the Kaggle dataset.",
        "risk_thresholds": {"low": "<0.10", "moderate": "0.10 to <0.20", "high": ">=0.20"},
        "threshold_note": "TODO: Calibrate prototype risk thresholds against clinical target probabilities before production use.",
        "explanation_method": "SHAP when available; feature importance or coefficients as fallback.",
        "limitations": [
            "The model is used for educational risk estimation in a prototype system.",
            "It does not provide a medical diagnosis and should not replace professional medical advice.",
            "Kaggle labels and population may not match local clinical populations.",
            "Unknown cholesterol or glucose values are estimated from training defaults and reduce confidence.",
        ],
    }
    COMPARISON_PATH.write_text(json.dumps(compared, indent=2), encoding="utf-8")
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def _select_best_model(compared: dict[str, dict[str, Any]]) -> str:
    ranked = sorted(
        compared.items(),
        key=lambda item: (item[1]["roc_auc"], item[1]["f1_score"], item[1]["recall"]),
        reverse=True,
    )
    best_name, best_metrics = ranked[0]
    for candidate in ("Random Forest", "Gradient Boosting"):
        if candidate in compared and best_name not in ("Random Forest", "Gradient Boosting"):
            auc_gap = best_metrics["roc_auc"] - compared[candidate]["roc_auc"]
            if auc_gap <= 0.01:
                return candidate
    return best_name


def _load_artifacts() -> tuple[Pipeline, dict[str, Any]]:
    if not MODEL_PATH.exists() or not METADATA_PATH.exists():
        train_and_compare_non_domain_models()
    with MODEL_PATH.open("rb") as file:
        model = pickle.load(file)
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    return model, metadata


def predict_non_domain_risk(request: NonDomainPredictionRequest) -> NonDomainPredictionResponse:
    model, metadata = _load_artifacts()
    row, estimated_inputs, missing_inputs = _map_request_to_features(request, metadata)
    probability = float(model.predict_proba(row)[0][1])
    risk_score = round(max(0.0, min(1.0, probability)), 4)
    risk_percentage = round(risk_score * 100, 1)
    confidence_level = _confidence_level(missing_inputs)

    return NonDomainPredictionResponse(
        risk_score=risk_score,
        risk_percentage=risk_percentage,
        risk_category=_risk_category(risk_score),
        confidence_level=confidence_level,
        estimated_inputs=estimated_inputs,
        missing_inputs=missing_inputs,
        explanation=_explain_prediction(model, row, metadata),
        model_used="non_domain_cvd_model",
        disclaimer=DISCLAIMER,
    )


def _map_request_to_features(
    request: NonDomainPredictionRequest,
    metadata: dict[str, Any],
) -> tuple[pd.DataFrame, dict[str, float | int], list[str]]:
    category_defaults = metadata.get("category_defaults", {})
    estimated_inputs: dict[str, float | int] = {}
    missing_inputs: list[str] = []
    cholesterol = _map_category(request.cholesterol_category, category_defaults.get("cholesterol", 1), "cholesterol", estimated_inputs, missing_inputs)
    glucose = _map_category(request.glucose_category, category_defaults.get("gluc", 1), "glucose", estimated_inputs, missing_inputs)
    bmi = request.weight_kg / ((request.height_cm / 100.0) ** 2)

    values: dict[str, float | int] = {
        "age_years": request.age,
        "gender": 2 if request.sex == "male" else 1,
        "bmi": bmi,
        "ap_hi": request.systolic_bp,
        "ap_lo": request.diastolic_bp,
        "cholesterol": cholesterol,
        "gluc": glucose,
        "smoke": 1 if request.smoking_status == "yes" else 0,
        "active": 1 if request.physical_activity == "yes" else 0,
    }
    feature_columns = metadata["feature_columns"]
    if "alco" in feature_columns:
        values["alco"] = 1 if request.alcohol_intake == "yes" else 0
    return pd.DataFrame([{column: values[column] for column in feature_columns}]), estimated_inputs, missing_inputs


def _map_category(
    value: str,
    default_value: int,
    label: str,
    estimated_inputs: dict[str, float | int],
    missing_inputs: list[str],
) -> int:
    mapping = {"normal": 1, "above_normal": 2, "well_above_normal": 3}
    if value == "unknown":
        estimated_inputs[label] = int(default_value)
        missing_inputs.append(label)
        return int(default_value)
    return mapping[value]


def _confidence_level(missing_inputs: list[str]) -> str:
    if len(missing_inputs) >= 3:
        return "low"
    if len(missing_inputs) >= 1:
        return "medium"
    return "high"


def _risk_category(score: float) -> str:
    if score >= 0.20:
        return "high"
    if score >= 0.10:
        return "moderate"
    return "low"


def _explain_prediction(model: Pipeline, row: pd.DataFrame, metadata: dict[str, Any]) -> dict[str, Any]:
    try:
        return _shap_explanation(model, row, metadata)
    except Exception:
        return _fallback_explanation(model, row, metadata)


def _shap_explanation(model: Pipeline, row: pd.DataFrame, metadata: dict[str, Any]) -> dict[str, Any]:
    if shap is None:
        raise RuntimeError("SHAP is not installed")
    classifier = model.named_steps["classifier"]
    transformed = model.named_steps["imputer"].transform(row)
    explainer = shap.TreeExplainer(classifier)
    shap_values = explainer.shap_values(transformed)
    if isinstance(shap_values, list):
        values = np.asarray(shap_values[-1][0])
    else:
        values = np.asarray(shap_values[0])
    return {"method": "SHAP", "top_factors": _top_factors(metadata["feature_columns"], row.iloc[0], values)}


def _fallback_explanation(model: Pipeline, row: pd.DataFrame, metadata: dict[str, Any]) -> dict[str, Any]:
    classifier = model.named_steps["classifier"]
    if hasattr(classifier, "feature_importances_"):
        values = np.asarray(classifier.feature_importances_)
        method = "FEATURE_IMPORTANCE"
    elif hasattr(classifier, "coef_"):
        values = np.asarray(classifier.coef_[0])
        method = "COEFFICIENT"
    else:
        values = np.ones(len(metadata["feature_columns"]))
        method = "FALLBACK"
    return {"method": method, "top_factors": _top_factors(metadata["feature_columns"], row.iloc[0], values)}


def _top_factors(feature_columns: list[str], row: pd.Series, values: np.ndarray) -> list[dict[str, Any]]:
    pairs = sorted(zip(feature_columns, values, strict=False), key=lambda item: abs(float(item[1])), reverse=True)[:5]
    total = sum(abs(float(value)) for _, value in pairs) or 1.0
    factors = []
    for feature, value in pairs:
        direction = "increased_risk" if float(value) >= 0 else "decreased_risk"
        label = FEATURE_LABELS.get(feature, feature)
        factors.append(
            {
                "feature": feature,
                "user_friendly_label": label,
                "direction": direction,
                "importance": round(abs(float(value)) / total, 4),
                "plain_language": _plain_language(label, direction),
                "input_value": round(float(row[feature]), 2),
            }
        )
    return factors


def _plain_language(label: str, direction: str) -> str:
    if direction == "increased_risk":
        return f"{label} increased your estimated risk in this prediction."
    return f"{label} lowered your estimated risk in this prediction."


def comparison_table(metadata: dict[str, Any] | None = None) -> str:
    if metadata is None:
        metadata = train_and_compare_non_domain_models()
    rows = ["Model | Accuracy | Precision | Recall | F1-score | ROC-AUC", "--- | --- | --- | --- | --- | ---"]
    for name, metrics in metadata["all_compared_model_metrics"].items():
        rows.append(
            f"{name} | {metrics['accuracy']} | {metrics['precision']} | "
            f"{metrics['recall']} | {metrics['f1_score']} | {metrics['roc_auc']}"
        )
    rows.append(f"\nSelected model: {metadata['selected_model_name']}")
    rows.append(f"Class distribution after cleaning: {metadata['class_balance']}")
    rows.append(f"Feature list: {', '.join(metadata['feature_columns'])}")
    rows.append("Limitations: educational prototype only; not a diagnosis or replacement for medical advice.")
    return "\n".join(rows)
