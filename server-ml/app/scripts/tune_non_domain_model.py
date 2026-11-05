from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover - optional dependency guard
    XGBClassifier = None  # type: ignore[assignment]

from app.services.non_domain_dataset import load_cardio_dataset


APP_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = APP_DIR / "models" / "non_domain_hyperparameter_tuning.json"
RANDOM_STATE = 42
CV_FOLDS = 2
N_ITER = 4
TUNING_SAMPLE_SIZE = 12000


def _search_spaces() -> dict[str, tuple[Pipeline, dict[str, list[Any]], int]]:
    spaces: dict[str, tuple[Pipeline, dict[str, list[Any]], int]] = {
        "Logistic Regression": (
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                    (
                        "classifier",
                        LogisticRegression(
                            max_iter=2000,
                            class_weight="balanced",
                            random_state=RANDOM_STATE,
                        ),
                    ),
                ]
            ),
            {
                "classifier__C": [0.01, 0.05, 0.1, 0.5, 1.0, 3.0, 10.0],
                "classifier__solver": ["lbfgs", "liblinear"],
                "classifier__penalty": ["l2"],
            },
            8,
        ),
        "Random Forest": (
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("classifier", RandomForestClassifier(random_state=RANDOM_STATE, class_weight="balanced")),
                ]
            ),
            {
                "classifier__n_estimators": [150, 250, 350],
                "classifier__max_depth": [4, 6, 8, 10, None],
                "classifier__min_samples_split": [2, 5, 10],
                "classifier__min_samples_leaf": [1, 2, 4],
                "classifier__max_features": ["sqrt", "log2", None],
            },
            N_ITER,
        ),
        "Gradient Boosting": (
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("classifier", GradientBoostingClassifier(random_state=RANDOM_STATE)),
                ]
            ),
            {
                "classifier__n_estimators": [120, 180, 240, 300],
                "classifier__learning_rate": [0.03, 0.05, 0.08, 0.1],
                "classifier__max_depth": [2, 3, 4],
                "classifier__subsample": [0.8, 0.9, 1.0],
                "classifier__min_samples_leaf": [1, 3, 5],
            },
            N_ITER,
        ),
        "Neural Network": (
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                    (
                        "classifier",
                        MLPClassifier(
                            max_iter=180,
                            early_stopping=True,
                            random_state=RANDOM_STATE,
                        ),
                    ),
                ]
            ),
            {
                "classifier__hidden_layer_sizes": [(32,), (64,), (64, 32), (96, 48)],
                "classifier__alpha": [0.0001, 0.001, 0.01],
                "classifier__learning_rate_init": [0.0005, 0.001, 0.003],
                "classifier__activation": ["relu", "tanh"],
            },
            N_ITER,
        ),
    }
    if XGBClassifier is not None:
        spaces["XGBoost"] = (
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    (
                        "classifier",
                        XGBClassifier(
                            eval_metric="logloss",
                            random_state=RANDOM_STATE,
                        ),
                    ),
                ]
            ),
            {
                "classifier__n_estimators": [160, 220, 300],
                "classifier__max_depth": [2, 3, 4],
                "classifier__learning_rate": [0.03, 0.05, 0.08, 0.1],
                "classifier__subsample": [0.8, 0.9, 1.0],
                "classifier__colsample_bytree": [0.8, 0.9, 1.0],
                "classifier__reg_lambda": [0.5, 1.0, 2.0],
            },
            N_ITER,
        )
    return spaces


def _test_metrics(model: Pipeline, x_test: Any, y_test: Any) -> dict[str, float]:
    probabilities = model.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
    }


def tune_non_domain_models() -> dict[str, Any]:
    features, target, metadata = load_cardio_dataset()
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=target,
    )
    x_tune, _, y_tune, _ = train_test_split(
        x_train,
        y_train,
        train_size=min(TUNING_SAMPLE_SIZE, len(x_train)),
        random_state=RANDOM_STATE,
        stratify=y_train,
    )

    results: dict[str, dict[str, Any]] = {}
    for name, (pipeline, parameters, n_iter) in _search_spaces().items():
        print(f"Tuning {name}...", flush=True)
        search = RandomizedSearchCV(
            estimator=pipeline,
            param_distributions=parameters,
            n_iter=n_iter,
            scoring="roc_auc",
            cv=CV_FOLDS,
            random_state=RANDOM_STATE,
            n_jobs=1,
            verbose=0,
        )
        search.fit(x_tune, y_tune)
        best_estimator = search.best_estimator_
        best_estimator.fit(x_train, y_train)
        results[name] = {
            "best_cv_roc_auc": round(float(search.best_score_), 4),
            "best_params": search.best_params_,
            "test_metrics": _test_metrics(best_estimator, x_test, y_test),
        }

    ranked = sorted(
        results.items(),
        key=lambda item: (
            item[1]["test_metrics"]["roc_auc"],
            item[1]["test_metrics"]["f1_score"],
            item[1]["test_metrics"]["recall"],
        ),
        reverse=True,
    )
    report = {
        "dataset_name": metadata["dataset_name"],
        "training_date": datetime.now(UTC).isoformat(),
        "search_strategy": "RandomizedSearchCV",
        "cv_folds": CV_FOLDS,
        "scoring": "roc_auc",
        "tuning_sample_size": int(len(x_tune)),
        "final_refit": "Best parameters are refit on the full training split before test-set evaluation.",
        "test_size": 0.2,
        "random_state": RANDOM_STATE,
        "models": results,
        "best_model_name": ranked[0][0],
        "best_model_test_metrics": ranked[0][1]["test_metrics"],
        "note": "Tuning results are saved for evaluation. The production non-domain model is not automatically replaced by this script.",
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def _print_summary(report: dict[str, Any]) -> None:
    print("Model | CV ROC-AUC | Test Accuracy | Test Precision | Test Recall | Test F1-score | Test ROC-AUC")
    print("--- | --- | --- | --- | --- | --- | ---")
    for name, result in report["models"].items():
        metrics = result["test_metrics"]
        print(
            f"{name} | {result['best_cv_roc_auc']} | {metrics['accuracy']} | "
            f"{metrics['precision']} | {metrics['recall']} | {metrics['f1_score']} | {metrics['roc_auc']}"
        )
    print(f"\nBest tuned model: {report['best_model_name']}")
    print(f"Saved tuning report: {OUTPUT_PATH}")


def main() -> None:
    _print_summary(tune_non_domain_models())


if __name__ == "__main__":
    main()
