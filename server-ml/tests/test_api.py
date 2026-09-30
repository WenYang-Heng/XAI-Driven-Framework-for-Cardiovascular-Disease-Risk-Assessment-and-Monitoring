import io

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import (
    BatchPredictionResponse,
    BatchPredictionRowResult,
    BatchPredictionSummary,
    DatasetSummary,
    FeatureContribution,
    GlobalShapFeatureImportance,
    GlobalShapResponse,
    LimeExplanation,
    ModelInfo,
    ModelListResponse,
    ModelMetricsResponse,
    RiskPredictionResponse,
    ShapExplanation,
    XaiExplanation,
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
            dataset_name="Framingham Heart Study",
            input_features=["age"],
            target="ten_year_chd",
            rows=4240,
            positive_rate=0.152,
            missing_values={"glucose": 388},
        ),
    )

    response = client.get("/dataset/summary")

    assert response.status_code == 200
    assert response.json()["rows"] == 4240


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
            xai=_xai_payload(0.68),
        ),
    )

    response = client.post("/predict", json=_prediction_payload())

    assert response.status_code == 200
    assert response.json()["risk_score"] == 0.68
    assert response.json()["predicted_class"] == 1
    assert len(response.json()["xai"]["shap"]["contributions"]) == 14
    assert len(response.json()["xai"]["lime"]["contributions"]) == 14
    assert response.json()["xai"]["summary"]


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
            brier_score=0.12,
            decision_threshold=0.2,
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


def test_global_shap_returns_ranked_feature_importance(monkeypatch):
    from app.routers import predict

    monkeypatch.setattr(
        predict,
        "compute_global_shap",
        lambda model_name: GlobalShapResponse(
            model_name=model_name,
            dataset_name="Framingham Heart Study",
            samples_explained=297,
            explainer_type="TreeExplainer",
            feature_importance=[
                GlobalShapFeatureImportance(
                    feature="sys_bp",
                    display_name="Systolic Blood Pressure",
                    mean_abs_shap=0.21,
                    rank=1,
                ),
                GlobalShapFeatureImportance(
                    feature="age",
                    display_name="Age",
                    mean_abs_shap=0.11,
                    rank=2,
                ),
                *[
                    GlobalShapFeatureImportance(
                        feature=f"feature_{index}",
                        display_name=f"Feature {index}",
                        mean_abs_shap=round(0.1 - index * 0.001, 6),
                        rank=index + 3,
                    )
                    for index in range(11)
                ],
            ],
            beeswarm_data=None,
            dependence_data=None,
            summary_text="The model is most influenced by ST Depression.",
            generation_status="completed",
            error_message=None,
        ),
    )

    response = client.post("/explanations/global-shap", json={"model_name": "random_forest"})

    assert response.status_code == 200
    payload = response.json()
    values = [item["mean_abs_shap"] for item in payload["feature_importance"]]
    ranks = [item["rank"] for item in payload["feature_importance"]]

    assert payload["generation_status"] == "completed"
    assert payload["samples_explained"] == 297
    assert payload["beeswarm_data"] is None
    assert payload["dependence_data"] is None
    assert len(payload["feature_importance"]) == 13
    assert values == sorted(values, reverse=True)
    assert ranks == list(range(1, 14))


def test_global_shap_supports_neural_network_kernel_explainer(monkeypatch):
    from app.routers import predict

    monkeypatch.setattr(
        predict,
        "compute_global_shap",
        lambda model_name: GlobalShapResponse(
            model_name=model_name,
            dataset_name="Framingham Heart Study",
            samples_explained=297,
            explainer_type="KernelExplainer",
            feature_importance=[
                GlobalShapFeatureImportance(
                    feature="sys_bp",
                    display_name="Systolic Blood Pressure",
                    mean_abs_shap=0.21,
                    rank=1,
                )
            ],
            beeswarm_data=None,
            dependence_data=None,
            summary_text="The model is most influenced by ST Depression.",
            generation_status="completed",
            error_message=None,
        ),
    )

    response = client.post("/explanations/global-shap", json={"model_name": "neural_network"})

    assert response.status_code == 200
    assert response.json()["generation_status"] == "completed"
    assert response.json()["explainer_type"] == "KernelExplainer"
    assert response.json()["feature_importance"][0]["rank"] == 1


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
                    xai=_xai_payload(0.72),
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
    assert len(response.json()["results"][0]["xai"]["shap"]["contributions"]) == 14


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
                    error_message="age must be greater than or equal to 18",
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
        "sex": 1,
        "age": 55,
        "current_smoker": 1,
        "cigs_per_day": 10,
        "bp_meds": 0,
        "prevalent_stroke": 0,
        "prevalent_hyp": 1,
        "diabetes": 0,
        "tot_chol": 240,
        "sys_bp": 145,
        "dia_bp": 90,
        "bmi": 27.5,
        "heart_rate": 75,
        "glucose": 85,
    }


def _csv_bytes(age: int = 55) -> bytes:
    data = pd.DataFrame([{**_prediction_payload(), "age": age}]).drop(columns=["model_name"])
    buffer = io.StringIO()
    data.to_csv(buffer, index=False)
    return buffer.getvalue().encode()


def _xai_payload(final_value: float) -> XaiExplanation:
    contributions = [
        FeatureContribution(feature=feature, value=0.0)
        for feature in [
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
    ]
    return XaiExplanation(
        shap=ShapExplanation(base_value=0.5, final_value=final_value, contributions=contributions),
        lime=LimeExplanation(contributions=contributions),
        summary=["Rule-based XAI summary."],
    )


def test_framingham_dataset_loads_expected_shape():
    from app.services.dataset import FEATURE_COLUMNS, load_heart_disease_data

    X, y = load_heart_disease_data()

    assert list(X.columns) == FEATURE_COLUMNS
    assert len(X) == 4240
    assert set(y.unique()) == {0, 1}


def test_risk_bands_use_ten_year_thresholds():
    from app.services.risk_model import _risk_level

    assert _risk_level(0.05) == "low"
    assert _risk_level(0.10) == "moderate"
    assert _risk_level(0.19) == "moderate"
    assert _risk_level(0.20) == "high"


def test_explanation_flags_age_outside_training_range():
    from app.schemas import RiskPredictionRequest
    from app.services.risk_model import _build_explanation

    payload = {**_prediction_payload(), "age": 80}
    explanation = _build_explanation(RiskPredictionRequest(**payload))

    assert any("extrapolation" in line for line in explanation)
