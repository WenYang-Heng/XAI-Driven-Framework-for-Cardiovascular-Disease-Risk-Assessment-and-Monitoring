import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import ModelMetricsListResponse, PredictionResponse
from app.services import ml_client, storage


client = TestClient(app)

FEATURES = {
    "age": 67, "sex": 0, "cp": 4, "trestbps": 160, "chol": 286, "fbs": 1, "restecg": 2,
    "thalach": 108, "exang": 1, "oldpeak": 1.5, "slope": 2, "ca": 3, "thal": 3,
}
USER_ID = "11111111-1111-1111-1111-111111111111"


def _metrics(model_name: str, auc: float) -> dict:
    return {
        "model_name": model_name, "accuracy": 0.85, "precision": 0.84, "sensitivity_recall": 0.82,
        "specificity": 0.88, "f1_score": 0.83, "auc_roc": auc,
        "confusion_matrix": {"true_negative": 28, "false_positive": 4, "false_negative": 5, "true_positive": 23},
    }


def _offline(*args, **kwargs):
    raise httpx.ConnectError("server-ml down")


@pytest.fixture(autouse=True)
def reset_store():
    for store in (storage._requests, storage._results, storage._activity_logs, storage._model_metric_snapshots, storage._profiles):
        store.clear()


@pytest.fixture
def ml_online(monkeypatch):
    async def metrics():
        return ModelMetricsListResponse(metrics=[_metrics("xgboost", 0.93), _metrics("logistic_regression", 0.80)])

    async def fairness(model_name):
        return {"model_name": model_name, "attributes": []}

    async def drift(records):
        return {"current_size": len(records), "features": [], "trend": []}

    monkeypatch.setattr(ml_client, "get_all_model_metrics", metrics)
    monkeypatch.setattr(ml_client, "get_fairness", fairness)
    monkeypatch.setattr(ml_client, "compute_drift", drift)


@pytest.fixture
def ml_offline(monkeypatch):
    for name in ("get_all_model_metrics", "get_fairness", "compute_drift"):
        monkeypatch.setattr(ml_client, name, _offline)


def _make_prediction(monkeypatch, risk_level: str = "high"):
    async def predict(payload):
        return PredictionResponse(
            model_name="xgboost", risk_score=0.81, predicted_class=1, risk_level=risk_level,
            explanation=[], model_version="uci-heart-xgboost",
            xai={
                "shap": {"base_value": 0.4, "final_value": 0.81, "contributions": []},
                "lime": {"contributions": []},
                "summary": [],
            },
        )

    monkeypatch.setattr(ml_client, "predict", predict)
    response = client.post("/api/predictions", json={"user_id": USER_ID, "model_name": "xgboost", **FEATURES})
    assert response.status_code == 200, response.text


def test_overview_counts_assessments_by_risk_and_day(monkeypatch):
    _make_prediction(monkeypatch, "high")
    _make_prediction(monkeypatch, "low")

    body = client.get("/api/admin/overview?days=7").json()

    assert body["totals"]["assessments"] == 2
    assert body["totals"]["high_risk"] == 1
    assert body["totals"]["active_users"] == 1
    assert len(body["daily"]) == 7
    assert body["daily"][-1]["total"] == 2
    assert {row["risk_level"]: row["count"] for row in body["risk_distribution"]} == {"low": 1, "moderate": 0, "high": 1}


def test_performance_flags_models_against_nfr_targets(ml_online):
    body = client.get("/api/admin/performance").json()

    verdicts = {model["model_name"]: model["meets_targets"] for model in body["models"]}
    assert verdicts == {"xgboost": True, "logistic_regression": False}
    assert body["source"] == "live"


def test_metric_snapshots_are_not_duplicated_on_refresh(ml_online):
    client.get("/api/admin/performance")
    client.get("/api/admin/performance")

    assert len(storage._model_metric_snapshots) == 2


def test_performance_falls_back_to_snapshot_then_reports_unavailable(ml_online, monkeypatch):
    client.get("/api/admin/performance")
    monkeypatch.setattr(ml_client, "get_all_model_metrics", _offline)

    assert client.get("/api/admin/performance").json()["source"] == "snapshot"

    storage._model_metric_snapshots.clear()
    response = client.get("/api/admin/performance")
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"]


def test_drift_without_baseline_still_returns_volume(ml_offline):
    body = client.get("/api/admin/drift?days=7").json()

    assert body["drift_available"] is False
    assert "cannot be calculated" in body["message"]
    assert len(body["volume"]) == 7


def test_fairness_includes_live_parity(monkeypatch, ml_online):
    _make_prediction(monkeypatch, "high")

    body = client.get("/api/admin/fairness?model_name=xgboost").json()

    female = next(row for row in body["live_parity"] if row["group"] == "Female")
    assert female["assessments"] == 1
    assert female["high_risk_rate"] == 1.0


def test_activity_log_records_logins_and_filters_by_category(monkeypatch):
    client.post("/api/activity/login", json={"user_id": USER_ID})
    _make_prediction(monkeypatch)

    auth_logs = client.get("/api/admin/activity-logs?category=auth").json()
    assert [item["action"] for item in auth_logs["items"]] == ["USER_LOGIN"]

    all_logs = client.get("/api/admin/activity-logs").json()
    assert all_logs["total"] == 3


def test_failed_prediction_is_logged_as_failure(monkeypatch):
    monkeypatch.setattr(ml_client, "predict", _offline)

    response = client.post("/api/predictions", json={"user_id": USER_ID, "model_name": "xgboost", **FEATURES})

    assert response.status_code == 502
    failed = client.get("/api/admin/activity-logs?status=failed").json()["items"]
    assert [item["action"] for item in failed] == ["PREDICTION_REQUEST_FAILED"]


def test_report_is_partial_when_a_source_is_unavailable(ml_offline):
    response = client.post("/api/admin/reports", json={"sections": ["activity", "drift"], "days": 7})

    body = response.json()
    assert response.status_code == 200
    assert body["partial"] is True
    assert [gap["section"] for gap in body["unavailable"]] == ["drift"]
    assert "activity" in body["sections"]
    assert storage._activity_logs[-1]["action"] == "GENERATE_MONITORING_REPORT"


def test_report_fails_and_is_logged_when_nothing_can_be_compiled(ml_offline):
    response = client.post("/api/admin/reports", json={"sections": ["performance"]})

    assert response.status_code == 503
    assert storage._activity_logs[-1]["action"] == "REPORT_GENERATION_FAILED"
