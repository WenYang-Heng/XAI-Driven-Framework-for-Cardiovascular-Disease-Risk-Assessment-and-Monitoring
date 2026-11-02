"""Train a FasterRisk score card on the Framingham dataset and save it as JSON.

Run from the server-ml folder:

    python scripts/train_framingham_score.py            # train the default 6-item card
    python scripts/train_framingham_score.py --k 8      # use 8 items instead
    python scripts/train_framingham_score.py --sweep    # compare card sizes 3..10 first

FasterRisk is only needed here, at training time. The API reads the saved JSON
card, so the running service does not depend on the fasterrisk package.
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
import pandas as pd
from fasterrisk.fasterrisk import RiskScoreClassifier, RiskScoreOptimizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.services.framingham_dataset import CANDIDATE_RULES, binarize, load_framingham_data
from app.services.framingham_score import SCORE_CARD_PATH, print_score_card


DEFAULT_CARD_SIZE = 6
MIN_POINTS, MAX_POINTS = -5, 5


def train_risk_score(X_binary: pd.DataFrame, y: pd.Series, k: int) -> RiskScoreClassifier:
    """Run FasterRisk and return the best card it found (lowest training loss)."""
    optimizer = RiskScoreOptimizer(
        X=X_binary.to_numpy(dtype=float),
        y=np.where(y == 1, 1, -1),  # FasterRisk expects labels of +1 / -1
        k=k,
        lb=MIN_POINTS,
        ub=MAX_POINTS,
    )
    optimizer.optimize()
    multiplier, intercept, coefficients = optimizer.get_models(model_index=0)
    return RiskScoreClassifier(multiplier, intercept, coefficients)


def auc(model: RiskScoreClassifier, X_binary: pd.DataFrame, y: pd.Series) -> float:
    return round(float(roc_auc_score(y, model.predict_prob(X_binary.to_numpy(dtype=float)))), 4)


def logistic_regression_baseline_auc(X_train, y_train, X_test, y_test) -> float:
    """A normal logistic regression on all raw inputs, to compare the card against."""
    baseline = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    baseline.fit(X_train, y_train)
    return round(float(roc_auc_score(y_test, baseline.predict_proba(X_test)[:, 1])), 4)


def build_score_card(model: RiskScoreClassifier, metrics: dict, rows: int) -> dict:
    """Keep only the rules that got non-zero points and package them as plain JSON."""
    items = [
        {"field": rule.field, "threshold": rule.threshold, "label": rule.label, "points": int(points)}
        for rule, points in zip(CANDIDATE_RULES, model.coefficients)
        if points != 0
    ]
    return {
        "name": "framingham-fasterrisk",
        "description": "Points-based 10-year coronary heart disease risk score learned with FasterRisk.",
        "dataset": "Framingham Heart Study",
        "outcome": "10-year coronary heart disease (TenYearCHD)",
        "trained_on": str(date.today()),
        "rows_used": rows,
        "intercept": float(model.intercept),
        "multiplier": float(model.multiplier),
        "items": items,
        "metrics": metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--k", type=int, default=DEFAULT_CARD_SIZE, help="number of items on the card")
    parser.add_argument("--sweep", action="store_true", help="print test AUC for card sizes 3..10 first")
    args = parser.parse_args()

    X, y = load_framingham_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    B_train, B_test = binarize(X_train), binarize(X_test)

    baseline_auc = logistic_regression_baseline_auc(X_train, y_train, X_test, y_test)
    print(f"Logistic regression baseline (all {X.shape[1]} raw inputs): test AUC = {baseline_auc}\n")

    if args.sweep:
        print("items  train AUC  test AUC")
        for k in range(3, 11):
            model = train_risk_score(B_train, y_train, k)
            print(f"{k:>5}  {auc(model, B_train, y_train):>9}  {auc(model, B_test, y_test):>8}")
        print()

    model = train_risk_score(B_train, y_train, args.k)
    metrics = {
        "train_auc": auc(model, B_train, y_train),
        "test_auc": auc(model, B_test, y_test),
        "baseline_logistic_regression_test_auc": baseline_auc,
        "test_size": len(y_test),
    }
    card = build_score_card(model, metrics, rows=len(X))

    SCORE_CARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    SCORE_CARD_PATH.write_text(json.dumps(card, indent=2) + "\n")

    print_score_card(card)
    print(f"\nTrain AUC {metrics['train_auc']} | Test AUC {metrics['test_auc']}")
    print(f"Saved to {SCORE_CARD_PATH}")


if __name__ == "__main__":
    main()
