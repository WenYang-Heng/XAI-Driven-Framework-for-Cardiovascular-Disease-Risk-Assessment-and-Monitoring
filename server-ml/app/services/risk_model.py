from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from app.schemas import (
    ConfusionMatrix,
    FeatureContribution,
    LimeExplanation,
    ModelInfo,
    ModelListResponse,
    ModelMetricsResponse,
    ModelName,
    RiskPredictionRequest,
    RiskPredictionResponse,
    ShapExplanation,
    XaiExplanation,
)
from app.services.dataset import FEATURE_COLUMNS, load_heart_disease_data


MODEL_VERSION_PREFIX = "uci-heart"

MODEL_INFOS = [
    ModelInfo(
        name="xgboost",
        display_name="XGBoost",
        description="Gradient boosted decision tree classifier using XGBoost.",
    ),
    ModelInfo(
        name="random_forest",
        display_name="Random Forest",
        description="Tree ensemble classifier using scikit-learn RandomForestClassifier.",
    ),
    ModelInfo(
        name="neural_network",
        display_name="Neural Network Classification",
        description="Feed-forward neural network classifier using scikit-learn MLPClassifier.",
    ),
    ModelInfo(
        name="logistic_regression",
        display_name="Logistic Regression",
        description="Linear baseline classifier using scikit-learn LogisticRegression.",
    ),
]

FEATURE_LABELS = {
    "age": "Age",
    "sex": "Sex",
    "cp": "Chest Pain Type",
    "trestbps": "Resting Blood Pressure",
    "chol": "Serum Cholesterol",
    "fbs": "Fasting Blood Sugar",
    "restecg": "Resting ECG Result",
    "thalach": "Maximum Heart Rate",
    "exang": "Exercise-Induced Angina",
    "oldpeak": "ST Depression",
    "slope": "ST Segment Slope",
    "ca": "Number of Major Vessels Coloured by Fluoroscopy",
    "thal": "Thalassemia",
}


class XGBoostModel:
    def __init__(self) -> None:
        self.imputer = SimpleImputer(strategy="median")
        self.classifier = XGBClassifier(
            n_estimators=150,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=42,
        )

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "XGBoostModel":
        X_imputed = self.imputer.fit_transform(X)
        self.classifier.fit(X_imputed, y)
        return self

    def predict(self, X: pd.DataFrame) -> Any:
        X_imputed = self.imputer.transform(X)
        return self.classifier.predict(X_imputed)

    def predict_proba(self, X: pd.DataFrame) -> Any:
        X_imputed = self.imputer.transform(X)
        return self.classifier.predict_proba(X_imputed)


def list_models() -> ModelListResponse:
    return ModelListResponse(models=MODEL_INFOS)


@lru_cache(maxsize=1)
def get_evaluation_split() -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    X, y = load_heart_disease_data()
    return train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)


@lru_cache(maxsize=4)
def get_model(model_name: ModelName) -> Any:
    X, y = load_heart_disease_data()
    model = _build_model(model_name)
    model.fit(X, y)
    return model


@lru_cache(maxsize=4)
def get_model_metrics(model_name: ModelName) -> ModelMetricsResponse:
    X_train, X_test, y_train, y_test = get_evaluation_split()
    model = _build_model(model_name)
    model.fit(X_train, y_train)

    predicted = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]
    tn, fp, fn, tp = confusion_matrix(y_test, predicted, labels=[0, 1]).ravel()
    specificity = tn / (tn + fp) if (tn + fp) else 0.0

    return ModelMetricsResponse(
        model_name=model_name,
        accuracy=round(float(accuracy_score(y_test, predicted)), 4),
        precision=round(float(precision_score(y_test, predicted, zero_division=0)), 4),
        sensitivity_recall=round(float(recall_score(y_test, predicted, zero_division=0)), 4),
        specificity=round(float(specificity), 4),
        f1_score=round(float(f1_score(y_test, predicted, zero_division=0)), 4),
        auc_roc=round(float(roc_auc_score(y_test, probabilities)), 4),
        confusion_matrix=ConfusionMatrix(
            true_negative=int(tn),
            false_positive=int(fp),
            false_negative=int(fn),
            true_positive=int(tp),
        ),
    )


def predict_risk(request: RiskPredictionRequest) -> RiskPredictionResponse:
    model = get_model(request.model_name)
    input_frame = pd.DataFrame([_feature_payload(request)], columns=FEATURE_COLUMNS)
    risk_score = round(float(model.predict_proba(input_frame)[0][1]), 4)
    predicted_class = 1 if risk_score >= 0.5 else 0
    risk_level = _risk_level(risk_score)
    explanation = _build_explanation(request)
    xai = _build_xai_explanation(request.model_name, model, input_frame, risk_score, risk_level, explanation)

    return RiskPredictionResponse(
        model_name=request.model_name,
        risk_score=risk_score,
        predicted_class=predicted_class,
        risk_level=risk_level,
        explanation=explanation,
        model_version=f"{MODEL_VERSION_PREFIX}-{request.model_name}",
        xai=xai,
    )


