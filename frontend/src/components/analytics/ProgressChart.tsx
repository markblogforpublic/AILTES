"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useLang } from "@/lib/i18n";
import type { ProgressPoint } from "@/lib/types";

interface Props {
  data: ProgressPoint[];
}

export default function ProgressChart({ data }: Props) {
  const { t, lang } = useLang();

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
        {t("dashboard.noData")}
      </div>
    );
  }

  const formatted = data.map((p) => ({
    ...p,
    date: new Date(p.date).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-gray-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm">
        <p className="mb-2 text-xs font-semibold text-gray-500">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-bold text-gray-800">
              {Number(entry.value).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 9]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Line
          type="monotone"
          dataKey="avg_fluency"
          stroke="#6366f1"
          name={t("dim.fluency")}
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="avg_lexical"
          stroke="#10b981"
          name={t("dim.lexical")}
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="avg_naturalness"
          stroke="#f59e0b"
          name={t("dim.naturalness")}
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#f59e0b", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
