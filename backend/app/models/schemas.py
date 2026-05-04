"""API request/response schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .domain import (
    EvaluationResult,
    ExamPart,
    FeedbackResult,
)


# ─── Conversation ───

class StartConversationRequest(BaseModel):
    user_id: str
    part: ExamPart = ExamPart.PART1
    topic: Optional[str] = None


class StartConversationResponse(BaseModel):
    session_id: str
    part: ExamPart
    topic: str
    examiner_message: str


class RespondRequest(BaseModel):
    session_id: str
    user_message: str


class RespondResponse(BaseModel):
    examiner_message: str
    evaluation: EvaluationResult
    feedback: FeedbackResult


# ─── Analytics ───

class ProgressPoint(BaseModel):
    date: datetime
    avg_fluency: float
    avg_lexical: float
    avg_naturalness: float


class ProgressResponse(BaseModel):
    trends: list[ProgressPoint]


class WeaknessItem(BaseModel):
    dimension: str
    avg_score: float
    advice: str


class WeaknessResponse(BaseModel):
    weaknesses: list[WeaknessItem]
