import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ChatbotPageContext = {
  page: string;
  [key: string]: unknown;
};

type ChatbotContextValue = {
  pageContext: ChatbotPageContext;
  setChatbotContext: (context: ChatbotPageContext) => void;
};

const ChatbotContext = createContext<ChatbotContextValue | null>(null);

export function ChatbotContextProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState<ChatbotPageContext>({ page: "unknown" });

  const value = useMemo(
    () => ({
      pageContext,
      setChatbotContext: setPageContext,
    }),
    [pageContext],
  );

  return <ChatbotContext.Provider value={value}>{children}</ChatbotContext.Provider>;
}

export function useChatbotContext() {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error("useChatbotContext must be used inside ChatbotContextProvider");
  }
  return context;
}
