"""Dialogue generation module — simulates IELTS examiner in multi-turn conversation."""

from uuid import uuid4

from app.config import settings
from app.models.domain import ConversationSession, ConversationTurn, ExamPart
from app.utils.prompt_templates import (
    build_conversation_prompt,
    IELTS_TOPICS,
)


def _pick_topic(part: ExamPart) -> str:
    import random
    topics = IELTS_TOPICS.get(part.value, IELTS_TOPICS["part1"])
    return random.choice(topics)


def _build_opening(part: ExamPart, topic: str) -> str:
    openings = {
        ExamPart.PART1: f"Let's talk about {topic}. I'd like to ask you a few questions about this area.",
        ExamPart.PART2: f"I'd like you to talk about {topic}. You'll have one minute to prepare, then speak for up to two minutes.",
        ExamPart.PART3: f"Let's discuss some more abstract aspects related to what we've been talking about.",
    }
    return openings.get(part, openings[ExamPart.PART1])


async def start_session(user_id: str, part: ExamPart = ExamPart.PART1, topic: str | None = None) -> ConversationSession:
    """Create a new conversation session with an opening examiner message."""
    topic = topic or _pick_topic(part)
    from app.db.repositories import create_session
    session = await create_session(user_id, part, topic)

    from app.core.evaluator import call_llm
    messages = build_conversation_prompt(part.value, [
        {"role": "assistant", "content": _build_opening(part, topic)}
    ])

    examiner_msg = await call_llm(messages)
    if not examiner_msg:
        examiner_msg = _build_opening(part, topic)
    turn = ConversationTurn(role="examiner", content=examiner_msg)
    session.turns.append(turn)

    from app.db.repositories import update_session
    await update_session(session)
    return session


async def respond_in_session(session: ConversationSession, user_message: str) -> ConversationSession:
    """Process user response and generate examiner reply with evaluation + feedback."""
    # Step 1: Append user turn
    user_turn = ConversationTurn(role="user", content=user_message)
    session.turns.append(user_turn)

    # Step 2: Build full conversation history (map roles for LLM API)
    role_map = {"user": "user", "examiner": "assistant"}
    history = [
        {"role": role_map.get(t.role, "user"), "content": t.content}
        for t in session.turns
    ]
    messages = build_conversation_prompt(session.part.value, history)

    # Step 3: Generate examiner response
    from app.core.evaluator import call_llm
    examiner_reply = await call_llm(messages)
    if not examiner_reply:
        examiner_reply = "Could you please elaborate on that? Tell me more about your thoughts."
    examiner_turn = ConversationTurn(role="examiner", content=examiner_reply)
    session.turns.append(examiner_turn)

    # Step 4: Evaluate user's response (with part-specific context)
    from app.core.evaluator import evaluate_response
    evaluation = await evaluate_response(user_message, part=session.part.value)
    user_turn.evaluation = evaluation

    # Step 5: Generate feedback
    from app.core.feedback_generator import generate_feedback
    feedback = await generate_feedback(user_message, evaluation)
    user_turn.feedback = feedback

    # Step 6: Persist
    from app.db.repositories import update_session
    await update_session(session)

    return session


async def respond_chat_only(session: ConversationSession, user_message: str) -> ConversationSession:
    """Process user response and generate examiner reply WITHOUT evaluation.

    For batch mode: collects all responses first, then evaluates together.
    """
    user_turn = ConversationTurn(role="user", content=user_message)
    session.turns.append(user_turn)

    role_map = {"user": "user", "examiner": "assistant"}
    history = [
        {"role": role_map.get(t.role, "user"), "content": t.content}
        for t in session.turns
    ]
    messages = build_conversation_prompt(session.part.value, history)

    from app.core.evaluator import call_llm
    examiner_reply = await call_llm(messages)
    if not examiner_reply:
        examiner_reply = "Could you please elaborate on that?"

    examiner_turn = ConversationTurn(role="examiner", content=examiner_reply)
    session.turns.append(examiner_turn)

    from app.db.repositories import update_session
    await update_session(session)
    return session


async def evaluate_session(session: ConversationSession) -> ConversationSession:
    """Evaluate ALL unevaluated user turns in a session.

    For batch mode: called once at the end of practice to score all responses.
    """
    from app.core.evaluator import evaluate_response
    from app.core.feedback_generator import generate_feedback

    evaluated = 0
    for turn in session.turns:
        if turn.role == "user" and turn.evaluation is None:
            turn.evaluation = await evaluate_response(turn.content, part=session.part.value)
            turn.feedback = await generate_feedback(turn.content, turn.evaluation)
            evaluated += 1

    if evaluated > 0:
        from app.db.repositories import update_session
        await update_session(session)

    return session
