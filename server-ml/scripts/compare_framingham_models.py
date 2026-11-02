"""Compare the Framingham ML models (explained with SHAP/LIME) against the FasterRisk card.

Run from the server-ml folder (after scripts/train_framingham_score.py):

    python scripts/compare_framingham_models.py

It prints three tables:
  1. Accuracy: train/test AUC and Brier score for every model on the same test patients.
  2. Global SHAP: each model's most important inputs, and how many of them the
     FasterRisk card also chose.
  3. SHAP vs LIME: how often the two methods agree on a patient's top drivers.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import warnings

import numpy as np

from app.services.framingham_dataset import framingham_train_test_split
from app.services.framingham_models import MODEL_NAMES, compare_all_models
from app.services.framingham_score import load_score_card
from app.services.framingham_xai import global_shap_importance, lime_values, shap_values


TOP_N = 5  # how many top inputs to compare
GLOBAL_SHAP_PATIENTS = 200
AGREEMENT_PATIENTS = 50


def top_inputs(values, columns, n: int = TOP_N) -> set[str]:
    order = np.argsort(-np.abs(np.asarray(values)))[:n]
    return {columns[i] for i in order}


def print_accuracy_table() -> None:
    print("1. Accuracy on the same test patients")
    print(f"{'model':<22}{'train AUC':>10}{'test AUC':>10}{'Brier':>8}")
    for row in compare_all_models().metrics:
        print(f"{row.model_name:<22}{row.train_auc:>10}{row.test_auc:>10}{row.test_brier_score:>8}")
    print()


def print_global_shap_table(X_test) -> None:
    card_inputs = {item["field"] for item in load_score_card()["items"]}
    print(f"2. Global SHAP: top {TOP_N} inputs per model (mean |SHAP| over {GLOBAL_SHAP_PATIENTS} test patients)")
    print(f"   FasterRisk card uses: {', '.join(sorted(card_inputs))}")
    sample = X_test.sample(n=GLOBAL_SHAP_PATIENTS, random_state=42)
    for model_name in MODEL_NAMES:
        ranking = global_shap_importance(model_name, sample)
        top = list(ranking.index[:TOP_N])
        shared = len(set(top) & card_inputs)
        print(f"   {model_name:<20} {', '.join(top):<55} also on card: {shared}/{len(card_inputs)}")
    print()


def print_shap_lime_agreement(X_test) -> None:
    print(f"3. SHAP vs LIME: average overlap of each patient's top {TOP_N} inputs ({AGREEMENT_PATIENTS} test patients)")
    sample = X_test.sample(n=AGREEMENT_PATIENTS, random_state=0)
    columns = list(sample.columns)
    for model_name in MODEL_NAMES:
        _, all_shap = shap_values(model_name, sample)
        overlaps = [
            len(top_inputs(all_shap[i], columns) & top_inputs(lime_values(model_name, sample.iloc[[i]]), columns))
            for i in range(len(sample))
        ]
        print(f"   {model_name:<20} {np.mean(overlaps):.1f} / {TOP_N} inputs in common")


def main() -> None:
    warnings.filterwarnings("ignore")
    _, X_test, _, _ = framingham_train_test_split()
    print_accuracy_table()
    print_global_shap_table(X_test)
    print_shap_lime_agreement(X_test)


if __name__ == "__main__":
    main()
