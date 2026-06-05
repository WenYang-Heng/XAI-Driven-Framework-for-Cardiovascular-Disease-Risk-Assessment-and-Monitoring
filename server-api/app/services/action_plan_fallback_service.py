from typing import Any

from app.models import ActionPlanPayload


def generate_fallback_plan(assessment: dict[str, Any], assessment_input: dict[str, Any]) -> ActionPlanPayload:
    risk_category = assessment.get("risk_category", "moderate")
    items: list[dict[str, Any]] = []

    if assessment_input.get("activity_level") == "low":
        items.append(
            {
                "title": "Start with short beginner activity sessions",
                "priority": "high",
                "factor": "Physical activity",
                "difficulty": "easy",
                "reason": "Low activity can affect blood pressure, weight, glucose control, and long-term heart health.",
                "timeframe": "3 times per week",
                "specific_examples": ["10-minute walking", "chair exercises", "gentle stretching", "beginner strength exercises"],
                "next_step": "Pick three days this week and walk for 10 minutes after a meal.",
                "barrier_plan": "If walking outside is difficult, do chair exercises or stretching at home for 10 minutes.",
                "measure": "Number of short activity sessions completed",
            }
        )

    if _high_cholesterol(assessment_input):
        items.append(
            {
                "title": "Add one fibre-rich food each day",
                "priority": "high",
                "factor": "Cholesterol",
                "difficulty": "easy",
                "reason": "Fibre-rich foods can support healthier cholesterol patterns over time.",
                "timeframe": "Next 7 days",
                "specific_examples": ["oats", "beans", "lentils", "chickpeas", "fruits", "vegetables", "whole grains"],
                "next_step": "Choose one fibre-rich food and add it to breakfast or lunch tomorrow.",
                "barrier_plan": "If cooking is difficult, start with fruit, oats, or wholegrain bread.",
                "measure": "Number of fibre-rich meals completed",
            }
        )

    if _high_blood_pressure(assessment_input):
        items.append(
            {
                "title": "Make two lower-salt swaps",
                "priority": "high",
                "factor": "Blood pressure",
                "difficulty": "moderate",
                "reason": "Lower-salt choices can help reduce strain related to blood pressure.",
                "timeframe": "This week",
                "specific_examples": ["reduce sauces", "choose less processed food", "check labels", "ask for gravy separately"],
                "next_step": "Choose one meal today and reduce sauce, gravy, or processed sides.",
                "barrier_plan": "If eating outside, ask for sauces separately and use half the usual amount.",
                "measure": "Number of lower-salt meals completed",
            }
        )

    if assessment_input.get("smoking_status") == "yes":
        items.append(
            {
                "title": "Replace one smoking trigger moment",
                "priority": "high",
                "factor": "Smoking",
                "difficulty": "hard",
                "reason": "Reducing nicotine exposure supports heart and blood vessel health.",
                "timeframe": "Next 7 days",
                "specific_examples": ["delay by 10 minutes", "drink water", "short walk", "deep breathing", "message a support person"],
                "next_step": "Pick one common trigger and replace it with a 10-minute delay routine.",
                "barrier_plan": "If cravings are strong, use professional support or a quitline rather than relying on willpower alone.",
                "measure": "Number of trigger moments delayed or replaced",
            }
        )

    if risk_category == "high":
        items.append(
            {
                "title": "Arrange a professional follow-up",
                "priority": "high",
                "factor": "High risk result",
                "difficulty": "moderate",
                "reason": "A high screening result should be discussed with a healthcare professional for proper interpretation.",
                "timeframe": "Next 7 days",
                "specific_examples": ["clinic appointment", "bring recent readings", "prepare questions", "review risk factors"],
                "next_step": "Book or plan a follow-up and bring your assessment result.",
                "barrier_plan": "If appointments are difficult, ask about phone, community clinic, or pharmacy options.",
                "measure": "Follow-up appointment planned",
            }
        )

    if assessment.get("missing_inputs"):
        items.append(
            {
                "title": "Record missing health values",
                "priority": "medium",
                "factor": "Assessment confidence",
                "difficulty": "easy",
                "reason": "Unknown values lower confidence in the assessment result.",
                "timeframe": "Next 14 days",
                "specific_examples": ["blood pressure reading", "cholesterol result", "diabetes status", "weight category"],
                "next_step": "Choose one missing value and record it from a home reading, clinic report, or check-up.",
                "barrier_plan": "If you cannot get the value now, mark it as unknown and update it after your next check-up.",
                "measure": "Missing values recorded",
            }
        )

    if not items:
        items.append(
            {
                "title": "Keep a simple heart-health routine",
                "priority": "medium",
                "factor": "Prevention",
                "difficulty": "easy",
                "reason": "Small consistent habits can support long-term cardiovascular health.",
                "timeframe": "This week",
                "specific_examples": ["10-minute walk", "fruit snack", "water instead of sugary drink", "sleep routine"],
                "next_step": "Choose one small heart-friendly action and repeat it three times this week.",
                "barrier_plan": "If the week is busy, do the smallest version for five minutes.",
                "measure": "Heart-health actions completed",
            }
        )

    if len(items) < 2:
        items.append(
            {
                "title": "Track one heart-health habit",
                "priority": "low",
                "factor": "Monitoring",
                "difficulty": "easy",
                "reason": "Tracking one small habit makes the action plan easier to follow and review.",
                "timeframe": "This week",
                "specific_examples": ["walks completed", "fibre-rich meals", "lower-salt meals", "blood pressure readings"],
                "next_step": "Choose one habit and mark it once each time you complete it this week.",
                "barrier_plan": "If tracking feels tedious, use a simple phone note or calendar tick.",
                "measure": "Habit check-ins completed",
            }
        )

    return ActionPlanPayload(
        title=f"{risk_category.title()} Risk Action Plan",
        summary="A practical plan focused on specific, measurable steps based on the latest assessment.",
        items=items[:5],
        disclaimer="This plan supports health awareness and does not replace medical advice, diagnosis, or prescribed treatment.",
    )


def _high_cholesterol(assessment_input: dict[str, Any]) -> bool:
    category = assessment_input.get("cholesterol_category")
    value = assessment_input.get("total_cholesterol")
    return category == "high" or (value is not None and float(value) >= 240)


def _high_blood_pressure(assessment_input: dict[str, Any]) -> bool:
    category = assessment_input.get("bp_category")
    value = assessment_input.get("systolic_bp")
    return category in {"above_normal", "well_above_normal"} or (value is not None and float(value) >= 130)
