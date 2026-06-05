from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd


APP_DIR = Path(__file__).resolve().parents[1]
RAW_DATASET_PATH = APP_DIR / "data" / "raw" / "cardio_train.csv"
PROCESSED_DATASET_PATH = APP_DIR / "data" / "processed" / "cardio_processed.csv"

DATASET_NAME = "Kaggle Cardiovascular Disease Dataset"
TARGET_COLUMN = "cardio"
REQUIRED_COLUMNS = [
    "age",
    "gender",
    "height",
    "weight",
    "ap_hi",
    "ap_lo",
    "cholesterol",
    "gluc",
    "smoke",
    "active",
    TARGET_COLUMN,
]
OPTIONAL_COLUMNS = ["alco"]
BASE_FEATURE_COLUMNS = [
    "age_years",
    "gender",
    "bmi",
    "ap_hi",
    "ap_lo",
    "cholesterol",
    "gluc",
    "smoke",
    "active",
]


class NonDomainDatasetError(RuntimeError):
    pass


def _missing_dataset_message(path: Path = RAW_DATASET_PATH) -> str:
    return (
        "Kaggle cardiovascular dataset not found. Download the Cardiovascular Disease Dataset "
        "from Kaggle and place cardio_train.csv at "
        f"{path}. You can use the Kaggle API locally, for example: "
        "'kaggle datasets download -d/sulianova/cardiovascular-disease-dataset', "
        "then unzip cardio_train.csv into server-ml/app/data/raw/. "
        "Do not place Kaggle credentials in this project."
    )


def load_raw_cardio_dataset(path: Path = RAW_DATASET_PATH) -> pd.DataFrame:
    if not path.exists():
        raise NonDomainDatasetError(_missing_dataset_message(path))

    dataframe = pd.read_csv(path, sep=None, engine="python")
    missing = [column for column in REQUIRED_COLUMNS if column not in dataframe.columns]
    if missing:
        raise NonDomainDatasetError(f"Kaggle dataset is missing required columns: {', '.join(missing)}")
    return dataframe


def clean_cardio_dataset(dataframe: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    original_rows = len(dataframe)
    cleaned = dataframe.drop_duplicates().copy()
    rows_after_dedup = len(cleaned)

    usable_columns = REQUIRED_COLUMNS + [column for column in OPTIONAL_COLUMNS if column in cleaned.columns]
    cleaned = cleaned[usable_columns]
    for column in usable_columns:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    cleaned = cleaned.dropna(subset=REQUIRED_COLUMNS)
    cleaned["age_years"] = cleaned["age"] / 365.0
    cleaned["bmi"] = cleaned["weight"] / ((cleaned["height"] / 100.0) ** 2)

    before_range_filter = len(cleaned)
    cleaned = cleaned[
        cleaned["height"].between(120, 220)
        & cleaned["weight"].between(30, 200)
        & cleaned["ap_hi"].between(80, 220)
        & cleaned["ap_lo"].between(40, 140)
        & (cleaned["ap_lo"] < cleaned["ap_hi"])
        & cleaned["bmi"].between(12, 60)
        & cleaned[TARGET_COLUMN].isin([0, 1])
    ].copy()

    feature_columns = BASE_FEATURE_COLUMNS + [column for column in OPTIONAL_COLUMNS if column in cleaned.columns]
    cleaned[TARGET_COLUMN] = cleaned[TARGET_COLUMN].astype(int)
    class_balance = {str(key): int(value) for key, value in cleaned[TARGET_COLUMN].value_counts().sort_index().items()}

    metadata = {
        "dataset_name": DATASET_NAME,
        "raw_rows": int(original_rows),
        "rows_after_deduplication": int(rows_after_dedup),
        "rows_removed_by_validation": int(before_range_filter - len(cleaned)),
        "rows_after_cleaning": int(len(cleaned)),
        "class_balance": class_balance,
        "feature_columns": feature_columns,
        "target_column": TARGET_COLUMN,
        "category_defaults": {
            "cholesterol": int(cleaned["cholesterol"].mode().iloc[0]) if not cleaned.empty else 1,
            "gluc": int(cleaned["gluc"].mode().iloc[0]) if not cleaned.empty else 1,
            "alco": int(cleaned["alco"].mode().iloc[0]) if "alco" in cleaned.columns and not cleaned.empty else 0,
        },
        "cleaning_rules": [
            "Dropped duplicate rows.",
            "Converted age from days to years.",
            "Kept height between 120 and 220 cm.",
            "Kept weight between 30 and 200 kg.",
            "Kept systolic blood pressure between 80 and 220 mmHg.",
            "Kept diastolic blood pressure between 40 and 140 mmHg.",
            "Required diastolic blood pressure to be lower than systolic blood pressure.",
            "Calculated BMI and kept BMI between 12 and 60.",
        ],
    }
    return cleaned[feature_columns + [TARGET_COLUMN]], metadata


@lru_cache(maxsize=1)
def load_cardio_dataset() -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    raw = load_raw_cardio_dataset()
    cleaned, metadata = clean_cardio_dataset(raw)
    PROCESSED_DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(PROCESSED_DATASET_PATH, index=False)
    return cleaned[metadata["feature_columns"]], cleaned[TARGET_COLUMN], metadata


def get_expected_dataset_path() -> str:
    return str(RAW_DATASET_PATH)
