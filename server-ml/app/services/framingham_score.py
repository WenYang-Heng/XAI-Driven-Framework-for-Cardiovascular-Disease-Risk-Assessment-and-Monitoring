"""Score patients with the saved Framingham FasterRisk score card.

How a score card works:
  1. Each line on the card is a yes/no rule ("field >= threshold") worth some points.
  2. Add up the points for every rule the patient meets -> total points.
  3. Convert total points to a probability:
         risk = 1 / (1 + exp(-(intercept + total_points) / multiplier))

The card is produced by scripts/train_framingham_score.py.
"""

import json
import math
from functools import lru_cache
from pathlib import Path

from app.schemas import (
    FraminghamRiskRequest,
    FraminghamRiskResponse,
    FraminghamScoreCardResponse,
    ScoreCardItem,
    ScoreCardLine,
    ScoreToRisk,
)


SCORE_CARD_PATH = Path(__file__).resolve().parents[1] / "score_cards" / "framingham.json"

# Common cut-offs for 10-year cardiovascular risk.
LOW_RISK_BELOW = 0.10
HIGH_RISK_FROM = 0.20


@lru_cache(maxsize=1)
def load_score_card() -> dict:
    if not SCORE_CARD_PATH.exists():
        raise FileNotFoundError(
            f"No score card at {SCORE_CARD_PATH}. Run scripts/train_framingham_score.py first."
        )
    return json.loads(SCORE_CARD_PATH.read_text())


def points_to_risk(total_points: int, card: dict) -> float:
    return 1 / (1 + math.exp(-(card["intercept"] + total_points) / card["multiplier"]))


def card_risks(X, card: dict):
    """Score many patients at once (X is a DataFrame of raw inputs)."""
    total_points = sum(item["points"] * (X[item["field"]] >= item["threshold"]) for item in card["items"])
    return 1 / (1 + (-(card["intercept"] + total_points) / card["multiplier"]).map(math.exp))


def risk_level(risk: float) -> str:
    if risk < LOW_RISK_BELOW:
        return "low"
    if risk < HIGH_RISK_FROM:
        return "moderate"
    return "high"


def score_to_risk_table(card: dict) -> list[ScoreToRisk]:
    """Risk for every total a patient could get, from lowest to highest."""
    points = [item["points"] for item in card["items"]]
    lowest = sum(p for p in points if p < 0)
    highest = sum(p for p in points if p > 0)
    return [
        ScoreToRisk(total_points=total, risk=round(points_to_risk(total, card), 4))
        for total in range(lowest, highest + 1)
    ]


def get_score_card() -> FraminghamScoreCardResponse:
    card = load_score_card()
    return FraminghamScoreCardResponse(
        name=card["name"],
        description=card["description"],
        dataset=card["dataset"],
        outcome=card["outcome"],
        intercept=card["intercept"],
        multiplier=card["multiplier"],
        items=[ScoreCardItem(**item) for item in card["items"]],
        score_to_risk=score_to_risk_table(card),
        metrics=card["metrics"],
    )


def predict_framingham_risk(request: FraminghamRiskRequest) -> FraminghamRiskResponse:
    card = load_score_card()
    inputs = request.model_dump()

    # Only the fields the card actually uses are required.
    missing = sorted({item["field"] for item in card["items"] if inputs[item["field"]] is None})
    if missing:
        raise ValueError(f"Missing inputs required by the score card: {', '.join(missing)}")

    breakdown = [
        ScoreCardLine(**item, applies=inputs[item["field"]] >= item["threshold"])
        for item in card["items"]
    ]
    total_points = sum(line.points for line in breakdown if line.applies)
    risk = points_to_risk(total_points, card)

    return FraminghamRiskResponse(
        total_points=total_points,
        risk=round(risk, 4),
        risk_level=risk_level(risk),
        breakdown=breakdown,
    )


def print_score_card(card: dict) -> None:
    """Print the card in a human-readable form (used by the training script)."""
    print("Framingham 10-year CHD risk score card")
    print("-" * 60)
    for number, item in enumerate(card["items"], start=1):
        print(f"{number:>2}. {item['label']:<45} {item['points']:+d} points")
    print("-" * 60)
    print("Total points -> 10-year CHD risk")
    for row in score_to_risk_table(card):
        print(f"{row.total_points:>4} -> {row.risk:6.1%}")
