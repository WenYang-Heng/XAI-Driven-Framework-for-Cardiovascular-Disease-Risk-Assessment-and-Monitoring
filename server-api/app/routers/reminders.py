import os

from fastapi import APIRouter, Header, HTTPException, Query

from app.models import ReminderRequest, ReminderUpdateRequest
from app.services import storage


router = APIRouter(prefix="/api/reminders", tags=["reminders"])


REMINDER_PROCESSOR_TOKEN = os.getenv("REMINDER_PROCESSOR_TOKEN", "")


@router.post("/process-due")
async def process_due_reminder_emails(
    dry_run: bool = Query(False),
    limit: int = Query(25, ge=1, le=100),
    x_reminder_processor_token: str | None = Header(default=None),
) -> dict:
    if REMINDER_PROCESSOR_TOKEN and x_reminder_processor_token != REMINDER_PROCESSOR_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid reminder processor token.")

    result = await storage.process_due_reminder_emails(limit=limit, dry_run=dry_run)
    return {"success": True, **result}


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
