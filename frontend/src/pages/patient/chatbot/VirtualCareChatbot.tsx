import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useChatbotContext } from "./ChatbotContext";
import { type ChatbotMessage, sendChatbotMessage } from "./chatbotApi";
import { guidedQuestionsForContext } from "./guidedQuestions";

type ChatbotUiMessage = ChatbotMessage & {
  id: string;
  animate?: boolean;
  tone?: "normal" | "error";
};

const welcomeMessage: ChatbotUiMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I'm your Virtual Care Navigator. I can help explain your risk result, action plan, or what to do next. I cannot diagnose disease or replace professional medical advice.",
};

export function VirtualCareChatbot() {
  const { pageContext } = useChatbotContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatbotUiMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [serverQuestions, setServerQuestions] = useState<string[]>([]);
  const currentPage = String(pageContext.page ?? "unknown");

  const lastAssistantReply = [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
  const contextualQuestions = guidedQuestionsForContext(pageContext, lastAssistantReply);
  const guidedQuestions = uniqueQuestions([...serverQuestions, ...contextualQuestions]).slice(0, 5);

  const recentHistory = useMemo(
    () => messages
      .filter((message) => message.id !== welcomeMessage.id)
      .slice(-6)
      .map(({ role, content }) => ({ role, content })),
    [messages],
  );

  useEffect(() => {
    setIsOpen(false);
    setServerQuestions([]);
    setInput("");
  }, [currentPage]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const nextMessages: ChatbotUiMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatbotMessage({
        message: trimmed,
        pageContext,
        conversationHistory: recentHistory,
      });
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: response.reply, animate: true },
      ]);
      setServerQuestions(response.suggested_questions ?? []);
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "I couldn't respond right now. Please try again.";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: errorMessage,
          tone: "error",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([welcomeMessage]);
    setServerQuestions([]);
    setInput("");
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="Open Virtual Care Navigator"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-cyan-600 text-white shadow-xl shadow-cyan-900/20 transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section className="fixed bottom-4 right-4 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
      <header className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan-100 bg-cyan-50 text-cyan-700">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-cyan-700">Virtual Care Navigator</h2>
            <p className="text-sm font-semibold text-slate-400">Support</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close chatbot"
          onClick={() => setIsOpen(false)}
          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid max-h-[460px] min-h-[330px] content-start gap-3 overflow-y-auto bg-slate-50 px-5 py-5">
          {messages.map((message, index) => (
            <ChatBubble
              key={message.id}
              message={message}
              onAnimationDone={() => {
                setMessages((current) =>
                  current.map((item) => item.id === message.id ? { ...item, animate: false } : item),
                );
              }}
            />
          ))}
          {isLoading ? <ChatLoadingSkeleton /> : null}
          {!isLoading ? (
            <div className="grid max-w-[88%] gap-2 justify-self-start">
              <div className="flex flex-wrap gap-2">
                {guidedQuestions.slice(0, 3).map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    disabled={isLoading}
                    className="rounded-md border border-cyan-100 bg-white px-2.5 py-1.5 text-left text-xs font-normal leading-5 text-cyan-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-white p-5">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
              value={input}
              maxLength={500}
              placeholder="Type your message..."
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  sendMessage(input);
                }
              }}
            />
            <Button onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()} className="min-h-11 rounded-lg px-3">
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <button
            type="button"
            onClick={startNewChat}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-cyan-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({
  message,
  onAnimationDone,
}: {
  message: ChatbotUiMessage;
  onAnimationDone?: () => void;
}) {
  const isUser = message.role === "user";
  const isError = message.tone === "error";

  return (
    <div
      className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
        isUser
          ? "justify-self-end bg-cyan-600 text-white"
          : isError
            ? "justify-self-start border border-amber-100 bg-amber-50 text-amber-800"
          : "justify-self-start bg-white text-slate-600"
      }`}
    >
      {!isUser ? <strong className="mb-1 block text-slate-950">Virtual Care Navigator</strong> : null}
      {!isUser && message.animate ? (
        <TypewriterText text={message.content} onDone={onAnimationDone} />
      ) : (
        message.content
      )}
    </div>
  );
}

function ChatLoadingSkeleton() {
  return (
    <div className="max-w-[82%] justify-self-start px-4 py-3">
      <style>
        {`
          @keyframes chatbot-dot-pulse {
            0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
            40% { opacity: 1; transform: translateY(-3px); }
          }
        `}
      </style>
      <div className="flex items-center gap-2">
        {[0, 120, 240].map((delay) => (
          <span
            key={delay}
            className="h-2.5 w-2.5 rounded-full bg-cyan-600 [animation:chatbot-dot-pulse_1.1s_ease-in-out_infinite]"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function TypewriterText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    setVisibleLength(0);
    if (!text) {
      onDoneRef.current?.();
      return;
    }

    const interval = window.setInterval(() => {
      setVisibleLength((current) => {
        if (current >= text.length) {
          window.clearInterval(interval);
          onDoneRef.current?.();
          return current;
        }
        return current + 1;
      });
    }, 14);

    return () => window.clearInterval(interval);
  }, [text]);

  return <>{text.slice(0, visibleLength)}</>;
}

function uniqueQuestions(questions: string[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = question.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
