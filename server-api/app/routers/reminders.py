from fastapi import APIRouter, HTTPException, Query

from app.models import ReminderRequest, ReminderUpdateRequest
from app.services import storage


router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("/{user_id}")
def list_reminders(user_id: str) -> dict:
    return {"success": True, "items": storage.list_reminders(user_id)}


@router.post("")
async def create_reminder(request: ReminderRequest) -> dict:
    reminder = await storage.create_reminder(request.model_dump())
    return {"success": True, "reminder": reminder}


@router.patch("/{reminder_id}")
async def update_reminder(
    reminder_id: str,
    request: ReminderUpdateRequest,
    user_id: str = Query(...),
) -> dict:
    reminder = await storage.update_reminder(reminder_id, user_id, request.model_dump())
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"success": True, "reminder": reminder}


@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, user_id: str = Query(...)) -> dict:
    deleted = await storage.delete_reminder(reminder_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"success": True}
