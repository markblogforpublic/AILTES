"use client";

import { useLang } from "@/lib/i18n";

interface Props {
  selected: string;
  onChange: (part: string) => void;
  disabled?: boolean;
}

const PARTS = [
  { id: "part1", labelKey: "practice.part1", descKey: "practice.part1Desc" },
  { id: "part2", labelKey: "practice.part2", descKey: "practice.part2Desc" },
  { id: "part3", labelKey: "practice.part3", descKey: "practice.part3Desc" },
];

export default function ExamSelector({ selected, onChange, disabled }: Props) {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {PARTS.map((p) => {
        const isSelected = selected === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            disabled={disabled}
            className={`flex-1 rounded-xl border-2 p-3 text-left transition-all duration-200 ${
              isSelected
                ? "border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <div className={`text-sm font-bold ${isSelected ? "text-indigo-700" : "text-gray-700"}`}>
              {t(p.labelKey)}
            </div>
            <div className="mt-0.5 text-xs text-gray-400">{t(p.descKey)}</div>
          </button>
        );
      })}
    </div>
  );
}
