from fastapi import APIRouter, HTTPException

from app.models import ActionPlanGenerateRequest
from app.services import action_plan_service


router = APIRouter(prefix="/api/action-plans", tags=["action plans"])


@router.post("/generate")
async def generate_action_plan(request: ActionPlanGenerateRequest) -> dict:
    try:
        action_plan = await action_plan_service.generate_action_plan(
            assessment_id=request.assessment_id,
            user_id=request.user_id,
            regenerate=request.regenerate,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return {"action_plan": action_plan}
