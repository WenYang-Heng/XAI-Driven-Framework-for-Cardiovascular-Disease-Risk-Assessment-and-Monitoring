from fastapi import APIRouter

from app.services import storage


router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/predictions/{user_id}")
def get_prediction_history(user_id: str) -> dict:
    return {"success": True, "items": storage.prediction_history(user_id)}


@router.get("/uploads/{user_id}")
def get_upload_history(user_id: str) -> dict:
    return {"success": True, "items": storage.upload_history(user_id)}


@router.get("/uploads/detail/{upload_id}")
def get_upload_detail(upload_id: str) -> dict:
    return {"success": True, "items": storage.upload_detail(upload_id)}
