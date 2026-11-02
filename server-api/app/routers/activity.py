from typing import Literal

from fastapi import APIRouter

from app.models import ActivityEventRequest
from app.services import storage


router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.post("/{event}")
async def record_session_event(event: Literal["login", "logout"], request: ActivityEventRequest) -> dict:
    user_id = str(request.user_id)
    await storage.log_activity(user_id, f"USER_{event.upper()}", "user_profiles", user_id)
    return {"success": True}
