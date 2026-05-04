"""Tests for the feedback parser (no LLM calls)."""

from app.core.feedback_generator import _parse_feedback
from app.models.domain import FeedbackResult


def test_parse_feedback_json():
    raw = """
{
    "error_highlights": [
        {
            "text": "make a good communicate",
            "type": "grammar",
            "suggestion": "communicate well"
        }
    ],
    "rewrites": [
        {
            "original": "make a good communicate",
            "improved": "communicate effectively",
            "reason": "Use verb form correctly"
        }
    ],
    "summary": "Focus on verb forms and collocations."
}
    """
    result = _parse_feedback(raw)
    assert isinstance(result, FeedbackResult)
    assert len(result.error_highlights) == 1
    assert result.error_highlights[0].type == "grammar"
    assert len(result.rewrites) == 1
    assert "verb forms" in result.summary
