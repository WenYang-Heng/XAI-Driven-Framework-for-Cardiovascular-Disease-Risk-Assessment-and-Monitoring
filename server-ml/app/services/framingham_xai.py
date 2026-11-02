"""SHAP and LIME explanations for the Framingham ML models.

Both methods explain the model's predicted probability of 10-year CHD:
  - SHAP splits (prediction - average prediction) fairly across the 14 inputs,
    so base_value + sum(contributions) = final_value.
  - LIME fits a small linear model around this one patient and reports its weights.

Tree models (XGBoost, Random Forest) use the fast, exact TreeExplainer. The
neural network and logistic regression use the model-agnostic KernelExplainer.
"""

from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd

from app.schemas import (
    FeatureContribution,
    FraminghamModelName,
    FraminghamModelPredictionRequest,
    FraminghamModelPredictionResponse,
    LimeExplanation,
    ShapExplanation,
)
from app.services.framingham_dataset import INPUT_COLUMNS, framingham_train_test_split
from app.services.framingham_models import get_model, predict_probability
from app.services.framingham_score import risk_level


TREE_MODELS = ("xgboost", "random_forest")
BACKGROUND_SIZE = 100  # training rows SHAP compares against ("the average patient")
KERNEL_SHAP_SAMPLES = 500  # more = more accurate but slower, for KernelExplainer only


@lru_cache(maxsize=1)
def background_data() -> pd.DataFrame:
    X_train, _, _, _ = framingham_train_test_split()
    return X_train.sample(n=BACKGROUND_SIZE, random_state=42)


@lru_cache(maxsize=4)
def shap_explainer(model_name: FraminghamModelName) -> Any:
    import shap

    model = get_model(model_name)
    if model_name in TREE_MODELS:
        return shap.TreeExplainer(
            model,
            data=background_data(),
            feature_perturbation="interventional",
            model_output="probability",
        )
    return shap.KernelExplainer(
        lambda rows: predict_probability(model, pd.DataFrame(rows, columns=INPUT_COLUMNS)),
        background_data(),
    )


def shap_values(model_name: FraminghamModelName, X: pd.DataFrame) -> tuple[float, np.ndarray]:
    """Return (base value, SHAP values with one row per patient and one column per input)."""
    explainer = shap_explainer(model_name)
    if model_name in TREE_MODELS:
        values = explainer.shap_values(X[INPUT_COLUMNS])
    else:
        values = explainer.shap_values(X[INPUT_COLUMNS], nsamples=KERNEL_SHAP_SAMPLES, silent=True)

    values = np.asarray(values, dtype=float)
    base_value = np.asarray(explainer.expected_value, dtype=float).reshape(-1)
    if values.ndim == 3:  # Random Forest returns both classes; keep the "has CHD" class
        values, base_value = values[:, :, 1], base_value[1:]
    return float(base_value[-1]), values


@lru_cache(maxsize=1)
def lime_explainer() -> Any:
    from lime.lime_tabular import LimeTabularExplainer

    X_train, _, _, _ = framingham_train_test_split()
    yes_no_columns = [i for i, column in enumerate(INPUT_COLUMNS) if set(X_train[column].unique()) <= {0, 1}]
    return LimeTabularExplainer(
        training_data=X_train.to_numpy(dtype=float),
        feature_names=INPUT_COLUMNS,
        class_names=["No CHD", "CHD"],
        categorical_features=yes_no_columns,
        mode="classification",
        random_state=42,
    )


def lime_values(model_name: FraminghamModelName, patient: pd.DataFrame) -> list[float]:
    """LIME weight for each input, in INPUT_COLUMNS order."""
    model = get_model(model_name)
    explanation = lime_explainer().explain_instance(
        data_row=patient[INPUT_COLUMNS].iloc[0].to_numpy(dtype=float),
        predict_fn=lambda rows: model.predict_proba(pd.DataFrame(rows, columns=INPUT_COLUMNS)),
        num_features=len(INPUT_COLUMNS),
        labels=(1,),
    )
    weights = dict(explanation.local_exp[1])
    return [float(weights.get(i, 0.0)) for i in range(len(INPUT_COLUMNS))]


def to_contributions(values: Any) -> list[FeatureContribution]:
    return [
        FeatureContribution(feature=feature, value=round(float(value), 4))
        for feature, value in zip(INPUT_COLUMNS, values)
    ]


def global_shap_importance(model_name: FraminghamModelName, X: pd.DataFrame) -> pd.Series:
    """Mean |SHAP| per input over many patients, largest first."""
    _, values = shap_values(model_name, X)
    return pd.Series(np.abs(values).mean(axis=0), index=INPUT_COLUMNS).sort_values(ascending=False)


def predict_with_xai(request: FraminghamModelPredictionRequest) -> FraminghamModelPredictionResponse:
    inputs = request.model_dump(exclude={"model_name"})
    missing = [column for column in INPUT_COLUMNS if inputs[column] is None]
    if missing:
        raise ValueError(f"ML models need every input. Missing: {', '.join(missing)}")

    patient = pd.DataFrame([inputs], columns=INPUT_COLUMNS).astype(float)
    risk = float(predict_probability(get_model(request.model_name), patient)[0])
    base_value, values = shap_values(request.model_name, patient)

    return FraminghamModelPredictionResponse(
        model_name=request.model_name,
        risk=round(risk, 4),
        risk_level=risk_level(risk),
        shap=ShapExplanation(
            base_value=round(base_value, 4),
            final_value=round(risk, 4),
            contributions=to_contributions(values[0]),
        ),
        lime=LimeExplanation(contributions=to_contributions(lime_values(request.model_name, patient))),
    )
