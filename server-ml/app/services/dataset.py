from functools import lru_cache
from pathlib import Path

import pandas as pd
from ucimlrepo import fetch_ucirepo

from app.schemas import DatasetSummary


DATASET_ID = 45
TARGET_COLUMN = "num"
FALLBACK_DATASET_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "heart_disease_fallback.csv"
FEATURE_COLUMNS = [
    "age",
    "sex",
    "cp",
    "trestbps",
    "chol",
    "fbs",
    "restecg",
    "thalach",
    "exang",
    "oldpeak",
    "slope",
    "ca",
    "thal",
]


@lru_cache(maxsize=1)
def load_heart_disease_data() -> tuple[pd.DataFrame, pd.Series]:
    try:
        heart_disease = fetch_ucirepo(id=DATASET_ID)
        features = heart_disease.data.features.copy()
        targets = heart_disease.data.targets.copy()
    except Exception as error:
        if not FALLBACK_DATASET_PATH.exists():
            raise RuntimeError(
                "Unable to fetch UCI dataset and no fallback dataset found at "
                f"{FALLBACK_DATASET_PATH}."
            ) from error

        fallback_data = pd.read_csv(FALLBACK_DATASET_PATH)
        missing_columns = [
            column for column in [*FEATURE_COLUMNS, TARGET_COLUMN] if column not in fallback_data.columns
        ]
        if missing_columns:
            missing = ", ".join(missing_columns)
            raise ValueError(f"Fallback dataset is missing required columns: {missing}") from error

        features = fallback_data[FEATURE_COLUMNS].copy()
        targets = fallback_data[[TARGET_COLUMN]].copy()

    missing_features = [column for column in FEATURE_COLUMNS if column not in features.columns]
    if missing_features:
        missing = ", ".join(missing_features)
        raise ValueError(f"Missing expected UCI feature columns: {missing}")

    if TARGET_COLUMN in targets.columns:
        target = targets[TARGET_COLUMN]
    else:
        target = targets.iloc[:, 0]

    data = features[FEATURE_COLUMNS].copy()
    data[TARGET_COLUMN] = target
    data = data.replace("?", pd.NA).dropna()

    X = data[FEATURE_COLUMNS].astype(float)
    y = (data[TARGET_COLUMN].astype(float) > 0).astype(int)
    return X, y


def get_dataset_summary() -> DatasetSummary:
    X, y = load_heart_disease_data()
    return DatasetSummary(
        dataset_id=DATASET_ID,
        dataset_name="UCI Heart Disease",
        input_features=FEATURE_COLUMNS,
        target=TARGET_COLUMN,
        rows_after_cleaning=len(y),
    )
