from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.features import FEATURE_COLUMNS, validate_features
from app.main import app
from app.models import PredictionResponse
from app.services import clinical, ml_client, storage


client = TestClient(app)
CLINICIAN = str(uuid4())
OTHER_CLINICIAN = str(uuid4())


@pytest.fixture(autouse=True)
def in_memory_backend(monkeypatch):
    for name in ("DATABASE_URL", "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_NAME", "user", "password", "host", "dbname"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(storage, "SUPABASE_URL", "")
    for store in (
        storage._requests,
        storage._results,
        storage._patient_cases,
        storage._feedback,
        storage._activity_logs,
        storage._xai_explanations,
        storage._profiles,
        clinical._measurements,
    ):
        store.clear()
    monkeypatch.setattr(clinical, "_memory_default_model", "logistic_regression")

    calls: list[dict] = []

    async def fake_predict(payload: dict) -> PredictionResponse:
        calls.append(payload)
        contributions = [{"feature": feature, "value": 0.01} for feature in FEATURE_COLUMNS]
        return PredictionResponse(
            model_name=payload["model_name"],
            risk_score=0.24,
            predicted_class=1,
            risk_level="high",
            explanation=["Current smoking raises CHD risk."],
            model_version=f"framingham-chd10-{payload['model_name']}",
            xai={
                "shap": {"base_value": 0.15, "final_value": 0.24, "contributions": contributions},
                "lime": {"contributions": contributions},
                "summary": ["Summary."],
            },
        )

    async def fake_scores(features: dict) -> list[dict]:
        return [
            {"model_name": "logistic_regression", "risk_score": 0.24, "risk_level": "high"},
            {"model_name": "random_forest", "risk_score": 0.21, "risk_level": "high"},
            {"model_name": "xgboost", "risk_score": 0.09, "risk_level": "low"},
            {"model_name": "neural_network", "risk_score": 0.22, "risk_level": "high"},
        ]

    monkeypatch.setattr(ml_client, "predict", fake_predict)
    monkeypatch.setattr(ml_client, "predict_scores", fake_scores)
    return calls


def _create_patient(**overrides) -> dict:
    payload = {
        "clinician_id": CLINICIAN,
        "display_name": "Patient A",
        "date_of_birth": "1968-03-15",
        "sex": 1,
        "current_smoker": 1,
        "cigs_per_day": 20,
        "bp_meds": 0,
        "prevalent_stroke": 0,
        "prevalent_hyp": 1,
        "diabetes": 0,
        "history_source": "self_reported",
        **overrides,
    }
    response = client.post("/api/clinician/patients", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["patient"]


TODAY_READINGS = {"sys_bp": 150, "dia_bp": 95, "heart_rate": 80, "height_cm": 175, "weight_kg": 88, "tot_chol": 260, "glucose": 90}


def _assess(patient_case_id: str, **overrides) -> dict:
    response = client.post(
        f"/api/clinician/patients/{patient_case_id}/assessments",
        json={"clinician_id": CLINICIAN, "measurement": TODAY_READINGS, **overrides},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_prefill_reports_missing_readings_and_derives_age():
    patient = _create_patient()

    response = client.get(f"/api/clinician/patients/{patient['patient_case_id']}/prefill", params={"clinician_id": CLINICIAN})

    body = response.json()
    assert response.status_code == 200
    assert body["ready"] is False
    assert set(body["missing"]) == {"sys_bp", "dia_bp", "bmi", "heart_rate", "tot_chol", "glucose"}
    assert body["fields"]["age"]["value"] >= 58
    assert body["fields"]["current_smoker"]["source"] == "self_reported"


def test_assessment_uses_default_model_and_records_sources(in_memory_backend):
    patient = _create_patient()

    body = _assess(patient["patient_case_id"])

    sent = in_memory_backend[0]
    assert sent["model_name"] == "logistic_regression"
    assert set(sent) == {*FEATURE_COLUMNS, "model_name"}
    assert sent["bmi"] == 28.7
    assert body["inputs"]["ready"] is True
    assert body["inputs"]["fields"]["sys_bp"]["source"] == "clinician"
    assert body["model_agreement"]["agrees"] is False
    assert "disagree" in body["model_agreement"]["message"]
    stored = storage._requests[0]
    assert stored["feature_set"] == "framingham"
    assert stored["input_sources"]["current_smoker"]["source"] == "self_reported"
    assert stored["measurement_id"] is not None


def test_assessment_without_readings_returns_missing_fields():
    patient = _create_patient()

    response = client.post(
        f"/api/clinician/patients/{patient['patient_case_id']}/assessments",
        json={"clinician_id": CLINICIAN},
    )

    assert response.status_code == 422
    assert "Missing required fields" in response.json()["detail"][0]


def test_old_lab_results_are_flagged_stale():
    patient = _create_patient()
    two_years_ago = (datetime.now(UTC) - timedelta(days=730)).isoformat()
    client.post(
        f"/api/clinician/patients/{patient['patient_case_id']}/measurements",
        params={"clinician_id": CLINICIAN},
        json={"tot_chol": 210, "glucose": 88, "measured_at": two_years_ago, "source": "lab"},
    )
    client.post(
        f"/api/clinician/patients/{patient['patient_case_id']}/measurements",
        params={"clinician_id": CLINICIAN},
        json={"sys_bp": 128, "dia_bp": 82, "heart_rate": 70, "bmi": 24.5},
    )

    body = client.get(
        f"/api/clinician/patients/{patient['patient_case_id']}/prefill",
        params={"clinician_id": CLINICIAN},
    ).json()

    assert body["ready"] is True
    assert set(body["stale"]) == {"tot_chol", "glucose"}


def test_review_flow_moves_assessment_through_worklist():
    patient = _create_patient()
    result_id = _assess(patient["patient_case_id"])["result_id"]

    worklist = client.get("/api/clinician/worklist", params={"clinician_id": CLINICIAN}).json()
    assert worklist["counts"] == {"needs_review": 1, "high_risk_unreviewed": 1, "drafts": 0}

    no_action = client.put(
        f"/api/clinician/assessments/{result_id}/review",
        json={"clinician_id": CLINICIAN, "sign_off": True},
    )
    assert no_action.status_code == 422

    draft = client.put(
        f"/api/clinician/assessments/{result_id}/review",
        json={"clinician_id": CLINICIAN, "clinician_risk_level": "moderate", "flagged_features": ["heart_rate"]},
    )
    assert draft.status_code == 200
    assert client.get("/api/clinician/worklist", params={"clinician_id": CLINICIAN}).json()["counts"]["drafts"] == 1

    signed = client.put(
        f"/api/clinician/assessments/{result_id}/review",
        json={"clinician_id": CLINICIAN, "clinical_action": "lifestyle", "flagged_features": ["heart_rate"], "sign_off": True},
    )
    assert signed.status_code == 200
    assert signed.json()["review"]["review_status"] == "signed_off"
    assert len(storage._feedback) == 1

    edit_after_sign_off = client.put(
        f"/api/clinician/assessments/{result_id}/review",
        json={"clinician_id": CLINICIAN, "clinical_action": "refer"},
    )
    assert edit_after_sign_off.status_code == 409

    final = client.get("/api/clinician/worklist", params={"clinician_id": CLINICIAN}).json()
    assert final["counts"]["needs_review"] == 0
    assert final["recently_signed_off"][0]["clinical_action"] == "lifestyle"


def test_review_rejects_unknown_flagged_feature():
    patient = _create_patient()
    result_id = _assess(patient["patient_case_id"])["result_id"]

    response = client.put(
        f"/api/clinician/assessments/{result_id}/review",
        json={"clinician_id": CLINICIAN, "flagged_features": ["thalach"]},
    )

    assert response.status_code == 422


def test_other_clinician_cannot_open_patient():
    patient = _create_patient()

    response = client.get(f"/api/clinician/patients/{patient['patient_case_id']}", params={"clinician_id": OTHER_CLINICIAN})

    assert response.status_code == 404


def test_patient_page_returns_timeline():
    patient = _create_patient()
    _assess(patient["patient_case_id"], visit_label="Visit 1")
    _assess(patient["patient_case_id"], visit_label="Visit 2")

    body = client.get(f"/api/clinician/patients/{patient['patient_case_id']}", params={"clinician_id": CLINICIAN}).json()

    assert [row["visit_label"] for row in body["assessments"]] == ["Visit 2", "Visit 1"]
    assert len(body["measurements"]) == 2
    listing = client.get("/api/clinician/patients", params={"clinician_id": CLINICIAN, "q": "patient a"}).json()
    assert listing["items"][0]["latest_risk_level"] == "high"


def test_admin_default_model_is_used_for_new_assessments(in_memory_backend):
    response = client.put("/api/admin/models/default", json={"model_name": "xgboost"})
    assert response.status_code == 200
    models = client.get("/api/admin/models").json()
    assert models["default_model"] == "xgboost"

    patient = _create_patient()
    _assess(patient["patient_case_id"])

    assert in_memory_backend[-1]["model_name"] == "xgboost"


def test_duplicate_patient_reference_is_rejected():
    _create_patient(patient_reference_id="CASE-2026-0100")

    response = client.post(
        "/api/clinician/patients",
        json={"clinician_id": CLINICIAN, "patient_reference_id": "case-2026-0100"},
    )

    assert response.status_code == 409


def test_legacy_prediction_endpoint_accepts_framingham_payload(in_memory_backend):
    payload = {
        "model_name": "random_forest",
        "sex": 0,
        "age": 50,
        "current_smoker": 0,
        "cigs_per_day": 0,
        "bp_meds": 0,
        "prevalent_stroke": 0,
        "prevalent_hyp": 0,
        "diabetes": 0,
        "tot_chol": 200,
        "sys_bp": 120,
        "dia_bp": 80,
        "bmi": 23,
        "heart_rate": 70,
        "glucose": 80,
    }

    response = client.post("/api/predictions", json=payload)

    assert response.status_code == 200, response.text
    assert in_memory_backend[-1]["model_name"] == "random_forest"
    assert storage._requests[-1]["feature_set"] == "framingham"


def test_validate_features_catches_inconsistent_smoking():
    values = {feature: 0 for feature in FEATURE_COLUMNS} | {
        "age": 50, "tot_chol": 200, "sys_bp": 120, "dia_bp": 80, "bmi": 23, "heart_rate": 70, "glucose": 80,
        "cigs_per_day": 10,
    }

    assert validate_features(values) == ["cigs_per_day must be 0 when current_smoker is 0."]
