import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.framingham_dataset import INPUT_COLUMNS


client = TestClient(app)

PATIENT = {
    "male": 1,
    "age": 58,
    "currentSmoker": 1,
    "cigsPerDay": 15,
    "BPMeds": 0,
    "prevalentStroke": 0,
    "prevalentHyp": 1,
    "diabetes": 0,
    "totChol": 240,
    "sysBP": 150,
    "diaBP": 95,
    "BMI": 28,
    "heartRate": 80,
    "glucose": 90,
}


@pytest.mark.parametrize("model_name", ["xgboost", "random_forest", "neural_network", "logistic_regression"])
def test_predict_returns_risk_with_shap_and_lime(model_name):
    response = client.post("/framingham/models/predict", json={**PATIENT, "model_name": model_name})

    assert response.status_code == 200
    body = response.json()
    assert 0 <= body["risk"] <= 1
    assert [c["feature"] for c in body["shap"]["contributions"]] == INPUT_COLUMNS
    assert [c["feature"] for c in body["lime"]["contributions"]] == INPUT_COLUMNS

    # SHAP is additive: average prediction + contributions = this patient's prediction.
    shap = body["shap"]
    total = shap["base_value"] + sum(c["value"] for c in shap["contributions"])
    assert total == pytest.approx(shap["final_value"], abs=0.01)
    assert shap["final_value"] == body["risk"]


def test_predict_requires_every_input():
    patient = {**PATIENT, "glucose": None}

    response = client.post("/framingham/models/predict", json=patient)

    assert response.status_code == 422
    assert "glucose" in response.json()["detail"]


def test_metrics_compare_ml_models_with_the_score_card():
    response = client.get("/framingham/models/metrics")

    assert response.status_code == 200
    names = [row["model_name"] for row in response.json()["metrics"]]
    assert names == ["xgboost", "random_forest", "neural_network", "logistic_regression", "fasterrisk_card"]
