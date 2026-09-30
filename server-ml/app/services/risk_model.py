from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from app.schemas import (
    ConfusionMatrix,
    CrossValidationMetrics,
    FeatureContribution,
    GlobalShapFeatureImportance,
    GlobalShapResponse,
    LimeExplanation,
    ModelInfo,
    ModelListResponse,
    ModelMetricsListResponse,
    ModelMetricsResponse,
    ModelName,
    RiskPredictionRequest,
    RiskPredictionResponse,
    ShapExplanation,
    XaiExplanation,
)
from app.services.dataset import DATASET_NAME, FEATURE_COLUMNS, load_heart_disease_data


MODEL_VERSION_PREFIX = "framingham-chd10"
MODEL_TRAINING_STRATEGY = "framingham-holdout-v2"
CV_FOLDS = 5

# 10-year CHD risk bands. predicted_class and the classification metrics use the
# high-risk cut-off so that "positive" means "flag for clinical action".
MODERATE_RISK_THRESHOLD = 0.10
HIGH_RISK_THRESHOLD = 0.20

# Age range covered by the Framingham extract; predictions outside it are extrapolations.
TRAINING_AGE_RANGE = (32, 70)
MODEL_ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "data" / "models"

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
    "sex": "Sex",
    "age": "Age",
    "current_smoker": "Current Smoker",
    "cigs_per_day": "Cigarettes per Day",
    "bp_meds": "On BP Medication",
    "prevalent_stroke": "Previous Stroke",
    "prevalent_hyp": "Hypertension",
    "diabetes": "Diabetes",
    "tot_chol": "Total Cholesterol",
    "sys_bp": "Systolic Blood Pressure",
    "dia_bp": "Diastolic Blood Pressure",
    "bmi": "BMI",
    "heart_rate": "Resting Heart Rate",
    "glucose": "Glucose",
}

GLOBAL_FEATURE_DISPLAY_NAMES = FEATURE_LABELS


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


def all_model_metrics() -> ModelMetricsListResponse:
    return ModelMetricsListResponse(
        metrics=[get_model_metrics(model.name) for model in MODEL_INFOS]
    )


@lru_cache(maxsize=1)
def get_evaluation_split() -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    X, y = load_heart_disease_data()
    return train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)


@lru_cache(maxsize=4)
def get_model(model_name: ModelName) -> Any:
    stored_model = _load_model_artifact(model_name)
    if stored_model is not None:
        return stored_model

    return train_and_save_model(model_name)


def train_and_save_model(model_name: ModelName) -> Any:
    X, _, y, _ = get_evaluation_split()
    model = _build_model(model_name)
    model.fit(X, y)
    _save_model_artifact(model_name, model)
    return model


@lru_cache(maxsize=4)
def get_model_metrics(model_name: ModelName) -> ModelMetricsResponse:
    _, X_test, _, y_test = get_evaluation_split()
    model = get_model(model_name)

    probabilities = model.predict_proba(X_test)[:, 1]
    predicted = (probabilities >= HIGH_RISK_THRESHOLD).astype(int)
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
        brier_score=round(float(brier_score_loss(y_test, probabilities)), 4),
        decision_threshold=HIGH_RISK_THRESHOLD,
        cross_validation=get_cross_validation_metrics(model_name),
        confusion_matrix=ConfusionMatrix(
            true_negative=int(tn),
            false_positive=int(fp),
            false_negative=int(fn),
            true_positive=int(tp),
        ),
    )


@lru_cache(maxsize=4)
def get_cross_validation_metrics(model_name: ModelName) -> CrossValidationMetrics:
    """Stratified k-fold on the training split only, so the test set stays untouched."""
    X_train, _, y_train, _ = get_evaluation_split()
    folds = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)
    aucs: list[float] = []
    briers: list[float] = []

    for train_index, valid_index in folds.split(X_train, y_train):
        model = _build_model(model_name)
        model.fit(X_train.iloc[train_index], y_train.iloc[train_index])
        probabilities = model.predict_proba(X_train.iloc[valid_index])[:, 1]
        aucs.append(float(roc_auc_score(y_train.iloc[valid_index], probabilities)))
        briers.append(float(brier_score_loss(y_train.iloc[valid_index], probabilities)))

    return CrossValidationMetrics(
        folds=CV_FOLDS,
        auc_roc_mean=round(float(np.mean(aucs)), 4),
        auc_roc_std=round(float(np.std(aucs)), 4),
        brier_score_mean=round(float(np.mean(briers)), 4),
        brier_score_std=round(float(np.std(briers)), 4),
    )


def predict_risk(request: RiskPredictionRequest) -> RiskPredictionResponse:
    model = get_model(request.model_name)
    input_frame = pd.DataFrame([_feature_payload(request)], columns=FEATURE_COLUMNS)
    risk_score = round(float(model.predict_proba(input_frame)[0][1]), 4)
    predicted_class = 1 if risk_score >= HIGH_RISK_THRESHOLD else 0
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


