"use client";

import { useEffect, useState } from "react";
import { getProgress } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import type { ProgressPoint } from "@/lib/types";
import { History, Calendar, TrendingUp } from "lucide-react";

const USER_ID = (() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ais_user_id") || "user_demo";
  }
  return "user_demo";
})();

export default function HistoryPage() {
  const { t, lang } = useLang();
  const [data, setData] = useState<ProgressPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgress(USER_ID, 90)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-6 w-40 animate-pulse rounded-full bg-gray-200" />
        </div>
        <LoadingSkeleton type="table" count={8} />
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 7) return "text-emerald-600";
    if (score >= 5) return "text-amber-600";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 7) return "bg-emerald-100 text-emerald-700";
    if (score >= 5) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-600";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
          <History size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("history.title")}</h1>
          <p className="text-sm text-gray-400">
            {data.length > 0
              ? `${data.length} sessions recorded`
              : "Track your progress over time"}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/50 py-20 text-center">
          <Calendar size={48} className="mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">{t("history.empty")}</p>
          <p className="mt-1 text-sm text-gray-400">{t("history.emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      {t("history.date")}
                    </div>
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-blue-400" />
                      {t("history.fluency")}
                    </div>
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-400" />
                      {t("history.lexical")}
                    </div>
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-amber-400" />
                      {t("history.naturalness")}
                    </div>
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t("history.average")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((p, i) => {
                  const avg = ((p.avg_fluency + p.avg_lexical + p.avg_naturalness) / 3).toFixed(1);
                  const date = new Date(p.date).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <tr
                      key={i}
                      className="transition-colors hover:bg-indigo-50/40 even:bg-gray-50/30"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-700">
                        {date}
                      </td>
                      <td className={`px-5 py-4 font-medium ${getScoreColor(p.avg_fluency)}`}>
                        {p.avg_fluency.toFixed(1)}
                      </td>
                      <td className={`px-5 py-4 font-medium ${getScoreColor(p.avg_lexical)}`}>
                        {p.avg_lexical.toFixed(1)}
                      </td>
                      <td className={`px-5 py-4 font-medium ${getScoreColor(p.avg_naturalness)}`}>
                        {p.avg_naturalness.toFixed(1)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold ${getScoreBg(Number(avg))}`}
                        >
                          {avg}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
