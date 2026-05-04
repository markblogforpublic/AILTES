"""Data access layer — wraps MongoDB operations with in-memory fallback."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.db.database import get_db, ping_db
from app.models.domain import ConversationSession, ExamPart

# In-memory fallback storage when MongoDB is unavailable
_memory_sessions: dict[str, ConversationSession] = {}
_db_available: bool | None = None


async def _is_db_available() -> bool:
    """Check once if MongoDB is reachable; cache the result."""
    global _db_available
    if _db_available is None:
        _db_available = await ping_db()
    return _db_available


async def _get_db() -> AsyncIOMotorDatabase | None:
    if await _is_db_available():
        return await get_db()
    return None


# ─── Sessions ───

async def create_session(
    user_id: str,
    part: ExamPart,
    topic: str,
    db: AsyncIOMotorDatabase | None = None,
) -> ConversationSession:
    session = ConversationSession(
        session_id=uuid4().hex[:12],
        user_id=user_id,
        part=part,
        topic=topic,
    )
    db = db or await _get_db()
    if db is not None:
        try:
            await db[settings.mongodb_db_name].insert_one(session.model_dump())
        except Exception:
            _memory_sessions[session.session_id] = session
    else:
        _memory_sessions[session.session_id] = session
    return session


async def get_session(
    session_id: str,
    db: AsyncIOMotorDatabase | None = None,
) -> ConversationSession | None:
    # Check in-memory first
    if session_id in _memory_sessions:
        return _memory_sessions[session_id]

    db = db or await _get_db()
    if db is not None:
        try:
            doc = await db[settings.mongodb_db_name].find_one({"session_id": session_id})
            if doc:
                return ConversationSession(**doc)
        except Exception:
            pass
    return None


async def update_session(
    session: ConversationSession,
    db: AsyncIOMotorDatabase | None = None,
):
    # Always update in-memory copy
    _memory_sessions[session.session_id] = session

    db = db or await _get_db()
    if db is not None:
        try:
            await db[settings.mongodb_db_name].replace_one(
                {"session_id": session.session_id}, session.model_dump()
            )
        except Exception:
            pass  # in-memory fallback already set


# ─── Analytics ───

async def get_user_sessions_last_days(
    user_id: str, days: int = 30
) -> list[ConversationSession]:
    result: list[ConversationSession] = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Check in-memory
    for s in _memory_sessions.values():
        if s.user_id == user_id and s.started_at >= cutoff:
            result.append(s)

    # Try MongoDB for additional data
    db = await _get_db()
    if db is not None:
        try:
            cursor = db[settings.mongodb_db_name].find(
                {"user_id": user_id, "started_at": {"$gte": cutoff}}
            )
            async for doc in cursor:
                result.append(ConversationSession(**doc))
        except Exception:
            pass

    return result
