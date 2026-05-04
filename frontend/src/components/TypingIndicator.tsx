"use client";

import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
        <Sparkles size={14} />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl bg-gray-100 px-4 py-3">
        <span className="h-2 w-2 animate-typing rounded-full bg-indigo-400" style={{ animationDelay: "0s" }} />
        <span className="h-2 w-2 animate-typing rounded-full bg-indigo-400" style={{ animationDelay: "0.2s" }} />
        <span className="h-2 w-2 animate-typing rounded-full bg-indigo-400" style={{ animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}
