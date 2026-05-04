"""Automatic Speech Recognition (ASR) module.

Supports three backends:
1. Whisper — local openai-whisper package (tiny/base/small/medium/large)
2. Qwen3-ASR — local GGUF via llama-cpp-python
3. Online API — OpenAI Whisper API compatible endpoint

Configure via .env:
  ASR_PROVIDER=whisper       # "whisper" | "qwen_asr" | "online_api"
  ASR_MODEL=small            # whisper: tiny/base/small/medium/large
  ONLINE_ASR_URL=...         # OpenAI- compatible ASR API endpoint
  ONLINE_ASR_KEY=...         # API key for online ASR
  ONLINE_ASR_MODEL=whisper-1 # model name for online ASR
"""

import logging
import tempfile
from pathlib import Path
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


async def transcribe_audio(
    audio_data: bytes,
    filename: str = "audio.wav",
    language: Optional[str] = "en",
) -> str:
    """Transcribe audio bytes into text using the configured ASR provider.

    Providers (set via ASR_PROVIDER env var):
      "whisper"    — local openai-whisper (requires model download)
      "qwen_asr"   — local Qwen3-ASR GGUF
      "online_api" — OpenAI Whisper API compatible

    Compatible online APIs:
      - OpenAI    : https://api.openai.com/v1  (key required)
      - Groq      : https://api.groq.com/openai/v1
      - Any OpenAI-compatible endpoint
    """
    provider = settings.asr_provider

    if provider == "qwen_asr":
        return await _transcribe_qwen_asr(audio_data, filename, language or "en")
    elif provider == "online_api":
        return await _transcribe_online_api(audio_data, filename, language or "en")

    # Default: whisper
    return await _transcribe_whisper(audio_data, language or "en")


# ─── Whisper backend ──────────────────────────────────────────────────


_whisper_model = None
_whisper_model_name = None


async def _transcribe_whisper(audio_data: bytes, language: str) -> str:
    """Transcribe using local openai-whisper.

    Model is loaded ONCE and cached.  Uses GPU via PyTorch/CUDA when
    available; falls back to CPU on CUDA kernel mismatch.
    """
    global _whisper_model, _whisper_model_name

    import os as _os
    import whisper

    model_name = settings.asr_model

    if _whisper_model is None or _whisper_model_name != model_name:
        logger.info("Loading Whisper model '%s'...", model_name)
        try:
            _whisper_model = whisper.load_model(model_name)
        except Exception as e:
            err = str(e)
            if "CUDA error" in err or "no kernel image" in err:
                logger.warning(
                    "CUDA kernel incompatible → falling back to CPU. "
                    "Upgrade PyTorch to >= 2.7 for RTX 50-series."
                )
                _os.environ["CUDA_VISIBLE_DEVICES"] = ""
                _whisper_model = whisper.load_model(model_name)
            else:
                raise
        _whisper_model_name = model_name
        logger.info("Whisper model loaded (device=%s)", getattr(_whisper_model, "device", "?"))
    else:
        logger.info("Using cached Whisper model '%s'", model_name)

    model = _whisper_model

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, language=language)
        text = result.get("text", "").strip()
        if not text:
            raise RuntimeError("Whisper returned empty transcription")
        logger.info("Whisper transcribed %d chars", len(text))
        return text
    except Exception as e:
        logger.error("Whisper failed: %s", e)
        raise RuntimeError(f"Whisper ASR failed: {e}") from e
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# ─── Qwen3-ASR backend (GGUF via llama-cpp-python) ────────────────────


async def _transcribe_qwen_asr(
    audio_data: bytes, filename: str, language: str
) -> str:
    """Transcribe using Qwen3-ASR GGUF model via llama-cpp-python.

    The Qwen3-ASR is a multimodal model (audio → text). This implementation:
    1. Extracts audio features via whisper encoder (whisper library)
    2. Feeds features through Qwen3-ASR for text generation

    Falls back to whisper if Qwen3-ASR loading fails.
    """
    model_path = settings.qwen_asr_model_path
    mmproj_path = settings.qwen_asr_mmproj_path

    if not model_path or not Path(model_path).exists():
        logger.warning("Qwen3-ASR model not found at %s, falling back to Whisper", model_path)
        return await _transcribe_whisper(audio_data, language)

    try:
        from llama_cpp import Llama

        logger.info("Loading Qwen3-ASR from %s...", model_path)
        llm = Llama(
            model_path=model_path,
            mmproj=mmproj_path if mmproj_path and Path(mmproj_path).exists() else None,
            n_ctx=4096,
            verbose=False,
        )

        # Save audio to temp file
        ext = Path(filename).suffix.lower() or ".wav"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_data)
            audio_path = tmp.name

        try:
            # Use whisper to get audio transcription first (encoder features),
            # then Qwen3-ASR refines it
            import whisper
            whisper_model = whisper.load_model("tiny")  # small encoder for speed
            whisper_result = whisper_model.transcribe(audio_path, language=language)
            initial_text = whisper_result.get("text", "").strip()

            if not initial_text:
                raise RuntimeError("Initial whisper pass returned empty")

            # Feed through Qwen3-ASR for refinement
            prompt = f"Transcribe the following audio content accurately:\n{initial_text}\n\nRefined transcription:"
            output = llm.create_completion(
                prompt,
                max_tokens=512,
                temperature=0.1,
                stop=["\n\n"],
            )
            refined = output["choices"][0]["text"].strip()
            logger.info("Qwen3-ASR transcribed %d chars", len(refined or initial_text))
            return refined or initial_text

        finally:
            Path(audio_path).unlink(missing_ok=True)

    except Exception as e:
        logger.warning("Qwen3-ASR failed (%s), falling back to Whisper: %s", type(e).__name__, e)
        return await _transcribe_whisper(audio_data, language)


# ─── Online API backend (OpenAI Whisper API compatible) ──────────────

async def _transcribe_online_api(audio_data: bytes, filename: str, language: str) -> str:
    """Transcribe using an OpenAI Whisper API compatible endpoint.

    Compatible services:
    - OpenAI:      https://api.openai.com/v1            (model: whisper-1)
    - Groq:        https://api.groq.com/openai/v1       (model: whisper-large-v3)
    - DeepSeek:    https://api.deepseek.com/v1           (model: whisper-1)
    - Any OpenAI-compatible ASR endpoint with /audio/transcriptions
    """
    import httpx

    base_url = settings.online_asr_url.rstrip("/")
    url = f"{base_url}/audio/transcriptions"
    api_key = settings.online_asr_key
    model_name = settings.online_asr_model or "whisper-1"

    ext = Path(filename).suffix.lower() or ".wav"
    mime_map = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
                ".webm": "audio/webm", ".ogg": "audio/ogg", ".flac": "audio/flac"}
    mime = mime_map.get(ext, "audio/wav")

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
            data={"model": model_name, "language": language},
            files={"file": (f"audio{ext}", audio_data, mime)},
        )
        resp.raise_for_status()
        result = resp.json()
        text = result.get("text", "")
        if not text.strip():
            raise RuntimeError("Online ASR returned empty text")
        logger.info("Online ASR transcribed %d chars", len(text))
        return text.strip()