def compute_global_shap(model_name: ModelName) -> GlobalShapResponse:
    try:
        model = get_model(model_name)
        X, _ = load_heart_disease_data()
        sample = _global_shap_sample(X)
        explainer, shap_input, explainer_type = _global_shap_explainer_and_input(model_name, model, sample)
        if explainer_type == "KernelExplainer":
            raw_values = explainer.shap_values(shap_input, nsamples=80)
        else:
            raw_values = explainer.shap_values(shap_input)
        shap_values = _class_one_matrix(raw_values)
        feature_importance = _global_feature_importance(shap_values)

        return GlobalShapResponse(
            model_name=model_name,
            dataset_name=DATASET_NAME,
            samples_explained=len(sample),
            explainer_type=explainer_type,
            feature_importance=feature_importance,
            beeswarm_data=None,
            dependence_data=None,
            summary_text=_global_shap_summary(feature_importance),
            generation_status="completed",
            error_message=None,
        )
    except Exception as error:
        return GlobalShapResponse(
            model_name=model_name,
            dataset_name=DATASET_NAME,
            samples_explained=0,
            explainer_type=None,
            feature_importance=[],
            beeswarm_data=None,
            dependence_data=None,
            summary_text=None,
            generation_status="failed",
            error_message=str(error),
        )


def _build_model(model_name: ModelName) -> Any:
    if model_name == "xgboost":
        return XGBoostModel()

    if model_name == "random_forest":
        classifier = RandomForestClassifier(
            n_estimators=300,
            max_depth=6,
            min_samples_leaf=10,
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
            alpha=0.01,
            max_iter=1000,
            early_stopping=True,
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
            ("classifier", LogisticRegression(max_iter=1000, random_state=42)),
        ]
    )


def _model_artifact_path(model_name: ModelName) -> Path:
    return MODEL_ARTIFACT_DIR / f"{model_name}.pkl"


def _load_model_artifact(model_name: ModelName) -> Any | None:
    artifact_path = _model_artifact_path(model_name)
    if not artifact_path.exists():
        return None

    artifact = joblib.load(artifact_path)
    if isinstance(artifact, dict):
        if artifact.get("feature_columns") != FEATURE_COLUMNS:
            return None
        if artifact.get("training_strategy") != MODEL_TRAINING_STRATEGY:
            return None
        return artifact["model"]

    return artifact


def _save_model_artifact(model_name: ModelName, model: Any) -> None:
    MODEL_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    artifact = {
        "model_name": model_name,
        "model_version": f"{MODEL_VERSION_PREFIX}-{model_name}",
        "training_strategy": MODEL_TRAINING_STRATEGY,
        "feature_columns": FEATURE_COLUMNS,
        "model": model,
    }
    joblib.dump(artifact, _model_artifact_path(model_name))


def _feature_payload(request: RiskPredictionRequest) -> dict[str, float | int]:
    payload = request.model_dump()
    payload.pop("model_name", None)
    return payload


def _risk_level(score: float) -> str:
    if score >= HIGH_RISK_THRESHOLD:
        return "high"
    if score >= MODERATE_RISK_THRESHOLD:
        return "moderate"
    return "low"


def _build_explanation(request: RiskPredictionRequest) -> list[str]:
    explanation: list[str] = []

    if request.current_smoker == 1:
        explanation.append(
            f"Current smoking ({request.cigs_per_day:g} cigarettes/day) is a modifiable factor that raises CHD risk."
        )
    if request.sys_bp >= 140 or request.dia_bp >= 90:
        treated = " despite BP medication" if request.bp_meds == 1 else ""
        explanation.append(
            f"Blood pressure of {request.sys_bp:g}/{request.dia_bp:g} mmHg is in the hypertensive range{treated}."
        )
    if request.tot_chol >= 240:
        explanation.append(f"Total cholesterol of {request.tot_chol:g} mg/dL is high (>= 240 mg/dL).")
    if request.diabetes == 1 or request.glucose >= 126:
        explanation.append("Diabetes or elevated glucose contributes to cardiovascular risk.")
    if request.bmi >= 30:
        explanation.append(f"BMI of {request.bmi:g} is in the obese range.")
    if request.prevalent_stroke == 1:
        explanation.append("A previous stroke indicates established vascular disease.")

    if not explanation:
        explanation.append("No strongly elevated modifiable risk factors were found in the recorded values.")

    min_age, max_age = TRAINING_AGE_RANGE
    if not min_age <= request.age <= max_age:
        explanation.append(
            f"Age {request.age} is outside the {min_age}-{max_age} range of the training data, "
            "so this estimate is an extrapolation."
        )

    return explanation


