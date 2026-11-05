from __future__ import annotations
from __future__ import annotations

import json
import pickle
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
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
FACTOR_GROUP_LABELS = {
    "ap_hi": "Blood Pressure",
    "ap_lo": "Blood Pressure",
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
        "Neural Network": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    MLPClassifier(
                        hidden_layer_sizes=(64, 32),
                        activation="relu",
                        solver="adam",
                        max_iter=300,
                        early_stopping=True,
                        random_state=42,
                    ),
                ),
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
        compared[name] = _classification_metrics(y_test, predictions, probabilities)
        fitted_models[name] = pipeline

    selected_name = _select_best_model(compared)
    selected_pipeline = fitted_models[selected_name]
    selected_probabilities = selected_pipeline.predict_proba(x_test)[:, 1]
    selected_predictions = (selected_probabilities >= 0.5).astype(int)
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
        "risk_band_analysis": _risk_band_analysis(y_test, selected_probabilities),
        "subgroup_performance": _subgroup_performance(x_test, y_test, selected_predictions, selected_probabilities),
        "target_definition": "cardio = 1 indicates cardiovascular disease in the Kaggle dataset.",
        "risk_thresholds": {"low": "0.00 to 0.30", "moderate": "0.31 to 0.70", "high": "0.71 to 1.00"},
        "threshold_note": "TODO: Calibrate prototype risk thresholds against clinical target probabilities before production use.",
        "explanation_method": "SHAP as the primary local explanation when available, LIME as a supporting consistency check, and feature importance or coefficients as fallback.",
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


def _classification_metrics(y_true: pd.Series, predictions: np.ndarray, probabilities: np.ndarray) -> dict[str, Any]:
    tn, fp, fn, tp = confusion_matrix(y_true, predictions).ravel()
    specificity = tn / (tn + fp) if (tn + fp) else 0.0
    false_negative_rate = fn / (fn + tp) if (fn + tp) else 0.0
    false_positive_rate = fp / (fp + tn) if (fp + tn) else 0.0
    return {
        "accuracy": round(float(accuracy_score(y_true, predictions)), 4),
        "precision": round(float(precision_score(y_true, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, predictions, zero_division=0)), 4),
        "specificity": round(float(specificity), 4),
        "f1_score": round(float(f1_score(y_true, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, probabilities)), 4),
        "brier_score": round(float(brier_score_loss(y_true, probabilities)), 4),
        "log_loss": round(float(log_loss(y_true, probabilities)), 4),
        "false_negative_rate": round(float(false_negative_rate), 4),
        "false_positive_rate": round(float(false_positive_rate), 4),
        "confusion_matrix": {
            "true_negative": int(tn),
            "false_positive": int(fp),
            "false_negative": int(fn),
            "true_positive": int(tp),
        },
    }


def _risk_band_analysis(y_true: pd.Series, probabilities: np.ndarray) -> dict[str, dict[str, float | int]]:
    bands = {
        "low": probabilities < 0.31,
        "moderate": (probabilities >= 0.31) & (probabilities < 0.71),
        "high": probabilities >= 0.71,
    }
    y_values = y_true.to_numpy()
    analysis: dict[str, dict[str, float | int]] = {}
    for band, mask in bands.items():
        count = int(mask.sum())
        if count == 0:
            analysis[band] = {"count": 0, "average_predicted_risk": 0.0, "observed_cardio_rate": 0.0}
            continue
        analysis[band] = {
            "count": count,
            "average_predicted_risk": round(float(probabilities[mask].mean()), 4),
            "observed_cardio_rate": round(float(y_values[mask].mean()), 4),
        }
    return analysis


def _subgroup_performance(
    x_test: pd.DataFrame,
    y_true: pd.Series,
    predictions: np.ndarray,
    probabilities: np.ndarray,
) -> dict[str, dict[str, dict[str, float | int | None]]]:
    groups: dict[str, pd.Series] = {
        "sex_female": x_test["gender"] == 1,
        "sex_male": x_test["gender"] == 2,
        "age_under_40": x_test["age_years"] < 40,
        "age_40_to_49": x_test["age_years"].between(40, 49.999),
        "age_50_to_59": x_test["age_years"].between(50, 59.999),
        "age_60_plus": x_test["age_years"] >= 60,
    }
    return {
        "test_set": {
            name: _subgroup_metrics(y_true, predictions, probabilities, mask.to_numpy())
            for name, mask in groups.items()
        }
    }


