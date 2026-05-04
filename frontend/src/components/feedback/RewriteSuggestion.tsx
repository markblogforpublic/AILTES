"use client";

import { ArrowRight } from "lucide-react";
import type { RewriteSuggestion as RewriteType } from "@/lib/types";

interface Props {
  data: RewriteType;
}

export default function RewriteSuggestion({ data }: Props) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-white p-3.5 shadow-sm transition-all hover:border-emerald-200 hover:shadow">
      <div className="flex items-start gap-2 text-sm">
        <span className="mt-0.5 text-gray-400 line-through decoration-gray-300">
          {data.original}
        </span>
        <ArrowRight size={14} className="mt-0.5 shrink-0 text-emerald-500" />
        <span className="font-medium text-emerald-700">{data.improved}</span>
      </div>
      <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{data.reason}</p>
    </div>
  );
}
