"use client";

import { Sparkles, User } from "lucide-react";
import type { Message } from "@/lib/types";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-gray-600 to-gray-700 text-white"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
        }`}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-200"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
