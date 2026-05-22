from functools import lru_cache
from typing import Any

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
    ModelInfo,
    ModelListResponse,
    ModelMetricsResponse,
    ModelName,
    RiskPredictionRequest,
    RiskPredictionResponse,
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

    return RiskPredictionResponse(
        model_name=request.model_name,
        risk_score=risk_score,
        predicted_class=predicted_class,
        risk_level=risk_level,
        explanation=explanation,
        model_version=f"{MODEL_VERSION_PREFIX}-{request.model_name}",
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
        explanation.append("More colored major vessels contributed to the risk estimate.")
    if request.thal in (6, 7):
        explanation.append("Thalassemia defect category contributed to the risk estimate.")
    if request.trestbps >= 140:
        explanation.append("Elevated resting blood pressure contributed to the risk estimate.")
    if request.chol >= 240:
        explanation.append("High cholesterol contributed to the risk estimate.")

    if not explanation:
        explanation.append("The model did not detect strong high-risk signals from the highlighted clinical fields.")

    return explanation
