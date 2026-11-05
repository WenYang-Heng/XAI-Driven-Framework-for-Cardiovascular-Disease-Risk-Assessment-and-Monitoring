import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


KNOWLEDGE_PATH = Path(__file__).resolve().parent.parent / "data" / "chatbot_knowledge.json"
MAX_SNIPPET_LENGTH = 360
STOP_WORDS = {
    "about",
    "after",
    "again",
    "also",
    "because",
    "could",
    "does",
    "from",
    "have",
    "help",
    "into",
    "like",
    "more",
    "need",
    "should",
    "that",
    "their",
    "there",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "your",
}


def retrieve_knowledge(
    message: str,
    page_context: dict[str, Any],
    limit: int = 3,
) -> list[dict[str, Any]]:
    message_text = message.lower()
    message_terms = _terms(message_text)
    query_text = _build_query_text(message, page_context)
    query_terms = _terms(query_text)
    scored: list[tuple[int, dict[str, Any]]] = []

    for item in _load_knowledge():
        score = _score_item(item, message_text, message_terms, query_text, query_terms)
        if score > 0:
            scored.append((score, item))

    if not scored and _looks_app_related(page_context):
        scored = [
            (1, item)
            for item in _load_knowledge()
            if item.get("topic") in {"heart_health_basics", "safety"}
        ]

    scored.sort(key=lambda pair: (-pair[0], str(pair[1].get("id", ""))))
    return [_public_item(item, score) for score, item in scored[: max(limit, 0)]]


@lru_cache(maxsize=1)
def _load_knowledge() -> tuple[dict[str, Any], ...]:
    with KNOWLEDGE_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list):
        return tuple()
    return tuple(item for item in data if isinstance(item, dict))


def _build_query_text(message: str, page_context: dict[str, Any]) -> str:
    parts = [message, str(page_context.get("page", ""))]

    for key in ["risk_category", "confidence_level", "latest_risk_category"]:
        if page_context.get(key):
            parts.append(str(page_context[key]))

    for key in ["top_factors", "missing_inputs", "available_inputs"]:
        value = page_context.get(key)
        if isinstance(value, list):
            parts.extend(str(item) for item in value[:5])

    action_items = page_context.get("action_items")
    if isinstance(action_items, list):
        for item in action_items[:3]:
            if isinstance(item, dict):
                parts.extend(str(item.get(key, "")) for key in ["title", "factor", "priority"])

    return " ".join(part for part in parts if part).lower()


def _score_item(
    item: dict[str, Any],
    message_text: str,
    message_terms: set[str],
    query_text: str,
    query_terms: set[str],
) -> int:
    score = 0
    topic = str(item.get("topic", "")).replace("_", " ").lower()
    content = str(item.get("content", "")).lower()
    hint = str(item.get("safe_response_hint", "")).lower()
    keywords = [str(keyword).lower() for keyword in item.get("keywords", []) if keyword]

    for keyword in keywords:
        if keyword in message_text:
            score += 9 if " " in keyword else 7
        if keyword in query_text:
            score += 5 if " " in keyword else 3

    topic_terms = _terms(topic)
    score += 10 * len(topic_terms & message_terms)
    score += 2 * len(topic_terms & query_terms)

    body_terms = _terms(f"{content} {hint}")
    score += min(len(body_terms & query_terms), 4)

    if item.get("topic") == "safety" and _contains_any(
        query_text,
        ["medication", "medicine", "chest pain", "symptoms", "emergency", "diagnosis"],
    ):
        score += 8

    return score


def _public_item(item: dict[str, Any], score: int) -> dict[str, Any]:
    content = str(item.get("content", ""))[:MAX_SNIPPET_LENGTH]
    hint = str(item.get("safe_response_hint", ""))[:MAX_SNIPPET_LENGTH]
    return {
        "id": item.get("id"),
        "topic": item.get("topic"),
        "source_name": item.get("source_name"),
        "source_url": item.get("source_url"),
        "content": content,
        "safe_response_hint": hint,
        "score": score,
    }


def _terms(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) > 2 and token not in STOP_WORDS
    }


def _contains_any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)


def _looks_app_related(page_context: dict[str, Any]) -> bool:
    return bool(page_context.get("page") and page_context.get("page") != "unknown")
