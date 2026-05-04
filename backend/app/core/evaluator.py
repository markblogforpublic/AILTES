"""Expression evaluation module — scores Fluency, Lexical Resource, and Naturalness."""

import json
import logging

from app.config import settings
from app.models.domain import DimensionScore, EvaluationResult
from app.utils.prompt_templates import EVALUATION_SYSTEM_PROMPT, PART_EVALUATION_CONTEXTS

logger = logging.getLogger(__name__)


async def call_llm(messages: list[dict]) -> str:
    """Unified LLM call — supports OpenAI, Anthropic, and local GGUF."""
    if settings.llm_provider == "openai":
        return await _call_openai(messages)
    elif settings.llm_provider == "anthropic":
        return await _call_anthropic(messages)
    elif settings.llm_provider == "local":
        return await _call_local(messages)
    else:
        raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")


async def _call_openai(messages: list[dict]) -> str:
    from openai import AsyncOpenAI
    kwargs = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    client = AsyncOpenAI(**kwargs)
    resp = await client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=0.7,
        max_tokens=2048,  # increased to accommodate richer descriptors
    )
    return resp.choices[0].message.content or ""


async def _call_anthropic(messages: list[dict]) -> str:
    import anthropic
    client_kwargs = {"api_key": settings.anthropic_api_key}
    if settings.anthropic_base_url:
        client_kwargs["base_url"] = settings.anthropic_base_url
    client = anthropic.AsyncAnthropic(**client_kwargs)
    # Convert OpenAI-style messages to Anthropic format
    system = None
    msgs = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            c = m["content"]
            msgs.append({"role": m["role"], "content": c})

    resp = await client.messages.create(
        model=settings.llm_model,
        system=system or "",
        messages=msgs,
        temperature=0.7,
        max_tokens=2048,  # increased to accommodate richer descriptors
    )
    # Extract text from response (skip thinking blocks)
    if resp.content:
        for block in resp.content:
            if getattr(block, "type", None) == "text" and block.text:
                return block.text
        # fallback: first block with text
        for block in resp.content:
            if hasattr(block, "text") and block.text:
                return block.text
    return ""


# ─── Local GGUF backend ─────────────────────────────────────────────

_vendor_dlls_applied: str | None = None  # tracks which backend's DLLs are currently loaded

def _hotswap_vendor_dlls(vendor_dir: str, backend: str):
    """No-op at runtime — DLLs are applied at server startup (see main.py lifespan).
    To switch GPU backend, change gpu_backend setting and restart the server."""
    pass


async def _call_local(messages: list[dict]) -> str:
    """Call a local GGUF model via llama-cpp-python (universal chat template).

    Uses create_chat_completion which automatically applies the model's
    built-in Jinja2 chat template — works with any instruction-tuned GGUF
    (Gemma, Qwen, Llama, Mistral, DeepSeek, etc.) without manual format handling.
    """
    model_path = settings.llm_local_model_path
    if not model_path:
        raise ValueError("No local model path configured (llm_local_model_path)")

    from llama_cpp import Llama

    # ── Centralized GPU detection ──
    from app.core.model_manager import detect_gpu
    gpu = detect_gpu()
    logger.info("GPU: %s | vendor=%s | backend=%s | VRAM=%s GB",
                gpu.name, gpu.vendor, gpu.backend, gpu.vram_gb)

    # Determine GPU layers based on available backend
    n_gpu_layers = 0  # default: CPU
    _gpu_backend = gpu.backend

    if _gpu_backend in ("cuda", "vulkan"):
        _cuda_dev = getattr(settings, "cuda_device", 0)
        import os as _os
        from pathlib import Path
        _os.environ["CUDA_VISIBLE_DEVICES"] = str(_cuda_dev)
        # Locate vendor directory
        _vendor_dir = Path(__file__).parent.parent.parent / "vendor"
        if not _vendor_dir.exists():
            _vendor_dir = Path(model_path).parent.parent.parent.parent / "backend" / "vendor"
        _os.add_dll_directory(str(_vendor_dir))
        logger.info("Vendor dir: %s | backend: %s", _vendor_dir, _gpu_backend)
        # Hot-swap DLLs from vendor to llama-cpp-python lib
        _hotswap_vendor_dlls(str(_vendor_dir), _gpu_backend)
        try:
            from llama_cpp import Llama as _test
            n_gpu_layers = -1
            logger.info("GPU backend %s loaded — using GPU acceleration", _gpu_backend)
        except Exception as _e:
            n_gpu_layers = 0
            logger.warning("%s backend failed, falling back to CPU: %s", _gpu_backend, _e)

    elif _gpu_backend == "metal":
        n_gpu_layers = -1
        logger.info("Apple Metal detected — using GPU acceleration")

    logger.info("Loading local GGUF: %s (gpu_layers=%s)", model_path, n_gpu_layers)

    llm = Llama(
        model_path=model_path,
        n_ctx=4096,
        n_gpu_layers=n_gpu_layers,
        main_gpu=0,          # force NVIDIA GPU (not Intel integrated)
        verbose=False,
    )

    # Use create_chat_completion — auto-detects correct chat template from model metadata
    output = llm.create_chat_completion(
        messages=messages,
        max_tokens=1024,
        temperature=0.7,
    )
    choice = output.get("choices", [{}])[0]
    text = choice.get("message", {}).get("content", "").strip()
    logger.info("Local GGUF generated %d chars", len(text))
    return text


