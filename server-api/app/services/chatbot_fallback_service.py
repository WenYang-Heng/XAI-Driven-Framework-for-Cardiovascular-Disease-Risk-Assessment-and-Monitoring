from typing import Any


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


def generate_fallback_reply(message: str, page_context: dict[str, Any]) -> str:
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

    if any(term in lowered for term in ["reminder", "remind", "due", "schedule"]):
        return (
            "Reminders help you remember practical health actions from this app, such as a walk, a blood pressure check, "
            "or reviewing your action plan. You can create, complete, or delete reminders from the Reminders page."
        )

    return (
        "I can help explain your risk result, assessment inputs, action plan, or how to use this page. "
        "I provide general guidance only, not a diagnosis or exact medical advice."
    )


def out_of_scope_reply() -> str:
    return (
        "I can only help with your CVD risk assessment, action plan, reminders, and how to use this app. "
        "You can ask me about your risk score, action items, or what to do next."
    )
