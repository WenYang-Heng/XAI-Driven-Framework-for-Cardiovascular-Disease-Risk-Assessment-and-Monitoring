from fastapi import APIRouter

from app.services import storage


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/summary")
def get_admin_summary() -> dict:
    return {"success": True, "summary": storage.admin_summary()}
