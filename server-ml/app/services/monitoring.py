"""Model monitoring computations: subgroup fairness and input data drift.

Fairness is measured on out-of-fold predictions over the full labelled dataset so
every patient contributes a prediction from a model that never saw them. Drift is
measured with the Population Stability Index (PSI) of incoming assessment inputs
against the training split that the deployed models were fitted on.
"""

from collections.abc import Callable
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold

from app.schemas import (
    DriftDistributionBin,
    DriftFeatureResult,
    DriftRequest,
    DriftResponse,
    DriftTrendPoint,
    FairnessAttributeResult,
    FairnessGroupMetrics,
    FairnessResponse,
    ModelName,
)
from app.services.dataset import FEATURE_COLUMNS, load_heart_disease_data
from app.services.risk_model import FEATURE_LABELS, _build_model, get_evaluation_split


FAIRNESS_FOLDS = 5
MIN_GROUP_SIZE = 30
# Absolute gap (in rate units) at which a subgroup is flagged for review.
FAIRNESS_WATCH_GAP = 0.05
FAIRNESS_INVESTIGATE_GAP = 0.10

# Conventional PSI bands used in credit and clinical model monitoring.
PSI_MODERATE = 0.10
PSI_SIGNIFICANT = 0.25
PSI_EPSILON = 1e-4
MIN_DRIFT_RECORDS = 100
TREND_WINDOW_DAYS = 7
MIN_WINDOW_RECORDS = 30

CATEGORICAL_FEATURES = {"sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"}
CATEGORY_LABELS: dict[str, dict[float, str]] = {
    "sex": {0: "Female", 1: "Male"},
    "cp": {1: "Typical angina", 2: "Atypical angina", 3: "Non-anginal", 4: "Asymptomatic"},
    "fbs": {0: "<= 120 mg/dl", 1: "> 120 mg/dl"},
    "restecg": {0: "Normal", 1: "ST-T abnormality", 2: "LV hypertrophy"},
    "exang": {0: "No", 1: "Yes"},
    "slope": {1: "Upsloping", 2: "Flat", 3: "Downsloping"},
    "ca": {0: "0", 1: "1", 2: "2", 3: "3"},
    "thal": {3: "Normal", 6: "Fixed defect", 7: "Reversible defect"},
}

GroupPredicate = Callable[[pd.DataFrame], pd.Series]
SENSITIVE_ATTRIBUTES: dict[str, tuple[str, list[tuple[str, GroupPredicate]]]] = {
    "sex": (
        "Sex",
        [
            ("Female", lambda frame: frame["sex"] == 0),
            ("Male", lambda frame: frame["sex"] == 1),
        ],
    ),
    "age_group": (
        "Age group",
        [
            ("Under 50", lambda frame: frame["age"] < 50),
            ("50-64", lambda frame: (frame["age"] >= 50) & (frame["age"] < 65)),
            ("65 and over", lambda frame: frame["age"] >= 65),
        ],
    ),
    "fasting_blood_sugar": (
        "Fasting blood sugar",
        [
            ("Normal (<= 120 mg/dl)", lambda frame: frame["fbs"] == 0),
            ("Elevated (> 120 mg/dl)", lambda frame: frame["fbs"] == 1),
        ],
    ),
}


@lru_cache(maxsize=4)
def _out_of_fold_predictions(model_name: ModelName) -> pd.DataFrame:
    X, y = load_heart_disease_data()
    probabilities = np.zeros(len(y))
    folds = StratifiedKFold(n_splits=FAIRNESS_FOLDS, shuffle=True, random_state=42)

    for train_index, test_index in folds.split(X, y):
        model = _build_model(model_name)
        model.fit(X.iloc[train_index], y.iloc[train_index])
        probabilities[test_index] = model.predict_proba(X.iloc[test_index])[:, 1]

    frame = X.copy()
    frame["actual"] = y.to_numpy()
    frame["probability"] = probabilities
    frame["predicted"] = (probabilities >= 0.5).astype(int)
    return frame


