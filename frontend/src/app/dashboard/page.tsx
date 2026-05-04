"use client";

import { useEffect, useState } from "react";
import ProgressChart from "@/components/analytics/ProgressChart";
import WeaknessTag from "@/components/analytics/WeaknessTag";
import { getProgress, getWeaknesses } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import type { ProgressPoint, WeaknessItem } from "@/lib/types";
import { LayoutDashboard, TrendingUp, AlertTriangle } from "lucide-react";

const USER_ID = (() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ais_user_id") || "user_demo";
  }
  return "user_demo";
})();

export default function DashboardPage() {
  const { t } = useLang();
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProgress(USER_ID), getWeaknesses(USER_ID)])
      .then(([p, w]) => {
        setProgress(p);
        setWeaknesses(w);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-6 w-32 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LoadingSkeleton type="chart" />
          </div>
          <div>
            <LoadingSkeleton type="card" count={3} />
          </div>
        </div>
      </div>
    );
  }

  const latestScores =
    progress.length > 0
      ? {
          fluency: progress[progress.length - 1].avg_fluency.toFixed(1),
          lexical: progress[progress.length - 1].avg_lexical.toFixed(1),
          naturalness: progress[progress.length - 1].avg_naturalness.toFixed(1),
          average: (
            (progress[progress.length - 1].avg_fluency +
              progress[progress.length - 1].avg_lexical +
              progress[progress.length - 1].avg_naturalness) /
            3
          ).toFixed(1),
        }
      : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
          <LayoutDashboard size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.title")}</h1>
          <p className="text-sm text-gray-400">Your performance overview</p>
        </div>
      </div>

      {/* Score summary cards */}
      {latestScores && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: t("dim.fluency"), value: latestScores.fluency, gradient: "from-blue-500 to-cyan-500" },
            { label: t("dim.lexical"), value: latestScores.lexical, gradient: "from-indigo-500 to-purple-500" },
            { label: t("dim.naturalness"), value: latestScores.naturalness, gradient: "from-rose-500 to-pink-500" },
            { label: t("history.average"), value: latestScores.average, gradient: "from-emerald-500 to-teal-500" },
          ].map((s) => (
            <div
              key={s.label}
              className="card-hover group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm"
            >
              <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${s.gradient} opacity-10 blur-xl`} />
              <div className="relative">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{s.label}</p>
                <p className={`mt-1.5 text-3xl font-bold bg-gradient-to-br ${s.gradient} bg-clip-text text-transparent`}>
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" />
              <h3 className="text-sm font-bold text-gray-700">{t("dashboard.scoreTrends")}</h3>
            </div>
            <ProgressChart data={progress} />
          </div>
        </div>
        <div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="text-sm font-bold text-gray-700">{t("dashboard.areasToImprove")}</h3>
            </div>
            <WeaknessTag data={weaknesses} />
          </div>
        </div>
      </div>
    </div>
  );
}