def _subgroup_metrics(
    y_true: pd.Series,
    predictions: np.ndarray,
    probabilities: np.ndarray,
    mask: np.ndarray,
) -> dict[str, float | int | None]:
    count = int(mask.sum())
    if count == 0:
        return {
            "count": 0,
            "positive_rate": None,
            "accuracy": None,
            "recall": None,
            "false_negative_rate": None,
            "average_predicted_risk": None,
        }
    y_group = y_true.to_numpy()[mask]
    prediction_group = predictions[mask]
    probability_group = probabilities[mask]
    positives = int(y_group.sum())
    false_negatives = int(((prediction_group == 0) & (y_group == 1)).sum())
    return {
        "count": count,
        "positive_rate": round(float(y_group.mean()), 4),
        "accuracy": round(float(accuracy_score(y_group, prediction_group)), 4),
        "recall": round(float(recall_score(y_group, prediction_group, zero_division=0)), 4),
        "false_negative_rate": round(float(false_negatives / positives), 4) if positives else None,
        "average_predicted_risk": round(float(probability_group.mean()), 4),
    }


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
    if score >= 0.71:
        return "high"
    if score >= 0.31:
        return "moderate"
    return "low"


def _explain_prediction(model: Pipeline, row: pd.DataFrame, metadata: dict[str, Any]) -> dict[str, Any]:
    try:
        explanation = _shap_explanation(model, row, metadata)
    except Exception as error:
        explanation = _fallback_explanation(model, row, metadata)
        explanation["fallback_reason"] = str(error)

    try:
        lime_top_factors = _lime_explanation(model, row, metadata)
        explanation["supporting_method"] = "LIME"
        explanation["lime_top_factors"] = lime_top_factors
        explanation["consistency_note"] = _consistency_note(explanation["top_factors"], lime_top_factors)
    except Exception as error:
        explanation["lime_fallback_reason"] = str(error)

    return explanation


def _shap_explanation(model: Pipeline, row: pd.DataFrame, metadata: dict[str, Any]) -> dict[str, Any]:
    if shap is None:
        raise RuntimeError("SHAP is not installed")
    classifier = model.named_steps["classifier"]
    transformed = model.named_steps["imputer"].transform(row)
    explainer = shap.TreeExplainer(classifier)
    explanation = explainer(transformed)
    values = np.asarray(explanation.values)
    if values.ndim == 3:
        values = values[0, :, -1]
    elif values.ndim == 2:
        values = values[0]
    else:
        values = np.asarray(values).reshape(-1)
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


@lru_cache(maxsize=1)
def _background_sample() -> pd.DataFrame:
    features, _, _ = load_cardio_dataset()
    sample_size = min(80, len(features))
    return features.sample(n=sample_size, random_state=42).reset_index(drop=True)


@lru_cache(maxsize=1)
def _lime_explainer(feature_columns: tuple[str, ...]) -> Any:
    from lime.lime_tabular import LimeTabularExplainer

    background = _background_sample().loc[:, list(feature_columns)]
    return LimeTabularExplainer(
        training_data=background.to_numpy(dtype=float),
        feature_names=list(feature_columns),
        class_names=["Lower CVD risk", "Higher CVD risk"],
        mode="classification",
        discretize_continuous=True,
        random_state=42,
    )