@lru_cache(maxsize=1)
def _background_sample() -> pd.DataFrame:
    X, _ = load_heart_disease_data()
    complete = X.dropna()
    sample_size = min(40, len(complete))
    return complete.sample(n=sample_size, random_state=42).reset_index(drop=True)


@lru_cache(maxsize=4)
def _lime_explainer(model_name: ModelName) -> Any:
    from lime.lime_tabular import LimeTabularExplainer

    background = _background_sample()
    return LimeTabularExplainer(
        training_data=background.to_numpy(dtype=float),
        feature_names=FEATURE_COLUMNS,
        class_names=["No CHD within 10 years", "CHD within 10 years"],
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


def _global_shap_sample(X: pd.DataFrame) -> pd.DataFrame:
    X = X.dropna()
    sample_size = min(300, len(X))
    if len(X) <= sample_size:
        return X.reset_index(drop=True)
    return X.sample(n=sample_size, random_state=42).reset_index(drop=True)


def _global_shap_explainer_and_input(model_name: ModelName, model: Any, sample: pd.DataFrame) -> tuple[Any, np.ndarray, str]:
    import shap

    if model_name == "xgboost":
        shap_input = model.imputer.transform(sample)
        explainer = shap.TreeExplainer(
            model.classifier,
            data=shap_input,
            feature_perturbation="interventional",
            model_output="probability",
        )
        return explainer, shap_input, "TreeExplainer"

    if model_name == "random_forest":
        shap_input = model.named_steps["imputer"].transform(sample)
        explainer = shap.TreeExplainer(
            model.named_steps["classifier"],
            data=shap_input,
            feature_perturbation="interventional",
            model_output="probability",
        )
        return explainer, shap_input, "TreeExplainer"

    if model_name == "logistic_regression":
        imputed = model.named_steps["imputer"].transform(sample)
        shap_input = model.named_steps["scaler"].transform(imputed)
        explainer = shap.LinearExplainer(model.named_steps["classifier"], shap_input)
        return explainer, shap_input, "LinearExplainer"

    if model_name == "neural_network":
        background = _background_sample()

        def predict_positive(data: Any) -> np.ndarray:
            frame = pd.DataFrame(data, columns=FEATURE_COLUMNS)
            return model.predict_proba(frame)[:, 1]

        explainer = shap.KernelExplainer(predict_positive, background.to_numpy(dtype=float))
        return explainer, sample.to_numpy(dtype=float), "KernelExplainer"

    raise ValueError(f"Global SHAP is not supported for model: {model_name}")


def _class_one_matrix(raw_values: Any) -> np.ndarray:
    if hasattr(raw_values, "values"):
        raw_values = raw_values.values

    if isinstance(raw_values, list):
        values = np.asarray(raw_values[1], dtype=float)
    else:
        values = np.asarray(raw_values, dtype=float)
        if values.ndim == 3:
            values = values[:, :, 1]

    if values.ndim != 2:
        raise ValueError(f"Expected SHAP values with 2 dimensions, received shape {values.shape}.")
    if values.shape[1] != len(FEATURE_COLUMNS):
        raise ValueError(
            f"Expected {len(FEATURE_COLUMNS)} SHAP feature columns, received {values.shape[1]}."
        )

    return values


def _global_feature_importance(shap_values: np.ndarray) -> list[GlobalShapFeatureImportance]:
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    ranked = sorted(
        zip(FEATURE_COLUMNS, mean_abs_shap, strict=True),
        key=lambda item: float(item[1]),
        reverse=True,
    )
    return [
        GlobalShapFeatureImportance(
            feature=feature,
            display_name=GLOBAL_FEATURE_DISPLAY_NAMES.get(feature, feature),
            mean_abs_shap=round(float(value), 6),
            rank=index + 1,
        )
        for index, (feature, value) in enumerate(ranked)
    ]


def _global_shap_summary(feature_importance: list[GlobalShapFeatureImportance]) -> str | None:
    if not feature_importance:
        return None

    top_features = [item.display_name for item in feature_importance[:5]]
    if len(top_features) == 1:
        feature_text = top_features[0]
    else:
        feature_text = f"{', '.join(top_features[:-1])}, and {top_features[-1]}"

    return (
        f"The model is most influenced by {feature_text}. "
        "These features have the strongest average impact on the model's 10-year CHD risk prediction across the dataset."
    )


def _global_shap_unavailable(model_name: ModelName) -> GlobalShapResponse:
    return GlobalShapResponse(
        model_name=model_name,
        dataset_name=DATASET_NAME,
        samples_explained=0,
        explainer_type=None,
        feature_importance=[],
        beeswarm_data=None,
        dependence_data=None,
        summary_text=None,
        generation_status="unavailable",
        error_message=(
            "Global SHAP for neural_network is currently unavailable because "
            "KernelExplainer is computationally expensive."
        ),
    )


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