async def evaluate_response(user_message: str, part: str = "part1") -> EvaluationResult:
    """Evaluate a user's spoken response across three dimensions.

    Args:
        user_message: The candidate's spoken response text.
        part: The exam part ("part1", "part2", or "part3"). Used to apply
              part-specific evaluation context to the prompt.

    Returns:
        An EvaluationResult with fluency, lexical_resource, and naturalness scores.
    """
    # Validate part parameter
    if part not in PART_EVALUATION_CONTEXTS:
        logger.warning("Unknown exam part '%s', defaulting to 'part1'", part)
        part = "part1"

    part_context = PART_EVALUATION_CONTEXTS.get(part, "")

    # Validate input
    if not user_message or not user_message.strip():
        logger.warning("Empty user message received for evaluation")
        return _fallback_evaluation("Empty or blank response — no language to evaluate.")

    # Light evaluation: 3 small prompts for local models, 1 big prompt for API
    use_light = settings.llm_provider == "local"
    if use_light:
        return await _evaluate_light(user_message, part)
    else:
        return await _evaluate_full(user_message, part, part_context)


async def _evaluate_light(user_message: str, part: str) -> EvaluationResult:
    """Split evaluation into 3 small per-dimension calls — for local GGUF models."""
    from app.utils.prompt_templates import LIGHT_EVAL_DIMENSIONS

    dim_scores = {}
    for dim_key, sys_prompt in LIGHT_EVAL_DIMENSIONS:
        messages = [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": f"Candidate response (IELTS {part}):\n{user_message}"},
        ]
        try:
            raw = await call_llm(messages)
            dim_scores[dim_key] = _parse_dimension(json.loads(_clean_json(raw)))
        except Exception as e:
            logger.warning("Light eval failed for %s: %s, using fallback", dim_key, e)
            dim_scores[dim_key] = DimensionScore(
                score=5.0, evidence="N/A",
                explanation="Light evaluation failed for this dimension.",
                confidence=0.0,
            )

    return EvaluationResult(
        fluency=dim_scores.get("fluency") or DimensionScore(score=5.0, evidence="N/A", explanation="N/A"),
        lexical_resource=dim_scores.get("lexical_resource") or DimensionScore(score=5.0, evidence="N/A", explanation="N/A"),
        naturalness=dim_scores.get("naturalness") or DimensionScore(score=5.0, evidence="N/A", explanation="N/A"),
    )


async def _evaluate_full(user_message: str, part: str, part_context: str) -> EvaluationResult:
    """Single-call evaluation with full IELTS descriptors — for API models."""
    messages = [
        {"role": "system", "content": EVALUATION_SYSTEM_PROMPT},
        {"role": "user", "content": f"Exam Part: {part}\n\n{part_context}\n\nCandidate response:\n{user_message}"},
    ]
    raw = await call_llm(messages)
    return _parse_evaluation(raw)


def _clean_json(raw: str) -> str:
    """Strip markdown fences from JSON string."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _parse_evaluation(raw: str) -> EvaluationResult:
    """Parse LLM output into a structured EvaluationResult."""
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    data = json.loads(text)
    return EvaluationResult(
        fluency=_parse_dimension(data.get("fluency", {})),
        lexical_resource=_parse_dimension(data.get("lexical_resource", {})),
        naturalness=_parse_dimension(data.get("naturalness", {})),
    )


def _parse_dimension(data: dict) -> DimensionScore:
    """Parse a single dimension dict into a DimensionScore, with safe defaults."""
    return DimensionScore(
        score=float(data.get("score", 5.0)),
        evidence=str(data.get("evidence", "No specific evidence provided.")),
        explanation=str(data.get("explanation", "No explanation provided.")),
        confidence=_safe_float(data.get("confidence"), default=None),
    )


def _safe_float(value, default: float | None = None) -> float | None:
    """Safely convert a value to float, returning default on failure."""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _fallback_evaluation(reason: str) -> EvaluationResult:
    """Return a safe fallback evaluation when the LLM call fails."""
    return EvaluationResult(
        fluency=DimensionScore(
            score=5.0,
            evidence="System error prevented full evaluation.",
            explanation=reason,
            confidence=0.0,
        ),
        lexical_resource=DimensionScore(
            score=5.0,
            evidence="System error prevented full evaluation.",
            explanation=reason,
            confidence=0.0,
        ),
        naturalness=DimensionScore(
            score=5.0,
            evidence="System error prevented full evaluation.",
            explanation=reason,
            confidence=0.0,
        ),
    )
