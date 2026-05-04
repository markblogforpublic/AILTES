"use client";

import { useLang } from "@/lib/i18n";
import type { WeaknessItem } from "@/lib/types";
import { AlertTriangle, ArrowUp, CheckCircle2 } from "lucide-react";

interface Props {
  data: WeaknessItem[];
}

const DIM_LABELS: Record<string, string> = {
  fluency: "dim.fluency",
  lexical_resource: "dim.lexical_resource",
  naturalness: "dim.naturalness",
};

export default function WeaknessTag({ data }: Props) {
  const { t, lang } = useLang();

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
        {t("dashboard.noData")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((w, i) => {
        const label = DIM_LABELS[w.dimension] ? t(DIM_LABELS[w.dimension]) : w.dimension;
        const severity = w.avg_score < 5 ? "high" : w.avg_score < 7 ? "medium" : "low";

        const styleMap = {
          high: {
            border: "border-red-200",
            bg: "bg-red-50/80",
            icon: AlertTriangle,
            iconColor: "text-red-500",
            badge: "bg-red-100 text-red-700",
          },
          medium: {
            border: "border-amber-200",
            bg: "bg-amber-50/80",
            icon: ArrowUp,
            iconColor: "text-amber-500",
            badge: "bg-amber-100 text-amber-700",
          },
          low: {
            border: "border-emerald-200",
            bg: "bg-emerald-50/80",
            icon: CheckCircle2,
            iconColor: "text-emerald-500",
            badge: "bg-emerald-100 text-emerald-700",
          },
        };

        const s = styleMap[severity];
        const Icon = s.icon;

        return (
          <div
            key={i}
            className={`rounded-xl border ${s.border} ${s.bg} p-3.5 transition-all hover:shadow-sm`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Icon size={14} className={s.iconColor} />
                <span className="text-sm font-bold text-gray-800">{label}</span>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.badge}`}>
                {w.avg_score.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{w.advice}</p>
          </div>
        );
      })}
    </div>
  );
}
