"use client";

import { X } from "lucide-react";

interface ProgressOverlayProps {
  visible: boolean;
  progress: number; // 0.0 – 1.0
  message: string;
  stage: string;
  onCancel?: () => void;
}

export default function ProgressOverlay({
  visible,
  progress,
  message,
  stage,
  onCancel,
}: ProgressOverlayProps) {
  if (!visible) return null;

  const percent = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl shadow-black/20 animate-scale-up">
        {/* ── Header ── */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
            <svg
              className="h-7 w-7 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">
            Processing your response
          </h3>
        </div>

        {/* ── Stage indicator ── */}
        {stage && (
          <div className="mb-3 text-center">
            <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
              {stage}
            </span>
          </div>
        )}

        {/* ── Progress bar ── */}
        <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
            style={{
              width: `${percent}%`,
              backgroundSize: "200% 100%",
              animation: "shimmer 2s linear infinite",
            }}
          />
        </div>

        {/* ── Percentage ── */}
        <div className="mb-1 text-center">
          <span className="text-sm font-semibold text-gray-700">{percent}%</span>
        </div>

        {/* ── Status message ── */}
        <p className="text-center text-sm text-gray-500">{message}</p>

        {/* ── Cancel button ── */}
        {onCancel && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
