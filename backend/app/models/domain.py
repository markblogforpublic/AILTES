"""Domain entities shared across the application."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExamPart(str, Enum):
    PART1 = "part1"
    PART2 = "part2"
    PART3 = "part3"


class DimensionScore(BaseModel):
    score: float = Field(ge=1, le=9)   # IELTS-style 1-9 band
    evidence: str                       # what in the user's response supports this score
    explanation: str                    # why this score was given
    confidence: Optional[float] = Field(default=None, ge=0, le=1)  # how confident the evaluator is (0-1)


class EvaluationResult(BaseModel):
    fluency: DimensionScore
    lexical_resource: DimensionScore
    naturalness: DimensionScore


class ErrorHighlight(BaseModel):
    text: str                           # the problematic text span
    type: str                           # e.g. "collocation", "grammar", "word_choice"
    suggestion: str                     # suggested fix


class RewriteSuggestion(BaseModel):
    original: str                       # original user text
    improved: str                       # rewritten version
    reason: str                         # why the rewrite is better


class FeedbackResult(BaseModel):
    error_highlights: list[ErrorHighlight] = []
    rewrites: list[RewriteSuggestion] = []
    summary: str                        # overall feedback summary


class ConversationTurn(BaseModel):
    role: str                          # "examiner" | "user"
    content: str
    evaluation: Optional[EvaluationResult] = None
    feedback: Optional[FeedbackResult] = None
    created_at: datetime = Field(default_factory=_utcnow)


class ConversationSession(BaseModel):
    session_id: str
    user_id: str
    part: ExamPart
    topic: str
    turns: list[ConversationTurn] = []
    started_at: datetime = Field(default_factory=_utcnow)
    completed_at: Optional[datetime] = None
