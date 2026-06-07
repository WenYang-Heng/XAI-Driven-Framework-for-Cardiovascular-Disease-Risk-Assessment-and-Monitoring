import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.schemas import ModelName
from app.services.risk_model import MODEL_ARTIFACT_DIR, train_and_save_model


MODEL_NAMES: tuple[ModelName, ...] = (
    "xgboost",
    "random_forest",
    "neural_network",
    "logistic_regression",
)


def main() -> None:
    MODEL_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    for model_name in MODEL_NAMES:
        print(f"Training {model_name}...")
        train_and_save_model(model_name)
        print(f"Saved {MODEL_ARTIFACT_DIR / f'{model_name}.pkl'}")


if __name__ == "__main__":
    main()
