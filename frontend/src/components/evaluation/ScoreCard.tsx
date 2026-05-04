"use client";

import type { DimensionScore } from "@/lib/types";

interface Props {
  label: string;
  data: DimensionScore;
}

export default function ScoreCard({ label, data }: Props) {
  const band = Math.round(data.score);
  const color =
    band >= 7 ? "text-emerald-600" : band >= 5 ? "text-amber-600" : "text-red-500";
  const barColor =
    band >= 7
      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
      : band >= 5
        ? "bg-gradient-to-r from-amber-400 to-amber-500"
        : "bg-gradient-to-r from-red-400 to-red-500";

  return (
    <div className="card-hover group rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">{label}</span>
        <span className={`text-2xl font-extrabold ${color} tabular-nums`}>
          {data.score.toFixed(1)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${(data.score / 9) * 100}%` }}
        />
      </div>

      {/* Evidence */}
      <p className="text-xs leading-relaxed text-gray-500">{data.evidence}</p>

      {/* Explanation */}
      {data.explanation && (
        <p className="mt-1.5 text-xs leading-relaxed text-gray-400 italic">
          {data.explanation}
        </p>
      )}
    </div>
  );
}
