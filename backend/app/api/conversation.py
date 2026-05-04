"""Conversation API endpoints."""

import asyncio
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.asr import transcribe_audio
from app.core.dialogue_generator import start_session, respond_in_session, respond_chat_only, evaluate_session
from app.core.task_manager import create_task, update_task
from app.db.repositories import get_session, update_session
from app.models.domain import ConversationTurn
from app.models.schemas import (
    RespondRequest,
    RespondResponse,
    StartConversationRequest,
    StartConversationResponse,
)
from app.utils.prompt_templates import build_conversation_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversation", tags=["conversation"])


@router.post("/start")
async def start(req: StartConversationRequest) -> StartConversationResponse:
    """Start a new IELTS speaking practice session."""
    session = await start_session(req.user_id, req.part, req.topic)
    return StartConversationResponse(
        session_id=session.session_id,
        part=session.part,
        topic=session.topic,
        examiner_message=session.turns[-1].content,
    )


@router.post("/respond")
async def respond(req: RespondRequest) -> RespondResponse:
    """Submit a user response and get examiner reply + evaluation + feedback."""
    session = await get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session = await respond_in_session(session, req.user_message)

    # Find the last user turn (which now has evaluation + feedback)
    user_turn = None
    for t in reversed(session.turns):
        if t.role == "user":
            user_turn = t
            break

    if not user_turn or not user_turn.evaluation or not user_turn.feedback:
        raise HTTPException(status_code=500, detail="Evaluation or feedback missing")

    return RespondResponse(
        examiner_message=session.turns[-1].content,
        evaluation=user_turn.evaluation,
        feedback=user_turn.feedback,
    )


# ─── Batch mode: chat without evaluation ─────────────────────────

class RespondChatResponse(BaseModel):
    examiner_message: str

@router.post("/respond-chat")
async def respond_chat(req: RespondRequest) -> RespondChatResponse:
    """Submit a response and get examiner reply WITHOUT evaluation/feedback.

    For batch mode: collect all Q&A first, then call /evaluate at the end.
    """
    session = await get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session = await respond_chat_only(session, req.user_message)
    return RespondChatResponse(examiner_message=session.turns[-1].content)


# ─── Batch evaluation: score all turns at once ─────────────────────

class EvaluateResponse(BaseModel):
    turns: list = []  # list of {role, content, evaluation, feedback}

