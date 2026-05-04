/** Task data returned by the backend /api/system/task-status/{task_id} endpoint. */
export interface TaskData {
  task_id: string;
  type: string;
  progress: number;       // 0.0 – 1.0
  status: "pending" | "processing" | "completed" | "error";
  message: string;
  stage: string;
  result?: Record<string, unknown> | null;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Start polling a background task.
 *
 * @param taskId    The task id returned by the async endpoint.
 * @param onProgress Called each poll tick with the current task data.
 * @param onComplete Called once when the task reaches `"completed"` status.
 * @param onError    Called once if the task errors or a network error occurs.
 * @returns A cleanup function that stops polling when called.
 */
export function pollTask(
  taskId: string,
  onProgress: (data: TaskData) => void,
  onComplete: (data: TaskData) => void,
  onError?: (message: string) => void,
): () => void {
  let stopped = false;
  let retries = 0;
  const MAX_RETRIES = 3;

  const poll = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (!stopped) {
      try {
        const res = await fetch(`${BASE}/api/system/task-status/${taskId}`);

        if (!res.ok) {
          if (res.status === 404 && retries < MAX_RETRIES) {
            // Task may not have been written yet — retry.
            retries++;
            await sleep(1000);
            continue;
          }
          onError?.(`Server returned ${res.status}`);
          return;
        }

        retries = 0; // reset on success
        const data: TaskData = await res.json();

        if (data.status === "completed") {
          onComplete(data);
          return;
        }

        if (data.status === "error") {
          onError?.(data.message || "An unknown error occurred");
          return;
        }

        onProgress(data);
      } catch (err) {
        if (retries < MAX_RETRIES) {
          retries++;
          await sleep(1000);
          continue;
        }
        onError?.(err instanceof Error ? err.message : "Network error");
        return;
      }

      await sleep(1000);
    }
  };

  poll();

  return () => {
    stopped = true;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
