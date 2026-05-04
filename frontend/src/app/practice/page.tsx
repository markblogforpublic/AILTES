"use client";

import { useEffect, useRef, useState } from "react";
import ExamSelector from "@/components/conversation/ExamSelector";
import ChatPanel from "@/components/conversation/ChatPanel";
import AudioRecorder from "@/components/conversation/AudioRecorder";
import ScoreCard from "@/components/evaluation/ScoreCard";
import RadarChartView from "@/components/evaluation/RadarChart";
import FeedbackPanel from "@/components/feedback/FeedbackPanel";
import DevCheckModal from "@/components/DevCheckModal";
import ProgressOverlay from "@/components/ProgressOverlay";
import { getSystemStatus, sendResponseAsync, startConversation, sendResponse } from "@/lib/api";
import { pollTask, type TaskData } from "@/lib/taskClient";
import { useLang } from "@/lib/i18n";
import type { Message, EvaluationResult, FeedbackResult, RespondResponse } from "@/lib/types";
import { MessageSquare, BarChart3, MicOff, Timer, Send, Layers, AlertTriangle, Square } from "lucide-react";
import { sendResponseChat, evaluateSession } from "@/lib/api";

export default function PracticePage() {
  const { t } = useLang();
  const [part, setPart] = useState("part1");
  const [userId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ais_user_id");
      if (stored) return stored;
      const id = "user_" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("ais_user_id", id);
      return id;
    }
    return "user_" + Math.random().toString(36).slice(2, 8);
  });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLocalProvider, setIsLocalProvider] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState("");

  // Device check state
  const [deviceCheckDone, setDeviceCheckDone] = useState(false);
  const [asrAvailable, setAsrAvailable] = useState(false);

  // ── Batch mode ──
  const [batchMode, setBatchMode] = useState(false);
  const [pendingEval, setPendingEval] = useState(0);
  const [evalRunning, setEvalRunning] = useState(false);

  // ── Countdown timer ──
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Progress overlay state ──
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlayStage, setOverlayStage] = useState("");
  const cancelPollRef = useRef<(() => void) | null>(null);

  // ── Check model provider on mount ──
  useEffect(() => {
    getSystemStatus()
      .then((status) => {
        setIsLocalProvider(status.current.llm.provider === "local");
      })
      .catch(() => {
        // Backend may not be running; default to non-local
        setIsLocalProvider(false);
      });
  }, []);

  // ── Timer helpers ──

  const startTimer = () => {
    if (!timerEnabled) return;
    setTimeLeft(timerSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimeLeft(0);
  };

  // ── Batch submit handler ──

  const handleSubmitAll = async () => {
    if (!sessionId || pendingEval === 0) return;
    setEvalRunning(true);
    setError(null);
    try {
      const data = await evaluateSession(sessionId);
      if (data.results && data.results.length > 0) {
        // Show the LAST evaluation/feedback (most recent turn)
        const last = data.results[data.results.length - 1];
        setEvaluation(last.evaluation);
        setFeedback(last.feedback);
      }
      setPendingEval(0);
    } catch (err: any) {
      setError(err.message || "Batch evaluation failed");
    } finally {
      setEvalRunning(false);
    }
  };

  const handleEndSession = async () => {
    // In batch mode, evaluate first if there are pending responses
    if (batchMode && pendingEval > 0) {
      setEvalRunning(true);
      try {
        const data = await evaluateSession(sessionId!);
        if (data.results && data.results.length > 0) {
          const last = data.results[data.results.length - 1];
          setEvaluation(last.evaluation);
          setFeedback(last.feedback);
        }
      } catch (err: any) {
        setError(err.message || "Final evaluation failed");
        return;
      } finally {
        setEvalRunning(false);
      }
    }
    // Reset session state
    stopTimer();
    setSessionId(null);
    setMessages([]);
    setEvaluation(null);
    setFeedback(null);
    setStarted(false);
    setPendingEval(0);
    setBatchMode(false);
    setTimerEnabled(false);
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await startConversation(userId, part);
      setSessionId(res.session_id);
      setMessages([{ role: "examiner", content: res.examiner_message }]);
      setEvaluation(null);
      setFeedback(null);
      setStarted(true);
      startTimer();
    } catch (err) {
      setError("Failed to start conversation. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (msg: string) => {
    if (!sessionId) return;
    stopTimer();
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);

    if (batchMode) {
      // ── Batch mode: chat only, no evaluation ──
      setLoading(true);
      try {
        const res = await sendResponseChat(sessionId, msg);
        setMessages((prev) => [...prev, { role: "examiner", content: res.examiner_message }]);
        setPendingEval((n) => n + 1);
        startTimer();
      } catch (err) {
        setError("Failed to get response. Is the backend running?");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Instant mode (existing flow) ──
    if (isLocalProvider) {
      setLoading(true);
      setOverlayProgress(0);
      setOverlayMessage("Starting...");
      setOverlayStage("Preparing");
      setOverlayVisible(true);

      try {
        const { task_id } = await sendResponseAsync(sessionId, msg);
        cancelPollRef.current = pollTask(
          task_id,
          (data: TaskData) => {
            setOverlayProgress(data.progress);
            setOverlayMessage(data.message);
            setOverlayStage(data.stage);
          },
          (data: TaskData) => {
            setOverlayVisible(false);
            setLoading(false);
            const result = data.result as { examiner_message: string; evaluation: EvaluationResult; feedback: FeedbackResult } | null;
            if (result) {
              setMessages((prev) => [...prev, { role: "examiner", content: result.examiner_message }]);
              setEvaluation(result.evaluation);
              setFeedback(result.feedback);
            }
            startTimer();
          },
          (errorMessage: string) => {
            setOverlayVisible(false);
            setLoading(false);
            setError(errorMessage);
          },
        );
      } catch (err) {
        setOverlayVisible(false);
        setLoading(false);
        setError("Failed to start async response");
      }
    } else {
      setLoading(true);
      try {
        const res: RespondResponse = await sendResponse(sessionId, msg);
        setMessages((prev) => [...prev, { role: "examiner", content: res.examiner_message }]);
        setEvaluation(res.evaluation);
        setFeedback(res.feedback);
        startTimer();
      } catch (err) {
        setError("Failed to get response. Check your API keys and backend.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    if (cancelPollRef.current) {
      cancelPollRef.current();
      cancelPollRef.current = null;
    }
    setOverlayVisible(false);
    setLoading(false);
  };

  // ── Device check not done yet: show modal ──
  if (!deviceCheckDone) {
    return (
      <DevCheckModal
        onComplete={({ asr_available }) => {
          setDeviceCheckDone(true);
          setAsrAvailable(asr_available);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2 shrink-0">✕</button>
        </div>
      )}

      {/* Progress overlay for long operations */}
      <ProgressOverlay
        visible={overlayVisible}
        progress={overlayProgress}
        message={overlayMessage}
        stage={overlayStage}
        onCancel={handleCancel}
      />

      {/* Local model slow warning */}
      {isLocalProvider && started && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Local models may take 30+ seconds per response. Consider using API mode for faster practice.</span>
        </div>
      )}

      {/* ── Toolbar: batch mode + timer ── */}
      {started && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5">
          {/* Batch mode toggle */}
          <button
            onClick={() => { setBatchMode(!batchMode); if (batchMode) setPendingEval(0); }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
              batchMode ? "border-purple-400 bg-purple-50 text-purple-700" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}
          >
            <Layers size={14} />
            {batchMode ? "Batch: ON" : "Batch: OFF"}
          </button>

          {/* Timer toggle */}
          <button
            onClick={() => { setTimerEnabled(!timerEnabled); if (timerEnabled) stopTimer(); }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
              timerEnabled ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            }`}
          >
            <Timer size={14} />
            {timerEnabled ? "Timer: ON" : "Timer: OFF"}
          </button>

          {/* Timer duration input */}
          {timerEnabled && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={10}
                max={600}
                value={timerSeconds}
                onChange={(e) => { setTimerSeconds(Number(e.target.value)); stopTimer(); }}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs text-center outline-none focus:border-blue-400"
              />
              <span className="text-xs text-gray-400">sec</span>
            </div>
          )}

          {/* Countdown display */}
          {timerEnabled && timeLeft > 0 && (
            <span className={`ml-auto text-sm font-mono font-bold ${timeLeft <= 10 ? "text-red-600 animate-pulse" : "text-blue-600"}`}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}

          {/* Submit All button (batch mode) */}
          {batchMode && pendingEval > 0 && (
            <button
              onClick={handleSubmitAll}
              disabled={evalRunning || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
            >
              <Send size={14} />
              {evalRunning ? "Analyzing..." : `Submit All (${pendingEval})`}
            </button>
          )}

          {/* End Session button */}
          <button
            onClick={handleEndSession}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all"
          >
            <Square size={14} className="fill-red-500 text-red-500" />
            End Session
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
          <MessageSquare size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("practice.title")}</h1>
          <p className="text-sm text-gray-400">
            {sessionId
              ? `Session: ${sessionId.slice(0, 8)}...`
              : "Ready to begin"}
          </p>
        </div>
        {!asrAvailable && (
          <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-700">
            <MicOff size={14} />
            Voice disabled
          </div>
        )}
      </div>

      {/* Exam Part Selector + Start/End */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <ExamSelector selected={part} onChange={setPart} disabled={started} />
        </div>
        {!started ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 text-sm font-medium text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? t("practice.starting") : t("practice.start")}
          </button>
        ) : (
          <button
            onClick={() => {
              setStarted(false);
              setSessionId(null);
              setMessages([]);
              setEvaluation(null);
              setFeedback(null);
              handleCancel();
            }}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400"
          >
            {t("practice.end")}
          </button>
        )}
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Chat Panel */}
        <div className="flex h-[600px] flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm lg:col-span-3">
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            loading={loading}
            disabled={!started}
            statusMessage={overlayVisible ? overlayMessage : undefined}
            progress={overlayVisible ? overlayProgress : undefined}
            fillText={voiceText}
            onFillConsumed={() => setVoiceText("")}
          />
          {/* Audio error toast */}
          {audioError && (
            <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 flex items-center justify-between animate-slide-up">
              <span>{audioError}</span>
              <button
                onClick={() => setAudioError(null)}
                className="ml-2 font-semibold hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          )}
          {/* Audio recorder bar — only shown when ASR is available */}
          {asrAvailable && (
            <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3">
              <AudioRecorder
                disabled={loading || !started}
                transcribeOnly
                onTranscribed={(text) => setVoiceText(text)}
                onError={(msg) => setAudioError(msg)}
              />
              <span className="text-xs text-gray-400">
                {started
                  ? "Click mic to record your response"
                  : "Start a session to record"}
              </span>
            </div>
          )}
        </div>

        {/* Evaluation + Feedback sidebar */}
        <div className="space-y-4 lg:col-span-2">
          {!evaluation && started && (
            <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/50 text-sm text-gray-400">
              <div className="text-center">
                <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
                {t("practice.waitingEval")}
              </div>
            </div>
          )}

          {evaluation && feedback && (
            <div className="h-[600px] space-y-4 overflow-y-auto pr-1">
              <div className="animate-slide-up">
                <RadarChartView data={evaluation} />
              </div>

              <div className="grid gap-3 animate-fade-in">
                <ScoreCard label={t("dim.fluency")} data={evaluation.fluency} />
                <ScoreCard label={t("dim.lexical_resource")} data={evaluation.lexical_resource} />
                <ScoreCard label={t("dim.naturalness")} data={evaluation.naturalness} />
              </div>

              <div className="animate-fade-in rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-gray-700">
                  {t("practice.feedbackTitle")}
                </h3>
                <FeedbackPanel data={feedback} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
