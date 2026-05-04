"""Task-status API endpoints.

Provides a simple polling endpoint so the frontend can track the progress
of long-running operations (model loading, evaluation, feedback generation).
"""

from fastapi import APIRouter, HTTPException

from app.core.task_manager import get_task

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """Return the current progress of a background task.

    Returns 404 if the task id is unknown or has already expired.
    """
    task = get_task(task_id)
    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found or has expired",
        )
    return task
