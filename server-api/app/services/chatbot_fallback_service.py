from typing import Any


FOLLOW_UP_CONFIRMATIONS = {"yes", "yeah", "yep", "sure", "ok", "okay", "please", "go ahead", "more"}


def guided_questions_for_context(page_context: dict[str, Any]) -> list[str]:
    page = page_context.get("page", "unknown")
    if page == "assessment_result":
        questions = [
            "What does my risk score mean?",
            "Why is my risk category this level?",
            "What should I focus on first?",
            "Why is my confidence level low or medium?",
            "What does it mean if some inputs are missing?",
        ]
    elif page == "action_plan":
        questions = [
            "Which action should I start with?",
            "Can you explain this action plan?",
            "Give me examples for this action",
            "How can I track my progress?",
            "How can I make this easier?",
        ]
    elif page == "reminders":
        questions = [
            "How do reminders work?",
            "How can I set a reminder for an action item?",
            "What reminders are due soon?",
            "Can I change or cancel a reminder?",
        ]
    elif page == "assessment_form":
        questions = [
            "What if I don't know my blood pressure?",
            "How should I choose my activity level?",
            "What does cholesterol category mean?",
            "Can I leave some values unknown?",
        ]
    elif page == "dashboard":
        questions = [
            "Summarize my latest result",
            "What should I do today?",
            "How do I create an action plan?",
            "What does my risk category mean?",
        ]
    else:
        questions = [
            "How do I use this app?",
            "What is a CVD risk score?",
            "How do action plans work?",
            "What can this chatbot help with?",
        ]

    return questions[:5]


def generate_fallback_reply(
    message: str,
    page_context: dict[str, Any],
    retrieved_knowledge: list[dict[str, Any]] | None = None,
) -> str:
    lowered = message.lower()
    risk_score = page_context.get("risk_score") or page_context.get("latest_risk_score")
    risk_category = page_context.get("risk_category") or page_context.get("latest_risk_category")

    if any(term in lowered for term in ["medicine", "medication", "drug", "prescription"]):
        return (
            "This app cannot advise you to start, stop, or change medication. "
            "Please speak with a healthcare professional about medication concerns."
        )

    if any(term in lowered for term in ["chest pain", "shortness of breath", "faint", "emergency"]):
        return (
            "If you have urgent symptoms such as chest pain, severe shortness of breath, fainting, or severe weakness, "
            "please seek urgent medical help through your local emergency services."
        )

    if any(term in lowered for term in ["risk", "score", "category", "result"]):
        if risk_score is not None and risk_category:
            return (
                f"Your current risk result is an estimate of {risk_score}% and is labelled {risk_category}. "
                "It helps you understand your general risk level, but it is not a diagnosis or an exact medical prediction."
            )
        return (
            "Your risk score is an estimate based on the information you provided. It helps show whether your estimated CVD risk "
            "is low, moderate, or high, but it is not a diagnosis."
        )

    if any(term in lowered for term in ["missing", "unknown", "don't know", "dont know", "not sure"]):
        return (
            "If you do not know a value such as blood pressure or cholesterol, you can choose 'I'm not sure'. "
            "The estimate may be less accurate, but you can still use the app and update the value later."
        )

    if any(term in lowered for term in ["action", "plan", "start", "do today", "next"]):
        return (
            "A good next step is to review your action plan and start with one small, realistic change, such as walking for "
            "10 minutes, choosing a fibre-rich food, or reducing salty sauces. If your result is high or unclear, discuss it "
            "with a healthcare professional."
        )

    if lowered.strip() in FOLLOW_UP_CONFIRMATIONS:
        top_factors = page_context.get("top_factors") if isinstance(page_context.get("top_factors"), list) else []
        factor_text = ", ".join(str(factor) for factor in top_factors[:3]) if top_factors else "your main risk factors"
        return (
            f"Here are practical tips for {factor_text}: start with a 10-minute walk on most days, choose more fibre-rich "
            "foods such as oats, beans, vegetables, or fruit, and track blood pressure if you have a monitor. Pick one small "
            "step first and repeat it consistently."
        )

    if any(term in lowered for term in ["reminder", "remind", "due", "schedule"]):
        return (
            "Reminders help you remember practical health actions from this app, such as a walk, a blood pressure check, "
            "or reviewing your action plan. You can create, complete, or delete reminders from the Reminders page."
        )

    knowledge_reply = _knowledge_fallback_reply(retrieved_knowledge or [])
    if knowledge_reply:
        return knowledge_reply

    return (
        "I can help explain your risk result, assessment inputs, action plan, or how to use this page. "
        "I provide general guidance only, not a diagnosis or exact medical advice."
    )


def out_of_scope_reply() -> str:
    return (
        "I can only help with your CVD risk assessment, action plan, reminders, and how to use this app. "
        "You can ask me about your risk score, action items, or what to do next."
    )


def _knowledge_fallback_reply(retrieved_knowledge: list[dict[str, Any]]) -> str | None:
    if not retrieved_knowledge:
        return None

    primary = retrieved_knowledge[0]
    topic = str(primary.get("topic") or "")
    content = str(primary.get("content") or "").strip()
    if not content:
        return None

    next_step = _topic_next_step(topic)
    if next_step:
        return f"{content} A practical next step is to {next_step}"
    return content


def _topic_next_step(topic: str) -> str:
    if topic == "cholesterol":
        return "choose one fibre-rich food today, such as oats, beans, vegetables, or fruit."
    if topic == "physical_activity":
        return "start with a short walk or a few movement breaks, then build up gradually."
    if topic == "blood_pressure":
        return "record your blood pressure if you know it, or choose 'not sure' and update it later."
    if topic == "diet":
        return "pick one lower-salt or higher-fibre food swap that feels realistic."
    if topic == "smoking":
        return "consider support for quitting and discuss options with a healthcare professional."
    if topic == "blood_sugar":
        return "add your blood sugar category if you know it, or follow up with testing if you are unsure."
    if topic == "sleep":
        return "keep a consistent sleep routine where possible."
    if topic == "heart_health_basics":
        return "pick one small habit to work on first instead of changing everything at once."
    return ""
