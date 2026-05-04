"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

/**
 * AudioRecorder — a microphone button that records audio via the Web Audio API
 * (MediaRecorder) and sends the blob to the /respond-audio backend endpoint.
 *
 * States:
 *   idle      → show mic button
 *   recording → show stop button with pulsing animation
 *   processing → show spinner while the audio is being transcribed & evaluated
 */

interface AudioRecorderProps {
  sessionId?: string | null;
  disabled?: boolean;
  transcribeOnly?: boolean;   // if true, only transcribe (no eval, no reply)
  onResult?: (result: {       // used when transcribeOnly=false
    examiner_message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evaluation: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    feedback: any;
  }) => void;
  onError: (message: string) => void;
  onTranscribed?: (text: string) => void;
}

type RecorderState = "idle" | "recording" | "processing";

export default function AudioRecorder({
  sessionId,
  disabled,
  transcribeOnly,
  onResult,
  onError,
  onTranscribed,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Start recording ──────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (!transcribeOnly && !sessionId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Release the microphone
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          onError("No audio captured");
          setState("idle");
          return;
        }
        sendAudio(blob);
      };

      recorder.onerror = () => {
        onError("Recording error occurred");
        setState("idle");
      };

      recorder.start();
      setState("recording");
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : "Could not start recording";
      onError(msg);
      setState("idle");
    }
  }, [sessionId, onError]);

  // ── Stop recording ───────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setState("processing");
    }
  }, []);

  // ── Send audio to backend ────────────────────────────────────────

  const sendAudio = useCallback(
    async (blob: Blob) => {
      const BASE =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const formData = new FormData();
      if (sessionId) formData.append("session_id", sessionId);
      formData.append("audio", blob, "recording.webm");

      // Transcribe-only: just ASR, no evaluation/examiner reply
      const url = transcribeOnly
        ? `${BASE}/api/conversation/transcribe`
        : `${BASE}/api/conversation/respond-audio`;

      try {
        const res = await fetch(url, { method: "POST", body: formData });

        if (!res.ok) {
          const detail = await res
            .json()
            .then((d) => d.detail ?? res.statusText)
            .catch(() => res.statusText);
          throw new Error(detail);
        }

        const data = await res.json();
        if (transcribeOnly) {
          // Just return transcribed text
          onTranscribed?.(data.text || "");
        } else {
          onResult?.(data);
          onTranscribed?.(data.transcribed_text || "");
        }
      } catch (err) {
        onError(
          err instanceof Error ? err.message : "Failed to send audio"
        );
      } finally {
        setState("idle");
      }
    },
    [sessionId, transcribeOnly, onResult, onError, onTranscribed]
  );

  // ── Toggle ───────────────────────────────────────────────────────

  const handleToggle = () => {
    if (state === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  const isDisabled = disabled || (!transcribeOnly && !sessionId) || state === "processing";

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isDisabled}
      title={
        state === "recording"
          ? "Stop recording"
          : "Click to record"
      }
      className={`
        flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium
        transition-all duration-200
        ${
          state === "recording"
            ? "border-red-400 bg-red-50 text-red-600 shadow-sm shadow-red-200 animate-pulse"
            : state === "processing"
              ? "border-gray-200 bg-gray-50 text-gray-400 cursor-wait"
              : "border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {state === "processing" ? (
        <Loader2 size={18} className="animate-spin" />
      ) : state === "recording" ? (
        <Square size={16} className="fill-red-500 text-red-500" />
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
