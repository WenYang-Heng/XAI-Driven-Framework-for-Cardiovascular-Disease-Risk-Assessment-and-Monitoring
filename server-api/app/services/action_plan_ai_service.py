import json
import os
from typing import Any

from app.models import ActionPlanPayload


DEFAULT_ACTION_PLAN_MODEL = "gpt-4.1-mini"


def action_plan_model() -> str:
    return os.getenv("OPENAI_ACTION_PLAN_MODEL", DEFAULT_ACTION_PLAN_MODEL)


def openai_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def generate_ai_action_plan(assessment: dict[str, Any], assessment_input: dict[str, Any]) -> ActionPlanPayload:
    if not openai_available():
        raise RuntimeError("OPENAI_API_KEY is not configured")

    try:
        from openai import OpenAI
    except ImportError as error:
        raise RuntimeError("openai package is not installed") from error

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.responses.create(
        model=action_plan_model(),
        input=[
            {
                "role": "system",
                "content": _system_prompt(),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "assessment": _assessment_context(assessment),
                        "assessment_input": assessment_input,
                    },
                    default=str,
                ),
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "action_plan",
                "schema": _action_plan_schema(),
                "strict": True,
            }
        },
    )

    raw_text = response.output_text
    parsed = json.loads(raw_text)
    return ActionPlanPayload(**parsed)


def _assessment_context(assessment: dict[str, Any]) -> dict[str, Any]:
    return {
        "assessment_id": assessment.get("assessment_id"),
        "risk_score": assessment.get("risk_score"),
        "risk_category": assessment.get("risk_category"),
        "confidence_level": assessment.get("confidence_level"),
        "prediction_method": assessment.get("prediction_method"),
        "estimated_inputs": assessment.get("estimated_inputs"),
        "missing_inputs": assessment.get("missing_inputs"),
        "explanation": assessment.get("explanation"),
    }


def _system_prompt() -> str:
    return """
You generate practical cardiovascular health action plans for general non-domain users.
Follow these rules:
- Do not diagnose disease.
- Do not recommend medication.
- Do not tell the user to stop prescribed medication.
- Do not make emergency claims.
- Do not invent the risk score or risk category.
- Use the provided risk_score and risk_category.
- Encourage professional consultation for high risk, unclear values, or concerning results.
- Keep advice simple, practical, and specific.
- Avoid vague advice like "eat healthy" or "exercise more".
- Include specific examples such as fibre-rich foods: oats, beans, lentils, chickpeas, fruits, vegetables, whole grains.
- Include lower-salt choices such as reducing sauces, choosing less processed food, and checking labels when relevant.
- Include beginner physical activity examples such as 10-minute walking, chair exercises, stretching, or beginner strength exercises when relevant.
- Include simple tracking methods such as number of walks completed or number of fibre-rich meals.
- Generate 2 to 5 action items.
- Each item must have a clear next_step and measure.
Return only JSON matching the schema.
""".strip()


def _action_plan_schema() -> dict[str, Any]:
    item_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "title": {"type": "string"},
            "priority": {"type": "string", "enum": ["low", "medium", "high"]},
            "factor": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["easy", "moderate", "hard"]},
            "reason": {"type": "string"},
            "timeframe": {"type": "string"},
            "specific_examples": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            },
            "next_step": {"type": "string"},
            "barrier_plan": {"type": "string"},
            "measure": {"type": "string"},
        },
        "required": [
            "title",
            "priority",
            "factor",
            "difficulty",
            "reason",
            "timeframe",
            "specific_examples",
            "next_step",
            "barrier_plan",
            "measure",
        ],
    }

    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "title": {"type": "string"},
            "summary": {"type": "string"},
            "items": {
                "type": "array",
                "items": item_schema,
                "minItems": 2,
                "maxItems": 5,
            },
            "disclaimer": {"type": "string"},
        },
        "required": ["title", "summary", "items", "disclaimer"],
    }
