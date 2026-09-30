from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.schemas import DatasetSummary


DATASET_NAME = "Framingham Heart Study"
DATASET_PATH = Path(__file__).resolve().parents[1] / "resources" / "framingham.csv"
TARGET_COLUMN = "ten_year_chd"

# Source CSV column -> API feature name. `education` is intentionally excluded:
# it is not a clinical risk factor and should not be collected by a clinical tool.
SOURCE_COLUMN_MAP = {
    "male": "sex",
    "age": "age",
    "currentSmoker": "current_smoker",
    "cigsPerDay": "cigs_per_day",
    "BPMeds": "bp_meds",
    "prevalentStroke": "prevalent_stroke",
    "prevalentHyp": "prevalent_hyp",
    "diabetes": "diabetes",
    "totChol": "tot_chol",
    "sysBP": "sys_bp",
    "diaBP": "dia_bp",
    "BMI": "bmi",
    "heartRate": "heart_rate",
    "glucose": "glucose",
    "TenYearCHD": TARGET_COLUMN,
}
FEATURE_COLUMNS = [
    "sex",
    "age",
    "current_smoker",
    "cigs_per_day",
    "bp_meds",
    "prevalent_stroke",
    "prevalent_hyp",
    "diabetes",
    "tot_chol",
    "sys_bp",
    "dia_bp",
    "bmi",
    "heart_rate",
    "glucose",
]


@lru_cache(maxsize=1)
def load_heart_disease_data() -> tuple[pd.DataFrame, pd.Series]:
    if not DATASET_PATH.exists():
        raise RuntimeError(f"Framingham dataset not found at {DATASET_PATH}.")

    raw = pd.read_csv(DATASET_PATH, na_values=["NA", ""])
    missing_columns = [column for column in SOURCE_COLUMN_MAP if column not in raw.columns]
    if missing_columns:
        missing = ", ".join(missing_columns)
        raise ValueError(f"Framingham dataset is missing required columns: {missing}")

    data = raw[list(SOURCE_COLUMN_MAP)].rename(columns=SOURCE_COLUMN_MAP)
    data = data.dropna(subset=[TARGET_COLUMN])

    # Missing feature values are kept and imputed inside each model pipeline.
    X = data[FEATURE_COLUMNS].astype(float).reset_index(drop=True)
    y = data[TARGET_COLUMN].astype(int).reset_index(drop=True)
    return X, y


def get_dataset_summary() -> DatasetSummary:
    X, y = load_heart_disease_data()
    return DatasetSummary(
        dataset_name=DATASET_NAME,
        input_features=FEATURE_COLUMNS,
        target=TARGET_COLUMN,
        rows=len(y),
        positive_rate=round(float(y.mean()), 4),
        missing_values={
            column: int(count) for column, count in X.isna().sum().items() if count
        },
    )
