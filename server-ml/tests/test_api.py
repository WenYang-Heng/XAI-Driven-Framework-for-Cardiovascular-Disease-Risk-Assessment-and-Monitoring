import io

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import (
    BatchPredictionResponse,
    BatchPredictionRowResult,
    BatchPredictionSummary,
    DatasetSummary,
    ModelInfo,
    ModelListResponse,
    ModelMetricsResponse,
    RiskPredictionResponse,
)


client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "server-ml"}


def test_dataset_summary_returns_metadata(monkeypatch):
    from app.routers import dataset

    monkeypatch.setattr(
        dataset,
        "get_dataset_summary",
        lambda: DatasetSummary(
            dataset_id=45,
            dataset_name="UCI Heart Disease",
            input_features=["age"],
            target="num",
            rows_after_cleaning=297,
        ),
    )

    response = client.get("/dataset/summary")

    assert response.status_code == 200
    assert response.json()["dataset_id"] == 45


def test_models_returns_four_models(monkeypatch):
    from app.routers import predict

    monkeypatch.setattr(
        predict,
        "list_models",
        lambda: ModelListResponse(
            models=[
                ModelInfo(name="xgboost", display_name="XGBoost", description=""),
                ModelInfo(name="random_forest", display_name="Random Forest", description=""),
                ModelInfo(name="neural_network", display_name="Neural Network", description=""),
                ModelInfo(name="logistic_regression", display_name="Logistic Regression", description=""),
            ]
        ),
    )

    response = client.get("/models")

    assert response.status_code == 200
    assert len(response.json()["models"]) == 4


def test_predict_returns_risk_score(monkeypatch):
    from app.routers import predict

    monkeypatch.setattr(
        predict,
        "predict_risk",
        lambda request: RiskPredictionResponse(
            model_name=request.model_name,
            risk_score=0.68,
            predicted_class=1,
            risk_level="moderate",
            explanation=["Rule-based explanation."],
            model_version="uci-heart-logistic_regression",
        ),
    )

    response = client.post("/predict", json=_prediction_payload())

    assert response.status_code == 200
    assert response.json()["risk_score"] == 0.68
    assert response.json()["predicted_class"] == 1


def test_model_metrics_returns_metrics(monkeypatch):
    from app.routers import predict

    monkeypatch.setattr(
        predict,
        "get_model_metrics",
        lambda model_name: ModelMetricsResponse(
            model_name=model_name,
            accuracy=0.85,
            precision=0.84,
            sensitivity_recall=0.83,
            specificity=0.86,
            f1_score=0.835,
            auc_roc=0.88,
            confusion_matrix={
                "true_negative": 20,
                "false_positive": 5,
                "false_negative": 4,
                "true_positive": 25,
            },
        ),
    )

    response = client.get("/models/logistic_regression/metrics")

    assert response.status_code == 200
    assert response.json()["accuracy"] == 0.85


def test_batch_rejects_unsupported_file_type():
    response = client.post(
        "/predict/batch",
        data={"model_name": "random_forest"},
        files={"file": ("upload.txt", b"bad", "text/plain")},
    )

    assert response.status_code == 400


def test_batch_handles_valid_csv(monkeypatch):
    from app.routers import batch

    monkeypatch.setattr(
        batch,
        "predict_batch",
        lambda df, model_name: BatchPredictionResponse(
            model_name=model_name,
            summary=BatchPredictionSummary(total_rows=1, successful_rows=1, failed_rows=0),
            results=[
                BatchPredictionRowResult(
                    row_number=1,
                    risk_score=0.72,
                    predicted_class=1,
                    risk_level="high",
                    explanation=["Rule-based explanation."],
                    model_version="uci-heart-random_forest",
                    status="success",
                )
            ],
        ),
    )

    response = client.post(
        "/predict/batch",
        data={"model_name": "random_forest"},
        files={"file": ("upload.csv", _csv_bytes(), "text/csv")},
    )

    assert response.status_code == 200
    assert response.json()["summary"]["successful_rows"] == 1


def test_batch_returns_failed_row_for_invalid_values(monkeypatch):
    from app.routers import batch

    monkeypatch.setattr(
        batch,
        "predict_batch",
        lambda df, model_name: BatchPredictionResponse(
            model_name=model_name,
            summary=BatchPredictionSummary(total_rows=1, successful_rows=0, failed_rows=1),
            results=[
                BatchPredictionRowResult(
                    row_number=1,
                    status="failed",
                    error_message="age must be greater than or equal to 0",
                )
            ],
        ),
    )

    response = client.post(
        "/predict/batch",
        data={"model_name": "random_forest"},
        files={"file": ("upload.csv", _csv_bytes(age=-1), "text/csv")},
    )

    assert response.status_code == 200
    assert response.json()["results"][0]["status"] == "failed"


def _prediction_payload() -> dict:
    return {
        "model_name": "logistic_regression",
        "age": 55,
        "sex": 1,
        "cp": 4,
        "trestbps": 145,
        "chol": 220,
        "fbs": 0,
        "restecg": 1,
        "thalach": 150,
        "exang": 1,
        "oldpeak": 1.4,
        "slope": 2,
        "ca": 0,
        "thal": 7,
    }


def _csv_bytes(age: int = 55) -> bytes:
    data = pd.DataFrame([{**_prediction_payload(), "age": age}]).drop(columns=["model_name"])
    buffer = io.StringIO()
    data.to_csv(buffer, index=False)
    return buffer.getvalue().encode()
