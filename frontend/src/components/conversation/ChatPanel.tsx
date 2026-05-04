"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import MessageBubble from "./MessageBubble";
import { TypingIndicator } from "../TypingIndicator";
import { useLang } from "@/lib/i18n";

interface Message {
  role: "user" | "examiner";
  content: string;
}

interface Props {
  messages: Message[];
  onSend: (msg: string) => void;
  loading?: boolean;
  disabled?: boolean;
  statusMessage?: string;
  progress?: number;
  fillText?: string;          // external text to fill into input (e.g. from voice)
  onFillConsumed?: () => void; // called when fillText has been loaded into input
}

export default function ChatPanel({ messages, onSend, loading, disabled, statusMessage, progress, fillText, onFillConsumed }: Props) {
  const { t } = useLang();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // When external text arrives (e.g. voice transcription), fill input
  useEffect(() => {
    if (fillText) {
      setInput(fillText);
      onFillConsumed?.();
    }
  }, [fillText, onFillConsumed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-300">
                <Send size={24} />
              </div>
              <p className="text-sm text-gray-400">{t("practice.emptyChat")}</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <MessageBubble message={msg} />
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="animate-fade-in">
            {statusMessage ? (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Loader2 size={14} className="animate-spin" />
                </div>
                <div className="rounded-2xl bg-gray-100 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-typing rounded-full bg-indigo-400" style={{ animationDelay: "0s" }} />
                      <span className="h-1.5 w-1.5 animate-typing rounded-full bg-indigo-400" style={{ animationDelay: "0.2s" }} />
                      <span className="h-1.5 w-1.5 animate-typing rounded-full bg-indigo-400" style={{ animationDelay: "0.4s" }} />
                    </div>
                    {progress !== undefined && (
                      <span className="text-xs font-medium text-indigo-500">
                        {Math.round(progress * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{statusMessage}</p>
                </div>
              </div>
            ) : (
              <TypingIndicator />
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex gap-3 border-t border-gray-100 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("practice.inputPlaceholder")}
          disabled={loading || disabled}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || disabled}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {t("practice.send")}
        </button>
      </form>
    </div>
  );
}
