import os
from dataclasses import dataclass

import httpx


RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
REMINDER_EMAIL_FROM = os.getenv("REMINDER_EMAIL_FROM", "CardioXAI <onboarding@resend.dev>")


@dataclass
class EmailResult:
    provider: str
    message_id: str | None = None


class EmailNotConfiguredError(RuntimeError):
    pass


async def send_reminder_email(
    to_email: str,
    subject: str,
    text_body: str,
) -> EmailResult:
    if not RESEND_API_KEY:
        raise EmailNotConfiguredError("RESEND_API_KEY is not configured.")

    payload = {
        "from": REMINDER_EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post("https://api.resend.com/emails", headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    return EmailResult(provider="resend", message_id=data.get("id"))
