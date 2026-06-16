import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Bot, User, ArrowRight, Loader2, Play } from "lucide-react";
import { ChatMessage } from "../types";

interface AIAssistantWidgetProps {
  onActionExecuted: (actionType: string) => void;
}

export default function AIAssistantWidget({ onActionExecuted }: AIAssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome_0",
      role: "model",
      text: "Hello! I am your AI Billing Operating Assistant, engineered to manage pricing models, analyze subscription telemetry, and audit revenue operations in real-time.\n\nType an instruction, or test an automated command option below:"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    { text: "Create a usage plan for AI tokens", action: "CREATE_PLAN" },
    { text: "Why did churn increase last month?", action: "ANALYZE_CHURN" },
    { text: "Add an urgent note to customer Linear Tech", action: "ADD_NOTE" },
    { text: "Generate a pricing strategy for agencies", action: "STRATEGY" }
  ];

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    if (!customPrompt) setInput("");

    // Add user message
    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      text: textToSend
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend })
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with the billing server core.");
      }

      const data = await response.json();
      
      const modelMsg: ChatMessage = {
        id: "model_" + Date.now(),
        role: "model",
        text: data.text
      };

      setMessages(prev => [...prev, modelMsg]);

      // If an action was executed, notify parent to refresh backend-synced in-memory store
      if (data.actionExecuted) {
        onActionExecuted(data.actionExecuted);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: "err_" + Date.now(),
          role: "model",
          text: `⚠️ Platform Service Note: ${err.message || "An issue occurred. I have applied a simulation fallback sequence below."}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Launcher Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 items-center gap-2.5 rounded-full bg-[#111111] hover:bg-[#1D1D1F] px-4.5 text-xs font-medium text-white shadow-xl hover:shadow-2xl transition-all cursor-pointer border border-neutral-800"
        id="ai-widget-launcher-btn"
      >
        <Sparkles className="h-4.5 w-4.5 text-white animate-pulse" />
        Ask Billing AI
      </button>

      {/* Slide Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 max-w-full bg-white border-l border-[#E5E5E7] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-[#E5E5E7] bg-[#FAFAFA] px-4.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111] text-white">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#111111] tracking-tight">AI Billing Concierge</h3>
                <p className="text-[9px] text-[#6E6E73] font-medium leading-none">Embedded Workspace Agent</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-[#6E6E73] hover:bg-[#F2F2F2] hover:text-[#111111] transition-colors"
              id="ai-widget-close-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4.5 space-y-4 bg-white"
          >
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    isUser ? "bg-[#111111] text-white border-transparent" : "bg-[#F5F5F7] text-[#111111] border-[#E5E5E7]"
                  }`}>
                    {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`rounded-lg px-3 py-2 text-xs ${
                    isUser ? "bg-[#1D1D1F] text-white" : "bg-[#F5F5F7] text-[#111111] leading-relaxed whitespace-pre-wrap"
                  }`}>
                    {m.text}
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F5F7] text-[#111111] border border-[#E5E5E7]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="bg-[#F5F5F7] text-[#6E6E73] rounded-lg px-3 py-2 text-xs">
                  Analyzing cohort transactions & database hooks...
                </div>
              </div>
            )}
          </div>

          {/* Suggestions and Input form */}
          <div className="border-t border-[#E5E5E7] bg-[#FAFAFA] p-3 space-y-3">
            
            {/* Suggestions list */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider px-1">Trigger Operations</p>
              <div className="grid grid-cols-2 gap-1.5">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.text)}
                    className="flex items-center justify-between text-[10px] text-[#6E6E73] border border-[#E5E5E7] hover:border-[#86868B] hover:text-[#111111] rounded-lg px-2 py-1.5 bg-white transition-all text-left cursor-pointer font-medium"
                    id={`ai-prompt-option-${idx}`}
                  >
                    <span className="truncate pr-1">{p.text}</span>
                    <Play className="h-2 w-2 text-neutral-400 fill-neutral-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Input field bar */}
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E5E5E7] bg-white p-1 focus-within:ring-1 focus-within:ring-[#111111] transition-all">
              <input
                id="ai-assistant-input"
                type="text"
                placeholder="Ask Billing AI to build, analyze or log..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                className="w-full bg-transparent px-2.5 py-1 text-xs text-[#111111] outline-none placeholder:text-[#86868B]"
              />
              <button
                disabled={!input.trim() || isLoading}
                onClick={() => handleSendMessage()}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-[#111111] hover:bg-[#1D1D1F] text-white disabled:bg-[#FAFAFA] disabled:text-neutral-300 transition-colors"
                id="ai-message-submit-btn"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
