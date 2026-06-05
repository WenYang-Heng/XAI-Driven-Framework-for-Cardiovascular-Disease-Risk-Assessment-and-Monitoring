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
      conversation_history: conversationHistory.slice(-6),
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to send chatbot message.");
  }

  return response.json() as Promise<{
    reply: string;
    suggested_questions: string[];
  }>;
}
