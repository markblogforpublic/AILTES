"""In-memory task tracker for long-running operations.

Provides a simple dict-based store that lets API handlers return a task_id
immediately and update progress as the background work proceeds. Tasks
auto-expire after TASK_TTL seconds to prevent memory leaks.
"""

import time
import uuid
from threading import Lock

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TASK_TTL = 300  # seconds (5 minutes)

# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------

_tasks: dict[str, dict] = {}
_lock = Lock()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_task(task_type: str) -> str:
    """Create a new task entry and return its unique id."""
    task_id = str(uuid.uuid4())
    now = time.time()
    with _lock:
        _tasks[task_id] = {
            "task_id": task_id,
            "type": task_type,
            "progress": 0.0,
            "status": "pending",
            "message": "Task created",
            "stage": "",
            "result": None,
            "created_at": now,
        }
    return task_id


def update_task(
    task_id: str,
    progress: float | None = None,
    status: str | None = None,
    message: str | None = None,
    stage: str | None = None,
    result: object = None,
) -> None:
    """Update fields on an existing task. Silently no-ops on unknown id."""
    with _lock:
        entry = _tasks.get(task_id)
        if entry is None:
            return
        if progress is not None:
            entry["progress"] = progress
        if status is not None:
            entry["status"] = status
        if message is not None:
            entry["message"] = message
        if stage is not None:
            entry["stage"] = stage
        if result is not None:
            entry["result"] = result


def get_task(task_id: str) -> dict | None:
    """Return a copy of the task dict, or None if not found / expired."""
    _purge_expired()
    with _lock:
        entry = _tasks.get(task_id)
        if entry is None:
            return None
        # Exclude internal fields from the public view
        return {
            k: v
            for k, v in entry.items()
            if k in ("task_id", "type", "progress", "status", "message", "stage", "result")
        }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _purge_expired() -> None:
    """Remove tasks older than TASK_TTL seconds."""
    now = time.time()
    cutoff = now - TASK_TTL
    with _lock:
        expired = [tid for tid, t in _tasks.items() if t["created_at"] < cutoff]
        for tid in expired:
            del _tasks[tid]
