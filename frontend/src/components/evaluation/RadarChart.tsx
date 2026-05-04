"use client";

import {
  RadarChart as RechartRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useLang } from "@/lib/i18n";
import type { EvaluationResult } from "@/lib/types";

interface Props {
  data: EvaluationResult;
}

export default function RadarChartView({ data }: Props) {
  const { t } = useLang();

  const chartData = [
    { dimension: t("dim.fluency"), score: data.fluency.score },
    { dimension: t("dim.lexical_resource"), score: data.lexical_resource.score },
    { dimension: t("dim.naturalness"), score: data.naturalness.score },
  ];

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-gray-700">{t("practice.scoreTitle")}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <RechartRadar data={chartData} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="#e5e7eb" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: "#6b7280" }}
          />
          <PolarRadiusAxis domain={[0, 9]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.15}
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }}
          />
        </RechartRadar>
      </ResponsiveContainer>
    </div>
  );
}
