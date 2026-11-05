import json
import os
import time
from typing import Any

from app.models import ChatbotHistoryMessage


DEFAULT_CHATBOT_MODEL = "gpt-4.1-mini"
OPENAI_TIMEOUT_SECONDS = 8.0


def chatbot_model() -> str:
    return os.getenv("OPENAI_CHATBOT_MODEL", DEFAULT_CHATBOT_MODEL)


def openai_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def generate_ai_reply(
    message: str,
    page_context: dict[str, Any],
    conversation_history: list[ChatbotHistoryMessage],
    suggested_questions: list[str],
    retrieved_knowledge: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not openai_available():
        raise RuntimeError("OPENAI_API_KEY is not configured")

    try:
        from openai import OpenAI
    except ImportError as error:
        raise RuntimeError("openai package is not installed") from error

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=OPENAI_TIMEOUT_SECONDS)
    input_messages: list[dict[str, str]] = [
        {"role": "system", "content": _system_prompt()},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "page_context": page_context,
                    "trusted_knowledge": _format_knowledge(retrieved_knowledge or []),
                    "suggested_questions": suggested_questions,
                    "instruction": (
                        "Use the page context and trusted knowledge to answer the user's next message safely and simply. "
                        "If trusted knowledge is relevant, use it as grounding without over-quoting it."
                    ),
                },
                default=str,
            ),
        },
    ]

    for item in conversation_history[-6:]:
        input_messages.append({"role": item.role, "content": item.content})

    input_messages.append({"role": "user", "content": message})

    started_at = time.perf_counter()
    response = client.responses.create(
        model=chatbot_model(),
        input=input_messages,
        max_output_tokens=220,
    )
    latency_ms = int((time.perf_counter() - started_at) * 1000)

    usage = getattr(response, "usage", None)
    return {
        "reply": response.output_text.strip(),
        "latency_ms": latency_ms,
        "input_tokens": getattr(usage, "input_tokens", None) if usage else None,
        "output_tokens": getattr(usage, "output_tokens", None) if usage else None,
    }


def _system_prompt() -> str:
    return """
You are the Virtual Care Navigator for a cardiovascular disease risk assessment app designed for non-domain expert users.

Your role:
- Help users understand the app, their assessment result, risk score, risk category, confidence level, action plan, action items, and reminders.
- Use the provided page context.
- Use trusted knowledge snippets when provided, but do not invent citations or facts outside the snippets.
- Keep answers short, simple, and practical.
- Explain that risk scores and projected guidance are estimates when relevant.
- Suggest one clear next step when useful.

Scope:
- Only answer questions related to this CVD risk assessment app, CVD risk education, action plans, reminders, and lifestyle guidance linked to CVD risk.
- If the question is unrelated, politely redirect the user back to the app.

Safety rules:
- Do not diagnose disease.
- Do not say the user has or does not have a disease.
- Do not recommend medication.
- Do not tell users to start, stop, or change prescribed medication.
- Do not provide emergency medical instructions.
- For high risk, very high blood pressure, high blood sugar, unclear symptoms, or medication concerns, encourage the user to consult a healthcare professional.
- If the user describes urgent symptoms, advise them to seek urgent medical help according to local emergency services.
- Do not invent user data. If context is missing, say that you do not have enough information.
- Do not claim that the estimate is exact.
- Avoid long medical explanations.

Response style:
- Use simple language.
- Keep most replies under 100 words.
- Use bullets only when helpful.
- End with a useful next step or suggested question when appropriate.
""".strip()


def _format_knowledge(retrieved_knowledge: list[dict[str, Any]]) -> list[dict[str, str]]:
    formatted: list[dict[str, str]] = []
    for item in retrieved_knowledge[:3]:
        formatted.append(
            {
                "topic": str(item.get("topic", "")),
                "source_name": str(item.get("source_name", "")),
                "source_url": str(item.get("source_url", "")),
                "content": str(item.get("content", "")),
                "safe_response_hint": str(item.get("safe_response_hint", "")),
            }
        )
    return formatted
