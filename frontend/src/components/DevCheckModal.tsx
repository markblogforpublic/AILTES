"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "@/lib/i18n";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mic,
  Brain,
  RefreshCw,
  Square,
  X,
} from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────

type CheckStatus = "checking" | "pass" | "not_configured" | "fail";

interface CheckResult {
  status: CheckStatus;
  detail: string;
}

interface SystemCheckResult {
  asr: CheckResult;
  llm: CheckResult;
  passed: boolean;
}

interface DevCheckModalProps {
  onComplete: (result: { passed: boolean; asr_available: boolean }) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

export default function DevCheckModal({ onComplete }: DevCheckModalProps) {
  const { t } = useLang();

  const [result, setResult] = useState<SystemCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const runCheck = async () => {
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/system/check`);
      if (!res.ok) {
        const detail = await res
          .json()
          .then((d) => d.detail ?? res.statusText)
          .catch(() => res.statusText);
        throw new Error(detail);
      }
      const data: SystemCheckResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Connection failed. Is the backend running?");
    } finally {
      setChecking(false);
    }
  };

  // Auto-check on mount
  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Microphone test state ──

  type MicState = "idle" | "recording" | "processing" | "done";
  const [micState, setMicState] = useState<MicState>("idle");
  const [micText, setMicText] = useState("");
  const [micError, setMicError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startMicTest = useCallback(async () => {
    setMicError("");
    setMicText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setMicError("No audio captured — try again");
          setMicState("idle");
          return;
        }
        sendMicAudio(blob);
      };

      recorder.start();
      setMicState("recording");
    } catch (err: any) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setMicError(t("devCheck.micPermission"));
      } else {
        setMicError(err.message || t("devCheck.micFailed"));
      }
      setMicState("idle");
    }
  }, [t]);

  const stopMicTest = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setMicState("processing");
    }
  }, []);

  const sendMicAudio = useCallback(async (blob: Blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    try {
      const res = await fetch(`${BASE}/api/system/check-asr`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().then((d) => d.detail ?? res.statusText).catch(() => res.statusText);
        throw new Error(detail);
      }
      const data = await res.json();
      setMicText(data.text || "(empty result)");
      setMicState("done");
    } catch (err: any) {
      setMicError(err.message || t("devCheck.micFailed"));
      setMicState("idle");
    }
  }, [t]);

  // ── Derived state ──

  const asrAvailable = result?.asr.status === "pass";
  const llmPassed = result?.llm.status === "pass";
  const canStart = result?.passed === true; // llm must be "pass"

  // ── Status icon helpers ──

  const statusIcon = (status: CheckStatus, size = 22) => {
    switch (status) {
      case "checking":
        return <Loader2 size={size} className="animate-spin text-gray-400" />;
      case "pass":
        return <CheckCircle2 size={size} className="text-emerald-500" />;
      case "not_configured":
        return <AlertTriangle size={size} className="text-amber-500" />;
      case "fail":
        return <XCircle size={size} className="text-red-500" />;
    }
  };

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
        {/* Close button */}
        <button
          onClick={() => onComplete({ passed: true, asr_available: asrAvailable })}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title={t("devCheck.close")}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Brain size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            {t("devCheck.title")}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("devCheck.subtitle")}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <XCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Check items */}
        <div className="space-y-3 mb-6">
          {/* ── ASR row ── */}
          <div
            className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
              result
                ? result.asr.status === "pass"
                  ? "border-emerald-100 bg-emerald-50/50"
                  : result.asr.status === "not_configured"
                    ? "border-amber-100 bg-amber-50/50"
                    : "border-red-100 bg-red-50/50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <Mic size={18} className="text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {t("devCheck.asr")}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {checking
                  ? t("devCheck.checking")
                  : result
                    ? result.asr.detail
                    : ""}
              </p>
            </div>
            <div className="shrink-0">
              {checking
                ? statusIcon("checking")
                : result
                  ? statusIcon(result.asr.status)
                  : null}
            </div>
          </div>

          {/* ── Mic Test (real voice transcription) ── */}
          <div className="ml-12">
            {micState === "idle" && !micText && (
              <button
                onClick={startMicTest}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <Mic size={14} />
                {t("devCheck.micTest")}
              </button>
            )}

            {micState === "recording" && (
              <button
                onClick={stopMicTest}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 animate-pulse hover:bg-red-100"
              >
                <Square size={14} className="fill-red-500 text-red-500" />
                {t("devCheck.micRecording")}
              </button>
            )}

            {micState === "processing" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                {t("devCheck.checking")}
              </span>
            )}

            {micText && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                <p className="text-xs text-emerald-700 font-medium mb-0.5">
                  {t("devCheck.micResult")}
                </p>
                <p className="text-sm text-gray-800 italic">"{micText}"</p>
                {micState === "done" && (
                  <button
                    onClick={startMicTest}
                    className="mt-1 text-xs text-indigo-500 hover:text-indigo-600"
                  >
                    {t("devCheck.checkAgain")}
                  </button>
                )}
              </div>
            )}

            {micError && (
              <p className="text-xs text-red-500 mt-1">{micError}</p>
            )}
          </div>

          {/* ── LLM row ── */}
          <div
            className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
              result
                ? result.llm.status === "pass"
                  ? "border-emerald-100 bg-emerald-50/50"
                  : "border-red-100 bg-red-50/50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <Brain size={18} className="text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {t("devCheck.llm")}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {checking
                  ? t("devCheck.checking")
                  : result
                    ? result.llm.detail
                    : ""}
              </p>
            </div>
            <div className="shrink-0">
              {checking
                ? statusIcon("checking")
                : result
                  ? statusIcon(result.llm.status)
                  : null}
            </div>
          </div>
        </div>

        {/* Informational messages */}
        {result && !checking && (
          <>
            {/* ASR not available but LLM OK → warning + still can start */}
            {!asrAvailable && canStart && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{t("devCheck.asrWarning")}</span>
              </div>
            )}

            {/* LLM failed → blocks practice */}
            {!canStart && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                <span>{t("devCheck.llmError")}</span>
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {/* "Check Again" — shown when a previous check failed */}
          {result && !canStart && (
            <button
              onClick={runCheck}
              disabled={checking}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={checking ? "animate-spin" : ""}
              />
              {t("devCheck.checkAgain")}
            </button>
          )}

          {/* "Run Check" — initial state */}
          {!result && (
            <button
              onClick={runCheck}
              disabled={checking}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-medium text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {checking ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {checking ? t("devCheck.checking") : t("devCheck.runCheck")}
            </button>
          )}

          {/* "Start Practice" — shown when LLM passes (ASR may or may not work) */}
          {canStart && (
            <button
              onClick={() =>
                onComplete({ passed: true, asr_available: asrAvailable })
              }
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-medium text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              {t("devCheck.startPractice")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
