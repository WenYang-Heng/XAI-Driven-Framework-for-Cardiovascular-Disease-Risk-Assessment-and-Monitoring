import { API_BASE_URL } from "../../domain-expert/constants";
import type { ChatbotPageContext } from "./ChatbotContext";

export type ChatbotMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function sendChatbotMessage({
  message,
  pageContext,
  conversationHistory,
}: {
  message: string;
  pageContext: ChatbotPageContext;
  conversationHistory: ChatbotMessage[];
}) {
  const response = await fetch(`${API_BASE_URL}/api/chatbot/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      page_context: pageContext,
      conversation_history: conversationHistory.slice(-6).map((historyMessage) => ({
        role: historyMessage.role,
        content: historyMessage.content.slice(0, 500),
      })),
    }),
  });

  if (!response.ok) {
    let detail = "Unable to send chatbot message.";
    try {
      const payload = await response.json();
      detail = typeof payload.detail === "string" ? payload.detail : detail;
    } catch {
      // Keep the generic message if the backend does not return JSON.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<{
    reply: string;
    suggested_questions: string[];
  }>;
}
