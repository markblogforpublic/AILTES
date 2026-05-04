"""Analytics API endpoints."""

from fastapi import APIRouter, Query

from app.core.analytics_engine import analyze_weaknesses, get_progress_trend
from app.db.repositories import get_user_sessions_last_days
from app.models.schemas import ProgressResponse, WeaknessResponse

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/progress")
async def progress(user_id: str = Query(...), days: int = Query(default=30)) -> ProgressResponse:
    """Get user's score trends over time."""
    sessions = await get_user_sessions_last_days(user_id, days)
    trends = await get_progress_trend(sessions)
    return ProgressResponse(trends=trends)


@router.get("/weakness")
async def weakness(user_id: str = Query(...)) -> WeaknessResponse:
    """Identify user's weakest dimensions with advice."""
    sessions = await get_user_sessions_last_days(user_id, 90)
    weaknesses = await analyze_weaknesses(sessions)
    return WeaknessResponse(weaknesses=weaknesses)