def _build_model(model_name: ModelName) -> Any:
    if model_name == "xgboost":
        return XGBoostModel()

    if model_name == "random_forest":
        classifier = RandomForestClassifier(
            n_estimators=300,
            max_depth=6,
            class_weight="balanced",
            random_state=42,
        )
        return Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("classifier", classifier),
            ]
        )

    if model_name == "neural_network":
        classifier = MLPClassifier(
            hidden_layer_sizes=(32, 16),
            activation="relu",
            alpha=0.001,
            max_iter=1000,
            random_state=42,
        )
        return Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                ("classifier", classifier),
            ]
        )

    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)),
        ]
    )


def _feature_payload(request: RiskPredictionRequest) -> dict[str, float | int]:
    payload = request.model_dump()
    payload.pop("model_name", None)
    return payload


def _risk_level(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.35:
        return "moderate"
    return "low"


def _build_explanation(request: RiskPredictionRequest) -> list[str]:
    explanation: list[str] = []

    if request.cp == 4:
        explanation.append("Asymptomatic chest pain type is associated with higher disease risk in this dataset.")
    if request.exang == 1:
        explanation.append("Exercise induced angina increased the risk estimate.")
    if request.oldpeak >= 1:
        explanation.append("ST depression during exercise contributed to the risk estimate.")
    if request.ca > 0:
        explanation.append("More coloured major vessels contributed to the risk estimate.")
    if request.thal in (6, 7):
        explanation.append("Thalassemia defect category contributed to the risk estimate.")
    if request.trestbps >= 140:
        explanation.append("Elevated resting blood pressure contributed to the risk estimate.")
    if request.chol >= 240:
        explanation.append("High cholesterol contributed to the risk estimate.")

    if not explanation:
        explanation.append("The model did not detect strong high-risk signals from the highlighted clinical fields.")

    return explanation


@lru_cache(maxsize=1)
def _background_sample() -> pd.DataFrame:
    X, _ = load_heart_disease_data()
    sample_size = min(40, len(X))
    return X.sample(n=sample_size, random_state=42).reset_index(drop=True)


@lru_cache(maxsize=4)
def _lime_explainer(model_name: ModelName) -> Any:
    from lime.lime_tabular import LimeTabularExplainer

    background = _background_sample()
    return LimeTabularExplainer(
        training_data=background.to_numpy(dtype=float),
        feature_names=FEATURE_COLUMNS,
        class_names=["No heart disease", "Heart disease"],
        mode="classification",
        discretize_continuous=True,
        random_state=42,
    )


@lru_cache(maxsize=4)
def _tree_shap_explainer(model_name: ModelName) -> Any:
    import shap

    model = get_model(model_name)
    background = _background_sample()

    if model_name == "xgboost":
        background_data = model.imputer.transform(background)
        estimator = model.classifier
    else:
        background_data = model.named_steps["imputer"].transform(background)
        estimator = model.named_steps["classifier"]

    return shap.TreeExplainer(
        estimator,
        data=background_data,
        feature_perturbation="interventional",
        model_output="probability",
    )


def _build_xai_explanation(
    model_name: ModelName,
    model: Any,
    input_frame: pd.DataFrame,
    risk_score: float,
    risk_level: str,
    explanation: list[str],
) -> XaiExplanation:
    shap_explanation = _build_shap_explanation(model_name, model, input_frame, risk_score)
    lime_explanation = _build_lime_explanation(model_name, model, input_frame)
    summary = _build_xai_summary(
        risk_level,
        shap_explanation.contributions,
        lime_explanation.contributions,
        explanation,
    )

    return XaiExplanation(
        shap=shap_explanation,
        lime=lime_explanation,
        summary=summary,
    )


def _build_shap_explanation(
    model_name: ModelName,
    model: Any,
    input_frame: pd.DataFrame,
    risk_score: float,
) -> ShapExplanation:
    try:
        if model_name in ("random_forest", "xgboost"):
            explainer = _tree_shap_explainer(model_name)
            input_values = _tree_model_input(model_name, model, input_frame)
            raw_values = explainer.shap_values(input_values)
            shap_values = _class_one_values(raw_values)
            base_value = _class_one_base_value(explainer.expected_value)
        else:
            explainer, base_value = _kernel_shap_explainer(model_name)
            raw_values = explainer.shap_values(input_frame.to_numpy(dtype=float), nsamples=80)
            shap_values = _class_one_values(raw_values)
    except Exception:
        return _fallback_shap_explanation(model, input_frame, risk_score)

    values = np.asarray(shap_values, dtype=float).reshape(-1)
    contributions = _contributions_from_values(values)
    return ShapExplanation(
        base_value=round(float(base_value), 4),
        final_value=round(float(risk_score), 4),
        contributions=contributions,
    )


@lru_cache(maxsize=4)
def _kernel_shap_explainer(model_name: ModelName) -> tuple[Any, float]:
    import shap

    model = get_model(model_name)
    background = _background_sample()

    def predict_positive(data: Any) -> np.ndarray:
        frame = pd.DataFrame(data, columns=FEATURE_COLUMNS)
        return model.predict_proba(frame)[:, 1]

    explainer = shap.KernelExplainer(predict_positive, background.to_numpy(dtype=float))
    return explainer, float(explainer.expected_value)


def _build_lime_explanation(model_name: ModelName, model: Any, input_frame: pd.DataFrame) -> LimeExplanation:
    explainer = _lime_explainer(model_name)

    def predict(data: Any) -> np.ndarray:
        frame = pd.DataFrame(data, columns=FEATURE_COLUMNS)
        return model.predict_proba(frame)

    explanation = explainer.explain_instance(
        data_row=input_frame.iloc[0].to_numpy(dtype=float),
        predict_fn=predict,
        num_features=len(FEATURE_COLUMNS),
        labels=(1,),
    )
    values_by_index = dict(explanation.local_exp.get(1, []))
    values = [float(values_by_index.get(index, 0.0)) for index in range(len(FEATURE_COLUMNS))]
    return LimeExplanation(contributions=_contributions_from_values(values))


def _tree_model_input(model_name: ModelName, model: Any, input_frame: pd.DataFrame) -> np.ndarray:
    if model_name == "xgboost":
        return model.imputer.transform(input_frame)
    return model.named_steps["imputer"].transform(input_frame)


def _fallback_shap_explanation(model: Any, input_frame: pd.DataFrame, risk_score: float) -> ShapExplanation:
    background = _background_sample()
    baseline_row = background.mean(numeric_only=True)
    baseline_frame = pd.DataFrame([baseline_row], columns=FEATURE_COLUMNS)
    base_value = float(model.predict_proba(baseline_frame)[0][1])

    raw_values: list[float] = []
    for feature in FEATURE_COLUMNS:
        perturbed = input_frame.copy()
        perturbed.loc[:, feature] = baseline_row[feature]
        perturbed_score = float(model.predict_proba(perturbed)[0][1])
        raw_values.append(float(risk_score) - perturbed_score)

    raw_total = sum(raw_values)
    target_total = float(risk_score) - base_value
    if abs(raw_total) > 1e-9:
        values = [value * (target_total / raw_total) for value in raw_values]
    else:
        values = [0.0 for _ in raw_values]

    return ShapExplanation(
        base_value=round(base_value, 4),
        final_value=round(float(risk_score), 4),
        contributions=_contributions_from_values(values),
    )


def _class_one_values(raw_values: Any) -> np.ndarray:
    if isinstance(raw_values, list):
        return np.asarray(raw_values[1])

    values = np.asarray(raw_values)
    if values.ndim == 3:
        return values[:, :, 1]
    return values


def _class_one_base_value(expected_value: Any) -> float:
    if isinstance(expected_value, (list, tuple, np.ndarray)):
        return float(np.asarray(expected_value).reshape(-1)[1])
    return float(expected_value)


def _contributions_from_values(values: Any) -> list[FeatureContribution]:
    flattened = np.asarray(values, dtype=float).reshape(-1)
    return [
        FeatureContribution(feature=feature, value=round(float(flattened[index]), 4))
        for index, feature in enumerate(FEATURE_COLUMNS)
    ]


def _build_xai_summary(
    risk_level: str,
    shap_contributions: list[FeatureContribution],
    lime_contributions: list[FeatureContribution],
    explanation: list[str],
) -> list[str]:
    positive = sorted(shap_contributions, key=lambda item: item.value, reverse=True)
    negative = sorted(shap_contributions, key=lambda item: item.value)
    lime_top = sorted(lime_contributions, key=lambda item: abs(item.value), reverse=True)
    shap_top_names = [_feature_label(item.feature) for item in positive[:3]]
    reducing_name = _feature_label(negative[0].feature)
    lime_top_names = [_feature_label(item.feature) for item in lime_top[:3]]
    overlapping = sorted(set(shap_top_names).intersection(lime_top_names))
    agreement_text = (
        f"Both SHAP and LIME highlight {', '.join(overlapping)} as important local drivers."
        if overlapping
        else "SHAP and LIME emphasize different local drivers, so this explanation should be reviewed carefully."
    )

    summary = [
        f"The model classified this assessment as {risk_level} risk based on the current clinical feature values.",
        f"The prediction was mainly driven upward by {shap_top_names[0]}, {shap_top_names[1]}, and {shap_top_names[2]}.",
        f"{reducing_name} had the strongest reducing effect in this model output.",
        agreement_text,
    ]
    if explanation:
        summary.append(explanation[0])
    summary.append("This explanation supports clinical review and should not be treated as a standalone diagnosis.")
    return summary


def _feature_label(feature: str) -> str:
    return FEATURE_LABELS.get(feature, feature)
