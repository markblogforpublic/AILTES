import type { StartResponse, RespondResponse, ProgressPoint, WeaknessItem } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function startConversation(userId: string, part: string, topic?: string): Promise<StartResponse> {
  return fetchJSON<StartResponse>(`${BASE}/api/conversation/start`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, part, topic }),
  });
}

export async function sendResponse(sessionId: string, message: string): Promise<RespondResponse> {
  return fetchJSON<RespondResponse>(`${BASE}/api/conversation/respond`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, user_message: message }),
  });
}

export async function sendResponseAsync(sessionId: string, message: string): Promise<{ task_id: string }> {
  return fetchJSON<{ task_id: string }>(`${BASE}/api/conversation/respond-async`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, user_message: message }),
  });
}

export async function sendAudioResponse(
  sessionId: string,
  audioBlob: Blob
): Promise<RespondResponse> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("audio", audioBlob, "recording.webm");

  const res = await fetch(`${BASE}/api/conversation/respond-audio`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => d.detail ?? res.statusText)
      .catch(() => res.statusText);
    throw new Error(detail);
  }
  return res.json();
}

export async function getProgress(userId: string, days = 30): Promise<ProgressPoint[]> {
  const data = await fetchJSON<{ trends: ProgressPoint[] }>(
    `${BASE}/api/analytics/progress?user_id=${userId}&days=${days}`
  );
  return data.trends;
}

export async function getWeaknesses(userId: string): Promise<WeaknessItem[]> {
  const data = await fetchJSON<{ weaknesses: WeaknessItem[] }>(
    `${BASE}/api/analytics/weakness?user_id=${userId}`
  );
  return data.weaknesses;
}

export interface SystemStatus {
  current: {
    llm: { provider: string; model: string };
    asr: { provider: string; model: string };
  };
}

export async function sendResponseChat(sessionId: string, message: string): Promise<{ examiner_message: string }> {
  return fetchJSON<{ examiner_message: string }>(`${BASE}/api/conversation/respond-chat`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, user_message: message }),
  });
}

export async function evaluateSession(sessionId: string): Promise<{ ok: boolean; results: { content: string; evaluation: any; feedback: any }[] }> {
  return fetchJSON(`${BASE}/api/conversation/evaluate/${sessionId}`, { method: "POST" });
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return fetchJSON<SystemStatus>(`${BASE}/api/models/status`);
}
