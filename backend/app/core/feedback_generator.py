"""Feedback generation module — produces explainable feedback with rewrites and error highlighting."""

import json

from app.models.domain import EvaluationResult, FeedbackResult
from app.utils.prompt_templates import FEEDBACK_SYSTEM_PROMPT
from app.core.evaluator import call_llm


async def generate_feedback(user_message: str, evaluation: EvaluationResult) -> FeedbackResult:
    """Generate detailed, explainable feedback based on evaluation results."""
    prompt = f"""Candidate's response: {user_message}

Evaluation results:
- Fluency: {evaluation.fluency.score}/9 — {evaluation.fluency.explanation}
- Lexical Resource: {evaluation.lexical_resource.score}/9 — {evaluation.lexical_resource.explanation}
- Naturalness: {evaluation.naturalness.score}/9 — {evaluation.naturalness.explanation}

Please provide detailed feedback including error highlighting and rewrite suggestions."""

    messages = [
        {"role": "system", "content": FEEDBACK_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    raw = await call_llm(messages)
    return _parse_feedback(raw)


def _parse_feedback(raw: str) -> FeedbackResult:
    """Parse LLM output into a structured FeedbackResult."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    data = json.loads(text)
    return FeedbackResult(**data)
