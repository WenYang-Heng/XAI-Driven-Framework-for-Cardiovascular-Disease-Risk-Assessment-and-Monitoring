"""Black-box ML models trained on Framingham, so they can be compared with the FasterRisk card.

All four models use the same 14 raw inputs and the same train/test split as the
score card. They are trained without class weighting so that their outputs
stay realistic probabilities (about 15% of patients have the outcome), which
matters because we show them to users as a risk percentage.
"""

from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from app.schemas import FraminghamModelMetrics, FraminghamModelMetricsListResponse, FraminghamModelName
from app.services.framingham_dataset import INPUT_COLUMNS, framingham_train_test_split
from app.services.framingham_score import card_risks, load_score_card


MODEL_NAMES: tuple[FraminghamModelName, ...] = (
    "xgboost",
    "random_forest",
    "neural_network",
    "logistic_regression",
)
MODEL_DIR = Path(__file__).resolve().parents[2] / "data" / "models" / "framingham"


def build_model(model_name: FraminghamModelName) -> Any:
    if model_name == "xgboost":
        return XGBClassifier(
            n_estimators=200,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=42,
        )
    if model_name == "random_forest":
        return RandomForestClassifier(n_estimators=300, max_depth=6, min_samples_leaf=10, random_state=42)
    if model_name == "neural_network":
        return make_pipeline(
            StandardScaler(),
            MLPClassifier(hidden_layer_sizes=(32, 16), alpha=0.01, early_stopping=True, max_iter=1000, random_state=42),
        )
    if model_name == "logistic_regression":
        return make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    raise ValueError(f"Unknown model: {model_name}")


@lru_cache(maxsize=len(MODEL_NAMES))
def get_model(model_name: FraminghamModelName) -> Any:
    """Load the saved model, or train and save it the first time it is needed."""
    path = MODEL_DIR / f"{model_name}.pkl"
    if path.exists():
        return joblib.load(path)

    X_train, _, y_train, _ = framingham_train_test_split()
    model = build_model(model_name).fit(X_train, y_train)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)
    return model


def predict_probability(model: Any, X: pd.DataFrame) -> Any:
    """Probability of 10-year CHD for each row."""
    return model.predict_proba(X[INPUT_COLUMNS])[:, 1]


def evaluate(model_name: str, risks_train: Any, risks_test: Any) -> FraminghamModelMetrics:
    _, _, y_train, y_test = framingham_train_test_split()
    return FraminghamModelMetrics(
        model_name=model_name,
        train_auc=round(float(roc_auc_score(y_train, risks_train)), 4),
        test_auc=round(float(roc_auc_score(y_test, risks_test)), 4),
        test_brier_score=round(float(brier_score_loss(y_test, risks_test)), 4),
    )


@lru_cache(maxsize=len(MODEL_NAMES))
def model_metrics(model_name: FraminghamModelName) -> FraminghamModelMetrics:
    X_train, X_test, _, _ = framingham_train_test_split()
    model = get_model(model_name)
    return evaluate(model_name, predict_probability(model, X_train), predict_probability(model, X_test))


def compare_all_models() -> FraminghamModelMetricsListResponse:
    """Metrics for the four ML models and the FasterRisk card, on the same test patients."""
    X_train, X_test, _, _ = framingham_train_test_split()
    card = load_score_card()
    card_metrics = evaluate("fasterrisk_card", card_risks(X_train, card), card_risks(X_test, card))
    return FraminghamModelMetricsListResponse(
        metrics=[*(model_metrics(name) for name in MODEL_NAMES), card_metrics]
    )
