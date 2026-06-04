from typing import Any

from app.models import ActionPlanPayload
from app.services import action_plan_ai_service, action_plan_fallback_service, storage


async def generate_action_plan(assessment_id: str, user_id: str, regenerate: bool = False) -> dict[str, Any]:
    assessment_bundle = storage.get_patient_assessment_with_input(assessment_id, user_id)
    if not assessment_bundle:
        raise ValueError("Assessment not found for this user")

    if not regenerate:
        existing = storage.get_action_plan_for_assessment(assessment_id, user_id)
        if existing:
            return existing

    assessment, assessment_input = assessment_bundle
    generated_by = "ai_assisted"
    ai_model: str | None = action_plan_ai_service.action_plan_model()
    metadata: dict[str, Any] = {
        "fallback_used": False,
        "assessment_confidence": assessment.get("confidence_level"),
    }

    try:
        plan = action_plan_ai_service.generate_ai_action_plan(assessment, assessment_input)
    except Exception as error:
        generated_by = "rule_based"
        ai_model = None
        metadata = {
            **metadata,
            "fallback_used": True,
            "fallback_reason": str(error),
        }
        plan = action_plan_fallback_service.generate_fallback_plan(assessment, assessment_input)

    normalised_plan = _normalise_plan(plan)
    return await storage.save_action_plan(
        user_id=user_id,
        assessment=assessment,
        plan_payload=normalised_plan.model_dump(),
        generated_by=generated_by,
        ai_model=ai_model,
        generation_metadata=metadata,
    )


def _normalise_plan(plan: ActionPlanPayload) -> ActionPlanPayload:
    items = []
    for item in plan.items[:5]:
        payload = item.model_dump()
        payload["specific_examples"] = [example for example in payload["specific_examples"] if example.strip()][:8]
        payload["status"] = payload.get("status") or "not_started"
        items.append(payload)

    if len(items) < 2:
        fallback = action_plan_fallback_service.generate_fallback_plan(
            {"risk_category": "moderate", "missing_inputs": []},
            {"activity_level": "low"},
        )
        items.extend(item.model_dump() for item in fallback.items)

    return ActionPlanPayload(
        title=plan.title,
        summary=plan.summary,
        items=items[:5],
        disclaimer=plan.disclaimer,
    )