@router.post("/evaluate/{session_id}")
async def evaluate_all(session_id: str) -> dict:
    """Evaluate all unevaluated user turns in a session.

    Call once at the end of batch-mode practice to score all responses.
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session = await evaluate_session(session)
    # Return all evaluated user turns
    results = []
    for t in session.turns:
        if t.role == "user" and t.evaluation:
            results.append({
                "content": t.content,
                "evaluation": t.evaluation.model_dump(),
                "feedback": t.feedback.model_dump(),
            })
    return {"ok": True, "results": results}


# ─── Async respond (long-running operations) ────────────────────────


class RespondAsyncResponse(BaseModel):
    """Returned immediately when a long-running respond is started."""
    task_id: str


@router.post("/respond-async", response_model=RespondAsyncResponse)
async def respond_async(req: RespondRequest) -> RespondAsyncResponse:
    """Submit a user response and get back a task_id for polling.

    The actual examiner reply, evaluation, and feedback are computed in the
    background.  Poll ``GET /api/system/task-status/{task_id}`` until the
    task status is ``"completed"`` or ``"error"``.
    """
    session = await get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    task_id = create_task("conversation.respond")

    # Fire-and-forget: the background coroutine updates the task store.
    asyncio.create_task(_process_respond_background(session, req.user_message, task_id))

    return RespondAsyncResponse(task_id=task_id)


async def _process_respond_background(
    session,
    user_message: str,
    task_id: str,
) -> None:
    """Run the full respond pipeline in the background, updating progress."""
    try:
        update_task(task_id, progress=0.05, status="processing",
                     message="Starting response processing...",
                     stage="Preparing")

        # ---- Step 1: Append user turn ----
        user_turn = ConversationTurn(role="user", content=user_message)
        session.turns.append(user_turn)

        # ---- Step 2: Build conversation history ----
        role_map = {"user": "user", "examiner": "assistant"}
        history = [
            {"role": role_map.get(t.role, "user"), "content": t.content}
            for t in session.turns
        ]
        messages = build_conversation_prompt(session.part.value, history)

        # ---- Step 3: Generate examiner response (most expensive) ----
        update_task(task_id, progress=0.10, status="processing",
                     message="Loading model and generating examiner response...",
                     stage="Step 1/4: Generating Response")

        from app.core.evaluator import call_llm as _call_llm
        examiner_reply = await _call_llm(messages)
        if not examiner_reply:
            examiner_reply = "Could you please elaborate on that? Tell me more about your thoughts."
        examiner_turn = ConversationTurn(role="examiner", content=examiner_reply)
        session.turns.append(examiner_turn)

        # ---- Step 4: Evaluate user's response ----
        update_task(task_id, progress=0.50, status="processing",
                     message="Evaluating your response across all dimensions...",
                     stage="Step 2/4: Evaluating Response")

        from app.core.evaluator import evaluate_response as _evaluate_response
        evaluation = await _evaluate_response(user_message, part=session.part.value)
        user_turn.evaluation = evaluation

        # ---- Step 5: Generate feedback ----
        update_task(task_id, progress=0.80, status="processing",
                     message="Generating detailed feedback...",
                     stage="Step 3/4: Generating Feedback")

        from app.core.feedback_generator import generate_feedback as _generate_feedback
        feedback = await _generate_feedback(user_message, evaluation)
        user_turn.feedback = feedback

        # ---- Step 6: Persist ----
        await update_session(session)

        # ---- Done ----
        update_task(task_id, progress=1.0, status="completed",
                     message="Response ready!",
                     stage="Step 4/4: Complete",
                     result={
                         "examiner_message": examiner_reply,
                         "evaluation": evaluation.model_dump(),
                         "feedback": feedback.model_dump(),
                     })

    except Exception as exc:
        logger.exception("Background respond task %s failed", task_id)
        update_task(task_id, progress=0.0, status="error",
                     message=f"Error: {exc}",
                     stage="Failed")


# ─── Audio transcription only (no evaluation) ──────────────────────

@router.post("/transcribe")
async def transcribe_audio_endpoint(audio: UploadFile = File(...)) -> dict:
    """Transcribe audio to text only.  No evaluation, no examiner reply.

    Used for voice input: transcribe → fill input box → user sends manually.
    """
    audio_data = await audio.read()
    if not audio_data:
        raise HTTPException(status_code=400, detail="Empty audio file")
    try:
        text = await transcribe_audio(audio_data, filename=audio.filename or "audio.webm")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "text": text.strip()}


@router.post("/respond-audio")
async def respond_audio(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
) -> RespondResponse:
    """Submit an audio recording and get examiner reply + evaluation + feedback.

    Accepts multipart/form-data with:
    - session_id: str — the active session ID
    - audio: file — WAV/MP3/WebM audio blob
    """
    # 1. Validate session
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. Read audio data
    audio_data = await audio.read()
    if not audio_data:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # 3. Transcribe
    try:
        transcribed_text = await transcribe_audio(
            audio_data,
            filename=audio.filename or "audio.webm",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if not transcribed_text.strip():
        raise HTTPException(status_code=400, detail="Transcription produced empty text")

    # 4. Forward the transcribed text through the standard evaluation pipeline
    session = await respond_in_session(session, transcribed_text)

    # 5. Extract the evaluated user turn
    user_turn = None
    for t in reversed(session.turns):
        if t.role == "user":
            user_turn = t
            break

    if not user_turn or not user_turn.evaluation or not user_turn.feedback:
        raise HTTPException(status_code=500, detail="Evaluation or feedback missing")

    return RespondResponse(
        examiner_message=session.turns[-1].content,
        evaluation=user_turn.evaluation,
        feedback=user_turn.feedback,
    )
