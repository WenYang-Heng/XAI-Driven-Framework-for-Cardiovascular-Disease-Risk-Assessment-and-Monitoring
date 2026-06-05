import type { ChatbotPageContext } from "./ChatbotContext";

export function guidedQuestionsForContext(context: ChatbotPageContext) {
  switch (context.page) {
    case "assessment_result":
      return [
        "What does my risk score mean?",
        "Why is my risk category this level?",
        "What should I focus on first?",
        "Why is my confidence level low or medium?",
        "What does it mean if some inputs are missing?",
      ];
    case "action_plan":
      return [
        "Which action should I start with?",
        "Can you explain this action plan?",
        "Give me examples for this action",
        "How can I track my progress?",
        "How can I make this easier?",
      ];
    case "reminders":
      return [
        "How do reminders work?",
        "How can I set a reminder for an action item?",
        "What reminders are due soon?",
        "Can I change or cancel a reminder?",
      ];
    case "assessment_form":
      return [
        "What if I don't know my blood pressure?",
        "How should I choose my activity level?",
        "What does cholesterol category mean?",
        "Can I leave some values unknown?",
      ];
    case "dashboard":
      return [
        "Summarize my latest result",
        "What should I do today?",
        "How do I create an action plan?",
        "What does my risk category mean?",
      ];
    default:
      return [
        "How do I use this app?",
        "What is a CVD risk score?",
        "How do action plans work?",
        "What can this chatbot help with?",
      ];
  }
}
