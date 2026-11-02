"""Framingham Heart Study data and the yes/no rules a risk score card can use.

FasterRisk builds score cards from binary (yes/no) features. Instead of letting
it pick arbitrary cut-offs, we give it a short list of clinically readable rules
such as "Systolic BP >= 140", so every line on the final card makes sense to a
patient.
"""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.request import urlretrieve

import pandas as pd


DATASET_URL = "https://raw.githubusercontent.com/GauravPadawe/Framingham-Heart-Study/master/framingham.csv"
DATASET_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "framingham.csv"
TARGET_COLUMN = "TenYearCHD"

# Inputs a patient can report. "education" is left out on purpose: it is not a
# clinical risk factor.
INPUT_COLUMNS = [
    "male",
    "age",
    "currentSmoker",
    "cigsPerDay",
    "BPMeds",
    "prevalentStroke",
    "prevalentHyp",
    "diabetes",
    "totChol",
    "sysBP",
    "diaBP",
    "BMI",
    "heartRate",
    "glucose",
]


@dataclass(frozen=True)
class Rule:
    """A yes/no question about one input: is `field` >= `threshold`?"""

    field: str
    threshold: float
    label: str

    @property
    def name(self) -> str:
        return f"{self.field}>={self.threshold:g}"


# Yes/no fields (0 or 1) use a threshold of 1.
CANDIDATE_RULES = [
    Rule("male", 1, "Male"),
    Rule("age", 40, "Age 40 or older"),
    Rule("age", 45, "Age 45 or older"),
    Rule("age", 50, "Age 50 or older"),
    Rule("age", 55, "Age 55 or older"),
    Rule("age", 60, "Age 60 or older"),
    Rule("age", 65, "Age 65 or older"),
    Rule("currentSmoker", 1, "Current smoker"),
    Rule("cigsPerDay", 10, "Smokes 10+ cigarettes a day"),
    Rule("cigsPerDay", 20, "Smokes 20+ cigarettes a day"),
    Rule("BPMeds", 1, "Takes blood pressure medication"),
    Rule("prevalentStroke", 1, "Has had a stroke"),
    Rule("prevalentHyp", 1, "Diagnosed with hypertension"),
    Rule("diabetes", 1, "Has diabetes"),
    Rule("totChol", 200, "Total cholesterol 200 mg/dL or higher"),
    Rule("totChol", 240, "Total cholesterol 240 mg/dL or higher"),
    Rule("sysBP", 120, "Systolic BP 120 mmHg or higher"),
    Rule("sysBP", 130, "Systolic BP 130 mmHg or higher"),
    Rule("sysBP", 140, "Systolic BP 140 mmHg or higher"),
    Rule("sysBP", 160, "Systolic BP 160 mmHg or higher"),
    Rule("diaBP", 80, "Diastolic BP 80 mmHg or higher"),
    Rule("diaBP", 90, "Diastolic BP 90 mmHg or higher"),
    Rule("diaBP", 100, "Diastolic BP 100 mmHg or higher"),
    Rule("BMI", 25, "BMI 25 or higher (overweight)"),
    Rule("BMI", 30, "BMI 30 or higher (obese)"),
    Rule("heartRate", 90, "Resting heart rate 90 bpm or higher"),
    Rule("glucose", 100, "Glucose 100 mg/dL or higher"),
    Rule("glucose", 126, "Glucose 126 mg/dL or higher"),
]


@lru_cache(maxsize=1)
def load_framingham_data() -> tuple[pd.DataFrame, pd.Series]:
    """Return (inputs, target). Rows with any missing input are dropped."""
    if not DATASET_PATH.exists():
        DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(DATASET_URL, DATASET_PATH)

    data = pd.read_csv(DATASET_PATH)
    data = data[[*INPUT_COLUMNS, TARGET_COLUMN]].dropna()

    X = data[INPUT_COLUMNS].astype(float).reset_index(drop=True)
    y = data[TARGET_COLUMN].astype(int).reset_index(drop=True)
    return X, y


def binarize(X: pd.DataFrame, rules: list[Rule] = CANDIDATE_RULES) -> pd.DataFrame:
    """Turn raw inputs into one 0/1 column per rule."""
    return pd.DataFrame(
        {rule.name: (X[rule.field] >= rule.threshold).astype(int) for rule in rules}
    )
