from fastapi import APIRouter, HTTPException

from app.models import UserProfileRequest
from app.services import storage


router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/{user_id}")
def get_profile(user_id: str) -> dict:
    profile = storage.get_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {"success": True, "profile": profile}


@router.post("")
async def upsert_profile(request: UserProfileRequest) -> dict:
    profile = await storage.upsert_user_profile(request.model_dump(mode="json"))
    return {"success": True, "profile": profile}


@router.patch("/{user_id}")
async def update_profile(user_id: str, request: UserProfileRequest) -> dict:
    payload = request.model_dump(mode="json")
    payload["user_id"] = user_id
    profile = await storage.upsert_user_profile(payload)
    return {"success": True, "profile": profile}
