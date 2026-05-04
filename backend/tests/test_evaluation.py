"""Tests for the evaluation parser (no LLM calls)."""

import pytest

from app.core.evaluator import _parse_evaluation
from app.models.domain import EvaluationResult


def test_parse_evaluation_json():
    raw = """
{
    "fluency": {
        "score": 6.5,
        "evidence": "The candidate spoke at length with some hesitation",
        "explanation": "Good overall flow but occasional pauses"
    },
    "lexical_resource": {
        "score": 6.0,
        "evidence": "Used some less common vocabulary",
        "explanation": "Adequate range but lacks flexibility"
    },
    "naturalness": {
        "score": 5.5,
        "evidence": "Some phrasing felt translated",
        "explanation": "Meaning is clear but expression is not idiomatic"
    }
}
    """
    result = _parse_evaluation(raw)
    assert isinstance(result, EvaluationResult)
    assert result.fluency.score == 6.5
    assert result.lexical_resource.score == 6.0
    assert result.naturalness.score == 5.5


def test_parse_evaluation_with_fences():
    raw = """```json
{
    "fluency": { "score": 7.0, "evidence": "x", "explanation": "y" },
    "lexical_resource": { "score": 6.5, "evidence": "x", "explanation": "y" },
    "naturalness": { "score": 6.0, "evidence": "x", "explanation": "y" }
}
```"""
    result = _parse_evaluation(raw)
    assert result.fluency.score == 7.0
    assert result.lexical_resource.score == 6.5
    assert result.naturalness.score == 6.0
