import os
import time
from typing import Any

from app.models import ChatbotHistoryMessage
from app.services import chatbot_ai_service, chatbot_fallback_service


MAX_HISTORY_MESSAGES = 6
OUT_OF_SCOPE_RESPONSE = chatbot_fallback_service.out_of_scope_reply()

ALLOWED_TERMS = {
    "risk",
    "risk score",
    "risk category",
    "assessment",
    "action plan",
    "action item",
    "reminder",
    "blood pressure",
    "cholesterol",
    "blood sugar",
    "activity",
    "exercise",
    "walking",
    "diet",
    "salt",
    "smoking",
    "nicotine",
    "sleep",
    "confidence",
    "confidence level",
    "missing",
    "missing input",
    "cvd",
    "heart",
    "heart health",
    "dashboard",
    "result",
    "what should i do",
    "next step",
    "medication",
    "medicine",
    "chest pain",
    "shortness of breath",
    "faint",
    "diabetes",
}


async def generate_chatbot_message(
    message: str,
    page_context: dict[str, Any],
    conversation_history: list[ChatbotHistoryMessage],
) -> dict[str, Any]:
    started_at = time.perf_counter()
    normalised_context = _compact_page_context(page_context or {"page": "unknown"})
    history = conversation_history[-MAX_HISTORY_MESSAGES:]
    suggested_questions = chatbot_fallback_service.guided_questions_for_context(normalised_context)
    page = str(normalised_context.get("page", "unknown"))

    _log(
        f"request received page={page} history={len(history)} "
        f"message_length={len(message.strip())}"
    )

    if not _is_in_scope(message, suggested_questions):
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        _log(f"scope_blocked latency_ms={latency_ms} suggested_questions={len(suggested_questions)}")
        return {
            "reply": OUT_OF_SCOPE_RESPONSE,
            "suggested_questions": suggested_questions,
        }

    try:
        _log(f"using model={chatbot_ai_service.chatbot_model()}")
        result = chatbot_ai_service.generate_ai_reply(
            message=message.strip(),
            page_context=normalised_context,
            conversation_history=history,
            suggested_questions=suggested_questions,
        )
        reply = result["reply"] or chatbot_fallback_service.generate_fallback_reply(message, normalised_context)
        suggested_questions = _next_suggested_questions(reply, suggested_questions)
        _log(
            "openai_success "
            f"latency_ms={result.get('latency_ms')} "
            f"input_tokens={result.get('input_tokens')} "
            f"output_tokens={result.get('output_tokens')} "
            f"suggested_questions={len(suggested_questions)}"
        )
    except Exception as error:
        _log(f"fallback_used reason={_safe_reason(error)} suggested_questions={len(suggested_questions)}")
        reply = chatbot_fallback_service.generate_fallback_reply(message, normalised_context)
        suggested_questions = _next_suggested_questions(reply, suggested_questions)

    return {
        "reply": reply,
        "suggested_questions": suggested_questions,
    }


def _compact_page_context(page_context: dict[str, Any]) -> dict[str, Any]:
    page = page_context.get("page", "unknown")
    compact: dict[str, Any] = {"page": page}

    for key in [
        "risk_score",
        "risk_category",
        "confidence_level",
        "latest_risk_score",
        "latest_risk_category",
        "unknown_allowed",
        "current_step",
        "pending_action_items_count",
        "assessment_id",
    ]:
        if key in page_context:
            compact[key] = page_context[key]

    for key in ["top_factors", "missing_inputs", "available_inputs"]:
        value = page_context.get(key)
        if isinstance(value, list):
            compact[key] = value[:5]

    action_items = page_context.get("action_items")
    if isinstance(action_items, list):
        compact["action_items"] = [
            {
                "title": item.get("title"),
                "factor": item.get("factor"),
                "priority": item.get("priority"),
            }
            for item in action_items[:3]
            if isinstance(item, dict)
        ]

    reminders = page_context.get("reminders")
    if isinstance(reminders, list):
        compact["reminders"] = [
            {
                "title": item.get("title"),
                "status": item.get("status"),
                "reminder_time": item.get("reminder_time"),
            }
            for item in reminders[:3]
            if isinstance(item, dict)
        ]

    explanation = page_context.get("explanation")
    if isinstance(explanation, list):
        compact["explanation"] = explanation[:2]
    elif isinstance(explanation, str):
        compact["explanation"] = explanation[:240]

    return compact


def _is_in_scope(message: str, suggested_questions: list[str]) -> bool:
    lowered = message.strip().lower()
    if not lowered:
        return False
    if any(lowered == question.lower() for question in suggested_questions):
        return True
    return any(term in lowered for term in ALLOWED_TERMS)


def _next_suggested_questions(reply: str, current_questions: list[str]) -> list[str]:
    lowered = reply.lower()
    dynamic_questions: list[str] = []

    if "tips on what to do today" in lowered or "what to do today" in lowered:
        dynamic_questions.append("What should I do today?")
    if "keep up healthy habits" in lowered or "healthy habits" in lowered:
        dynamic_questions.append("How can I keep up healthy habits?")
    if "monitoring" in lowered or "monitor" in lowered:
        dynamic_questions.append("What should I monitor regularly?")
    if "action plan" in lowered:
        dynamic_questions.append("How do I create an action plan?")
    if "reminder" in lowered:
        dynamic_questions.append("How do reminders work?")

    merged: list[str] = []
    for question in [*dynamic_questions, *current_questions]:
        if question not in merged:
            merged.append(question)

    return merged[:5]


def _development_logging_enabled() -> bool:
    value = (
        os.getenv("APP_ENV")
        or os.getenv("ENV")
        or os.getenv("FASTAPI_ENV")
        or os.getenv("NODE_ENV")
        or "development"
    ).lower()
    return value not in {"production", "prod"}


def _log(message: str) -> None:
    if _development_logging_enabled():
        print(f"[chatbot] {message}")


def _safe_reason(error: Exception) -> str:
    text = str(error) or error.__class__.__name__
    if "OPENAI_API_KEY" in text:
        return "missing_api_key"
    return text[:120].replace("\n", " ")
