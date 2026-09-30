import sys
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import httpx

from app.schemas import ModelName
from app.services.dataset import DATASET_NAME
from app.services.risk_model import MODEL_ARTIFACT_DIR, MODEL_VERSION_PREFIX, get_model_metrics, train_and_save_model


MODEL_NAMES: tuple[ModelName, ...] = (
    "xgboost",
    "random_forest",
    "neural_network",
    "logistic_regression",
)


def _supabase_settings() -> tuple[str, str]:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")
    return supabase_url, service_key


def _metrics_payload(model_name: ModelName) -> dict[str, Any]:
    metrics = get_model_metrics(model_name).model_dump(mode="json")
    return {
        "model_version": f"{MODEL_VERSION_PREFIX}-{model_name}",
        "dataset_name": DATASET_NAME,
        "accuracy": metrics["accuracy"],
        "precision": metrics["precision"],
        "sensitivity_recall": metrics["sensitivity_recall"],
        "specificity": metrics["specificity"],
        "f1_score": metrics["f1_score"],
        "auc_roc": metrics["auc_roc"],
        "confusion_matrix": metrics["confusion_matrix"],
        "metrics_updated_at": datetime.now(UTC).isoformat(),
    }


def _save_metrics_to_supabase(model_name: ModelName, payload: dict[str, Any]) -> bool:
    supabase_url, service_key = _supabase_settings()
    if not supabase_url or not service_key:
        print("Skipped database update: SUPABASE_URL and service role key are not configured.")
        return False

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    response = httpx.patch(
        f"{supabase_url}/rest/v1/ml_models",
        params={"model_name": f"eq.{model_name}"},
        headers=headers,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    if not response.json():
        print(f"Warning: no ml_models row found for {model_name}; metrics were not saved.")
        return False

    return True


def main() -> None:
    MODEL_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    for model_name in MODEL_NAMES:
        print(f"Training {model_name}...")
        train_and_save_model(model_name)
        print(f"Saved {MODEL_ARTIFACT_DIR / f'{model_name}.pkl'}")
        payload = _metrics_payload(model_name)
        if _save_metrics_to_supabase(model_name, payload):
            print(f"Updated ml_models metrics for {model_name}")


if __name__ == "__main__":
    main()