def _lime_explanation(model: Pipeline, row: pd.DataFrame, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    feature_columns = tuple(metadata["feature_columns"])
    explainer = _lime_explainer(feature_columns)

    def predict(data: Any) -> np.ndarray:
        frame = pd.DataFrame(data, columns=list(feature_columns))
        return model.predict_proba(frame)

    explanation = explainer.explain_instance(
        data_row=row.iloc[0].to_numpy(dtype=float),
        predict_fn=predict,
        num_features=len(feature_columns),
        labels=(1,),
    )
    values_by_index = dict(explanation.local_exp.get(1, []))
    values = np.asarray([float(values_by_index.get(index, 0.0)) for index in range(len(feature_columns))])
    return _top_factors(list(feature_columns), row.iloc[0], values)


def _consistency_note(primary_factors: list[dict[str, Any]], lime_factors: list[dict[str, Any]]) -> str:
    primary_names = {factor["feature"] for factor in primary_factors[:3]}
    lime_names = {factor["feature"] for factor in lime_factors[:3]}
    overlap = primary_names.intersection(lime_names)
    if overlap:
        labels = [FEATURE_LABELS.get(feature, feature) for feature in sorted(overlap)]
        return f"SHAP and LIME both highlighted {', '.join(labels)} among the main drivers."
    return "SHAP and LIME highlighted different drivers, so this explanation should be treated as an estimate."


def _top_factors(feature_columns: list[str], row: pd.Series, values: np.ndarray) -> list[dict[str, Any]]:
    grouped = _group_factor_values(feature_columns, row, values)
    pairs = sorted(grouped.values(), key=lambda item: abs(float(item["value"])), reverse=True)[:5]
    total = sum(abs(float(item["value"])) for item in pairs) or 1.0
    factors = []
    for item in pairs:
        feature = item["feature"]
        value = item["value"]
        label = item["label"]
        importance = round(abs(float(value)) / total, 4)
        input_value = float(item["input_value"])
        direction = _factor_direction(feature, label, float(value), input_value)
        factors.append(
            {
                "feature": feature,
                "user_friendly_label": label,
                "direction": direction,
                "importance": importance,
                "importance_percentage": round(importance * 100, 1),
                "plain_language": _plain_language(label, direction),
                "input_value": round(input_value, 2),
            }
        )
    return factors


def _factor_direction(feature: str, label: str, contribution: float, input_value: float) -> str:
    if feature == "smoke" and input_value <= 0:
        return "decreased_risk"
    if feature == "active" and input_value >= 1:
        return "decreased_risk"
    if feature == "alco" and input_value <= 0:
        return "decreased_risk"
    return "increased_risk" if contribution >= 0 else "decreased_risk"


def _group_factor_values(feature_columns: list[str], row: pd.Series, values: np.ndarray) -> dict[str, dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for feature, raw_value in zip(feature_columns, values, strict=False):
        label = FACTOR_GROUP_LABELS.get(feature, FEATURE_LABELS.get(feature, feature))
        if label not in grouped:
            grouped[label] = {
                "feature": feature,
                "label": label,
                "value": 0.0,
                "input_value": float(row[feature]),
            }
        grouped[label]["value"] += float(raw_value)
        if abs(float(raw_value)) > abs(float(grouped[label].get("strongest_value", 0.0))):
            grouped[label]["feature"] = feature
            grouped[label]["input_value"] = float(row[feature])
            grouped[label]["strongest_value"] = float(raw_value)
    return grouped


def _plain_language(label: str, direction: str) -> str:
    templates = {
        "Blood Pressure": {
            "increased_risk": "Your blood pressure may be higher than ideal and could add strain to your heart and blood vessels.",
            "decreased_risk": "Your blood pressure is within a healthier range, which is a positive sign for heart health.",
        },
        "Systolic blood pressure": {
            "increased_risk": "Your blood pressure reading may be higher than ideal and could add strain to your heart and blood vessels.",
            "decreased_risk": "Your blood pressure reading is within a healthier range, which is a positive sign for heart health.",
        },
        "Diastolic blood pressure": {
            "increased_risk": "Your lower blood pressure number may be worth watching because it can affect heart strain.",
            "decreased_risk": "Your lower blood pressure number is within a healthier range for this assessment.",
        },
        "Cholesterol level": {
            "increased_risk": "Your cholesterol category may need attention because cholesterol can affect blood vessels over time.",
            "decreased_risk": "Your cholesterol category looks healthier, which may be helping your heart health.",
        },
        "Blood sugar level": {
            "increased_risk": "Your blood sugar category may be worth monitoring because it can affect blood vessels over time.",
            "decreased_risk": "Your blood sugar category is within a healthier range for this assessment.",
        },
        "Physical activity": {
            "increased_risk": "Low physical activity may make it harder to protect your heart health.",
            "decreased_risk": "Being physically active may be helping protect your heart health.",
        },
        "Smoking status": {
            "increased_risk": "Smoking can put extra stress on your heart and blood vessels.",
            "decreased_risk": "Not smoking may be helping protect your heart health.",
        },
        "Weight category / BMI": {
            "increased_risk": "Your weight range may be affecting blood pressure, blood sugar, and heart health.",
            "decreased_risk": "Your weight range is less likely to be adding strain in this assessment.",
        },
        "Age": {
            "increased_risk": "Age can affect cardiovascular risk, so regular monitoring becomes more important over time.",
            "decreased_risk": "Your age group is associated with lower risk than older age groups in this dataset.",
        },
        "Sex": {
            "increased_risk": "Sex is one background factor the model considers, but it is not something you can change.",
            "decreased_risk": "Sex is one background factor the model considers for this estimate.",
        },
        "Alcohol intake": {
            "increased_risk": "Alcohol intake may affect blood pressure and overall heart health for some people.",
            "decreased_risk": "Your alcohol intake is less likely to be adding heart-health risk in this assessment.",
        },
    }
    return templates.get(label, {}).get(
        direction,
        f"{label} may be {'worth watching' if direction == 'increased_risk' else 'helping your heart health'} for this estimate.",
    )


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