def _group_metrics(group: str, rows: pd.DataFrame) -> FairnessGroupMetrics:
    actual = rows["actual"].to_numpy()
    predicted = rows["predicted"].to_numpy()
    tp = int(((predicted == 1) & (actual == 1)).sum())
    fp = int(((predicted == 1) & (actual == 0)).sum())
    tn = int(((predicted == 0) & (actual == 0)).sum())
    fn = int(((predicted == 0) & (actual == 1)).sum())
    size = len(rows)

    return FairnessGroupMetrics(
        group=group,
        sample_size=size,
        prevalence=_ratio(tp + fn, size),
        selection_rate=_ratio(tp + fp, size),
        true_positive_rate=_ratio(tp, tp + fn),
        false_positive_rate=_ratio(fp, fp + tn),
        accuracy=_ratio(tp + tn, size),
        limited_confidence=size < MIN_GROUP_SIZE,
    )


def _ratio(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def _gap(value: float | None, reference: float | None) -> float | None:
    if value is None or reference is None:
        return None
    return round(value - reference, 4)


def _fairness_status(groups: list[FairnessGroupMetrics]) -> str:
    # Equalised-odds gaps drive the status. Selection-rate parity is reported but
    # not used here because disease prevalence genuinely differs between groups.
    worst_gap = max(
        (
            abs(gap)
            for group in groups
            if not group.limited_confidence
            for gap in (group.tpr_gap, group.fpr_gap)
            if gap is not None
        ),
        default=0.0,
    )
    if worst_gap >= FAIRNESS_INVESTIGATE_GAP:
        return "investigate"
    if worst_gap >= FAIRNESS_WATCH_GAP:
        return "watch"
    return "within_limit"


def compute_fairness(model_name: ModelName) -> FairnessResponse:
    frame = _out_of_fold_predictions(model_name)
    attributes: list[FairnessAttributeResult] = []

    for key, (label, groups) in SENSITIVE_ATTRIBUTES.items():
        metrics = [
            _group_metrics(group_name, frame[predicate(frame)])
            for group_name, predicate in groups
        ]
        metrics = [metric for metric in metrics if metric.sample_size > 0]
        # The largest group is the reference so gaps are measured against the
        # population the model has seen the most of.
        reference = max(metrics, key=lambda metric: metric.sample_size)
        for metric in metrics:
            metric.is_reference = metric.group == reference.group
            metric.tpr_gap = _gap(metric.true_positive_rate, reference.true_positive_rate)
            metric.fpr_gap = _gap(metric.false_positive_rate, reference.false_positive_rate)
            metric.selection_rate_gap = _gap(metric.selection_rate, reference.selection_rate)
            if metric.selection_rate is not None and reference.selection_rate:
                metric.disparate_impact = round(metric.selection_rate / reference.selection_rate, 4)

        selection_rates = [metric.selection_rate for metric in metrics if metric.selection_rate is not None]
        tprs = [metric.true_positive_rate for metric in metrics if metric.true_positive_rate is not None]
        attributes.append(
            FairnessAttributeResult(
                attribute=key,
                label=label,
                reference_group=reference.group,
                demographic_parity_difference=round(max(selection_rates) - min(selection_rates), 4)
                if selection_rates
                else None,
                equal_opportunity_difference=round(max(tprs) - min(tprs), 4) if tprs else None,
                status=_fairness_status(metrics),
                groups=metrics,
            )
        )

    return FairnessResponse(
        model_name=model_name,
        evaluation_method=f"{FAIRNESS_FOLDS}-fold stratified out-of-fold predictions",
        sample_size=len(frame),
        min_group_size=MIN_GROUP_SIZE,
        thresholds={
            "watch_gap": FAIRNESS_WATCH_GAP,
            "investigate_gap": FAIRNESS_INVESTIGATE_GAP,
        },
        attributes=attributes,
    )


@lru_cache(maxsize=1)
def _drift_baseline() -> dict[str, dict[str, Any]]:
    X_train, _, _, _ = get_evaluation_split()
    baseline: dict[str, dict[str, Any]] = {}

    for feature in FEATURE_COLUMNS:
        values = X_train[feature].astype(float)
        if feature in CATEGORICAL_FEATURES:
            categories = sorted(values.unique().tolist())
            baseline[feature] = {"kind": "categorical", "categories": categories}
        else:
            # Quintile edges from the training data (coarse bins keep PSI stable on
            # small samples); open-ended outer bins catch new extreme values.
            edges = np.unique(np.quantile(values, np.linspace(0, 1, 6)))
            edges[0], edges[-1] = -np.inf, np.inf
            baseline[feature] = {"kind": "numeric", "edges": edges.tolist()}
        baseline[feature]["proportions"] = _proportions(feature, values, baseline[feature])
        baseline[feature]["mean"] = float(values.mean())

    return baseline


def _proportions(feature: str, values: pd.Series, spec: dict[str, Any]) -> list[float]:
    if values.empty:
        return []
    if spec["kind"] == "categorical":
        counts = [(values == category).sum() for category in spec["categories"]]
    else:
        counts = np.histogram(values, bins=spec["edges"])[0].tolist()
    total = len(values)
    return [count / total for count in counts]


def _bin_labels(feature: str, spec: dict[str, Any]) -> list[str]:
    if spec["kind"] == "categorical":
        labels = CATEGORY_LABELS.get(feature, {})
        return [labels.get(category, f"{category:g}") for category in spec["categories"]]

    edges = spec["edges"]
    labels = []
    for lower, upper in zip(edges[:-1], edges[1:]):
        if lower == -np.inf:
            labels.append(f"< {upper:g}")
        elif upper == np.inf:
            labels.append(f">= {lower:g}")
        else:
            labels.append(f"{lower:g}-{upper:g}")
    return labels


def _psi(baseline: list[float], current: list[float]) -> float:
    expected = np.clip(np.asarray(baseline), PSI_EPSILON, None)
    actual = np.clip(np.asarray(current), PSI_EPSILON, None)
    return round(float(np.sum((actual - expected) * np.log(actual / expected))), 4)


def _drift_status(psi: float) -> str:
    if psi >= PSI_SIGNIFICANT:
        return "significant"
    if psi >= PSI_MODERATE:
        return "moderate"
    return "stable"


def compute_drift(request: DriftRequest) -> DriftResponse:
    baseline = _drift_baseline()
    frame = pd.DataFrame([record.model_dump() for record in request.records])
    features: list[DriftFeatureResult] = []

    for feature in FEATURE_COLUMNS:
        spec = baseline[feature]
        current_values = frame[feature].astype(float) if not frame.empty else pd.Series(dtype=float)
        current_proportions = _proportions(feature, current_values, spec)
        psi = _psi(spec["proportions"], current_proportions) if current_proportions else 0.0
        features.append(
            DriftFeatureResult(
                feature=feature,
                label=FEATURE_LABELS.get(feature, feature),
                kind=spec["kind"],
                psi=psi,
                status=_drift_status(psi) if current_proportions else "no_data",
                baseline_mean=round(spec["mean"], 4),
                current_mean=round(float(current_values.mean()), 4) if not current_values.empty else None,
                distribution=[
                    DriftDistributionBin(bin=label, baseline=round(base, 4), current=round(cur, 4))
                    for label, base, cur in zip(
                        _bin_labels(feature, spec),
                        spec["proportions"],
                        current_proportions or [0.0] * len(spec["proportions"]),
                    )
                ],
            )
        )

    features.sort(key=lambda item: item.psi, reverse=True)
    return DriftResponse(
        method="Population Stability Index",
        baseline="Model training split (80% of UCI Heart Disease)",
        baseline_size=len(get_evaluation_split()[0]),
        current_size=len(frame),
        limited_confidence=len(frame) < MIN_DRIFT_RECORDS,
        min_records=MIN_DRIFT_RECORDS,
        thresholds={"moderate": PSI_MODERATE, "significant": PSI_SIGNIFICANT},
        overall_psi=round(float(np.mean([item.psi for item in features])), 4) if not frame.empty else 0.0,
        features=features,
        trend=_daily_trend(frame, baseline),
    )


def _daily_trend(frame: pd.DataFrame, baseline: dict[str, dict[str, Any]]) -> list[DriftTrendPoint]:
    if frame.empty or "day" not in frame:
        return []

    dated = frame.dropna(subset=["day"]).assign(day=lambda rows: pd.to_datetime(rows["day"]))
    trend = []
    for day in sorted(dated["day"].unique()):
        # Each point is the PSI of a trailing window so a single quiet day does
        # not produce a noisy spike.
        window = dated[(dated["day"] > day - pd.Timedelta(days=TREND_WINDOW_DAYS)) & (dated["day"] <= day)]
        psi = (
            {
                feature: _psi(
                    baseline[feature]["proportions"],
                    _proportions(feature, window[feature].astype(float), baseline[feature]),
                )
                for feature in FEATURE_COLUMNS
            }
            if len(window) >= MIN_WINDOW_RECORDS
            else {}
        )
        trend.append(DriftTrendPoint(day=pd.Timestamp(day).date().isoformat(), records=len(window), psi=psi))
    return trend
