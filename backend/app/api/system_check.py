"""System device check endpoint — tests ASR and LLM before practice.

GET /api/system/check
  Returns { asr: {status, detail}, llm: {status, detail}, passed: bool }

ASR status:
  "pass"             → voice input will work
  "not_configured"   → model not downloaded / voice disabled / config incomplete
  "fail"             → model exists but test transcription failed

LLM status:
  "pass"   → model responded to a simple test prompt
  "fail"   → model unavailable, API key missing, or response error

`passed` is `true` only when LLM status is "pass".  ASR failures do NOT
block practice — voice is simply unavailable.
"""

import io
import logging
import math
import struct
import tempfile
import wave
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings
from app.core.model_manager import is_whisper_downloaded

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/system", tags=["system"])


# ===================================================================
#  Helpers
# ===================================================================

def _generate_sine_wav(
    duration: float = 0.5,
    frequency: float = 440.0,
    sample_rate: int = 16000,
) -> bytes:
    """Generate a short sine-wave WAV file in memory (16-bit PCM, mono)."""
    num_samples = int(sample_rate * duration)
    samples: list[int] = []
    for i in range(num_samples):
        val = math.sin(2.0 * math.pi * frequency * i / sample_rate)
        samples.append(int(val * 32767))

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack("<" + "h" * len(samples), *samples))
    return buf.getvalue()


# ===================================================================
#  Routes
# ===================================================================

@router.get("/check")
async def system_check() -> dict[str, Any]:
    """Check whether the currently configured models work correctly.

    Results are informational only — the frontend uses `passed` to
    decide whether to block access to the practice page.
    """
    asr_result = await _check_asr()
    llm_result = await _check_llm()

    # Practice is allowed only when the understanding model works.
    passed = llm_result["status"] == "pass"

    return {
        "asr": asr_result,
        "llm": llm_result,
        "passed": passed,
        "llm_provider": settings.llm_provider,
    }


@router.post("/check-asr")
async def check_asr(audio: UploadFile = File(...)) -> dict[str, Any]:
    """Real ASR test — transcribe user's spoken audio through microphone.

    Accepts a multipart audio file (WAV/WebM/MP3), runs it through the
    configured ASR provider, and returns the transcribed text so the
    user can verify speech recognition actually works with their voice.
    """
    audio_data = await audio.read()
    if not audio_data:
        raise HTTPException(status_code=400, detail="Empty audio file")

    from app.core.asr import transcribe_audio

    try:
        text = await transcribe_audio(audio_data, filename=audio.filename or "audio.webm")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"ok": True, "text": text.strip()}


# ── ASR ────────────────────────────────────────────────────────────

async def _check_asr() -> dict[str, str]:
    """Check ASR readiness based on the configured provider."""
    # 1. Feature toggle
    if settings.voice_disabled:
        return {
            "status": "not_configured",
            "detail": "Voice input is disabled in settings",
        }

    provider = settings.asr_provider

    # 2. Whisper — verify model is downloaded, then run a real transcription
    if provider == "whisper":
        model_name = settings.asr_model
        if not is_whisper_downloaded(model_name):
            return {
                "status": "not_configured",
                "detail": f"Whisper model '{model_name}' not downloaded. Go to Settings to download it.",
            }

        try:
            import whisper

            wav_bytes = _generate_sine_wav()

            # Load model — fall back to CPU if CUDA kernel incompatible
            try:
                model = whisper.load_model(model_name)
            except Exception as _e:
                if "CUDA error" in str(_e) or "no kernel image" in str(_e):
                    import os as _os
                    logger.warning("CUDA incompatible → Whisper running on CPU")
                    _os.environ["CUDA_VISIBLE_DEVICES"] = ""
                    model = whisper.load_model(model_name)
                else:
                    raise

            device = str(getattr(model, "device", "unknown"))

            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            try:
                tmp.write(wav_bytes)
                tmp_path = tmp.name
            finally:
                tmp.close()

            try:
                result = model.transcribe(tmp_path, language="en")
                text = result.get("text", "").strip()
                logger.info("ASR health-check transcription: %s (device=%s)", text or "(empty)", device)
                desc = "Speech recognition is working"
                if device == "cpu":
                    desc += " (CPU mode)"
                return {
                    "status": "pass",
                    "detail": desc,
                }
            finally:
                Path(tmp_path).unlink(missing_ok=True)

        except Exception as exc:
            logger.error("ASR health-check failed: %s", exc)
            return {
                "status": "fail",
                "detail": f"ASR test failed: {exc}",
            }

    # 3. Qwen3-ASR — verify the GGUF files exist
    if provider == "qwen_asr":
        if not settings.qwen_asr_model_path or not Path(
            settings.qwen_asr_model_path
        ).exists():
            return {
                "status": "not_configured",
                "detail": "Qwen3-ASR model file not found. Check your settings.",
            }
        if not settings.qwen_asr_mmproj_path or not Path(
            settings.qwen_asr_mmproj_path
        ).exists():
            return {
                "status": "not_configured",
                "detail": "Qwen3-ASR mmproj file not found. Check your settings.",
            }
        return {
            "status": "pass",
            "detail": "Qwen3-ASR files found (full test runs during practice)",
        }

    # 4. Online API — check URL and key are present
    if provider == "online_api":
        if not settings.online_asr_url:
            return {
                "status": "not_configured",
                "detail": "Online ASR endpoint URL is not set.",
            }
        if not settings.online_asr_key:
            return {
                "status": "not_configured",
                "detail": "Online ASR API key is not set.",
            }
        return {
            "status": "pass",
            "detail": "Online ASR API is configured",
        }

    # 5. Unknown provider
    return {
        "status": "not_configured",
        "detail": f"Unknown ASR provider: {provider}",
    }


# ── LLM ────────────────────────────────────────────────────────────

async def _check_llm() -> dict[str, str]:
    """Test the understanding model.

    API providers: check key + do a quick inference test.
    Local provider: check model file exists + DLL compatibility (no inference).
    """
    provider = settings.llm_provider

    # ── Local model: check file + DLL, skip inference ──
    if provider == "local":
        model_path = settings.llm_local_model_path
        if not model_path:
            return {"status": "fail", "detail": "Local GGUF model path is not configured."}
        if not Path(model_path).exists():
            return {
                "status": "fail",
                "detail": f"Model file not found: {model_path}",
            }
        # DLL compatibility check (fast — just import, no model load)
        try:
            from llama_cpp import Llama
            return {
                "status": "pass",
                "detail": f"Local model ready ({Path(model_path).name})",
            }
        except Exception as exc:
            logger.error("Local model DLL check failed: %s", exc)
            return {"status": "fail", "detail": f"DLL error: {exc}"}

    # ── API providers: key + inference test ──
    if provider not in ("openai", "anthropic"):
        return {"status": "fail", "detail": f"Unknown LLM provider: {provider}"}

    if provider == "openai" and not settings.openai_api_key:
        return {"status": "fail", "detail": "OpenAI API key is not configured."}
    if provider == "anthropic" and not settings.anthropic_api_key:
        return {"status": "fail", "detail": "Anthropic API key is not configured."}

    try:
        from app.core.evaluator import call_llm

        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say 'hello' in one word."},
        ]
        text = await call_llm(messages)
        stripped = text.strip() if text else ""

        if stripped:
            snippet = stripped[:60]
            return {"status": "pass", "detail": f"LLM responded: '{snippet}'"}
        else:
            return {"status": "fail", "detail": "LLM returned an empty response."}

    except Exception as exc:
        logger.error("LLM health-check failed: %s", exc)
        return {"status": "fail", "detail": f"LLM test failed: {exc}"}
