import os
import time

import httpx
from fastapi import Header, HTTPException

from app.services import storage
from app.services.database import database_enabled


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")
TOKEN_CACHE_SECONDS = 60

_token_cache: dict[str, tuple[float, str]] = {}


async def _user_id_for_token(token: str) -> str:
    cached = _token_cache.get(token)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail="Authentication service is unreachable.") from error
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Session is invalid or has expired. Please log in again.")

    user_id = response.json()["id"]
    _token_cache[token] = (time.monotonic() + TOKEN_CACHE_SECONDS, user_id)
    return user_id


async def require_admin(authorization: str | None = Header(None)) -> str | None:
    """Verify the Supabase session token belongs to a user whose profile role is ADMIN.

    Without Supabase configured (local in-memory development) the check is skipped.
    """
    if not (SUPABASE_URL and SUPABASE_KEY and database_enabled()):
        return None

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin session token is required.")

    user_id = await _user_id_for_token(authorization.split(" ", 1)[1].strip())
    profile = storage.get_user_profile(user_id)
    if not profile or profile.get("role") != "ADMIN":
        await storage.log_activity(user_id, "ADMIN_ACCESS_DENIED", "user_profiles", user_id)
        raise HTTPException(status_code=403, detail="Administrator role is required.")
    return user_id
