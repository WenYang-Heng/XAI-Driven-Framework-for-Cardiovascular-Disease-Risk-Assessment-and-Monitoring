import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import framingham_score
from app.services.framingham_dataset import Rule, binarize


client = TestClient(app)

# A small hand-made card so the tests do not depend on the trained values.
TEST_CARD = {
    "name": "test-card",
    "description": "Card used in tests",
    "dataset": "Framingham Heart Study",
    "outcome": "10-year CHD",
    "intercept": -6.0,
    "multiplier": 2.0,
    "items": [
        {"field": "male", "threshold": 1, "label": "Male", "points": 2},
        {"field": "age", "threshold": 55, "label": "Age 55 or older", "points": 3},
        {"field": "sysBP", "threshold": 140, "label": "Systolic BP 140 mmHg or higher", "points": 1},
    ],
    "metrics": {"train_auc": 0.7, "test_auc": 0.7},
}


@pytest.fixture(autouse=True)
def use_test_card(monkeypatch):
    monkeypatch.setattr(framingham_score, "load_score_card", lambda: TEST_CARD)


def test_binarize_creates_one_yes_no_column_per_rule():
    X = pd.DataFrame({"age": [40, 60], "sysBP": [150, 120]})
    rules = [Rule("age", 55, "Age 55 or older"), Rule("sysBP", 140, "Systolic BP 140+")]

    binary = binarize(X, rules)

    assert list(binary.columns) == ["age>=55", "sysBP>=140"]
    assert binary.to_dict("list") == {"age>=55": [0, 1], "sysBP>=140": [1, 0]}


def test_predict_adds_points_for_rules_the_patient_meets():
    response = client.post("/framingham/predict", json={"male": 1, "age": 60, "sysBP": 130})

    assert response.status_code == 200
    body = response.json()
    assert body["total_points"] == 5  # male (2) + age 55+ (3); BP below 140
    assert [line["applies"] for line in body["breakdown"]] == [True, True, False]
    # risk = 1 / (1 + exp(-(-6 + 5) / 2))
    assert body["risk"] == pytest.approx(0.3775, abs=1e-4)
    assert body["risk_level"] == "high"


def test_predict_low_risk_patient():
    body = client.post("/framingham/predict", json={"male": 0, "age": 40, "sysBP": 110}).json()

    assert body["total_points"] == 0
    assert body["risk"] == pytest.approx(0.0474, abs=1e-4)
    assert body["risk_level"] == "low"


def test_predict_rejects_missing_inputs_the_card_needs():
    response = client.post("/framingham/predict", json={"male": 1})

    assert response.status_code == 422
    assert response.json()["detail"] == "Missing inputs required by the score card: age, sysBP"


def test_score_card_lists_risk_for_every_possible_total():
    response = client.get("/framingham/score-card")

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 3
    assert [row["total_points"] for row in body["score_to_risk"]] == [0, 1, 2, 3, 4, 5, 6]
    risks = [row["risk"] for row in body["score_to_risk"]]
    assert risks == sorted(risks)


def test_saved_score_card_is_valid(monkeypatch):
    monkeypatch.undo()  # read the real card produced by the training script
    framingham_score.load_score_card.cache_clear()

    card = framingham_score.get_score_card()

    assert card.items
    assert all(-5 <= item.points <= 5 for item in card.items)
