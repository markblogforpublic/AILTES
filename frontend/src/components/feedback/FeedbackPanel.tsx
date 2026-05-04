"use client";

import { AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { FeedbackResult } from "@/lib/types";
import RewriteSuggestion from "./RewriteSuggestion";

interface Props {
  data: FeedbackResult;
}

export default function FeedbackPanel({ data }: Props) {
  const { t } = useLang();

  return (
    <div className="space-y-4">
      {/* Error highlights */}
      {data.error_highlights.length > 0 && (
        <div>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-red-600">
            <AlertCircle size={16} /> {t("practice.errorsTitle")}
          </h4>
          <div className="space-y-2">
            {data.error_highlights.map((e, i) => (
              <div
                key={i}
                className="rounded-xl border border-red-100 bg-red-50/70 p-3 transition-all hover:border-red-200"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 rounded-md bg-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {e.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-red-700 line-through decoration-red-300">
                      {e.text}
                    </p>
                    <p className="mt-1 text-sm font-medium text-emerald-700">
                      &#8594; {e.suggestion}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewrite suggestions */}
      {data.rewrites.length > 0 && (
        <div>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-emerald-600">
            <CheckCircle2 size={16} /> {t("practice.rewritesTitle")}
          </h4>
          <div className="space-y-2">
            {data.rewrites.map((r, i) => (
              <RewriteSuggestion key={i} data={r} />
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex items-start gap-2.5">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-indigo-500" />
          <p className="text-sm leading-relaxed text-indigo-800">{data.summary}</p>
        </div>
      </div>
    </div>
  );
}
