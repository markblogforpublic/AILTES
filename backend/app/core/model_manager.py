"""Model Manager — GPU/VRAM detection, model registry, download, recommendation.

Supports:
- Understanding models: GGUF format (llama.cpp compatible)
- ASR models: Whisper (openai-whisper), Qwen3-ASR (GGUF), Online API (OpenAI-compatible)
- VRAM overflow → RAM offloading with user consent
- One-click Whisper model download
"""

import logging
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Constants ─────────────────────────────────────────────────────

SUPPORTED_FORMATS = {
    "understanding": {
        "gguf": {"description": "GGUF format (llama.cpp compatible)", "extensions": [".gguf"]},
    },
    "asr": {
        "whisper": {"description": "OpenAI Whisper (openai-whisper package)", "extensions": []},
        "qwen_asr_gguf": {"description": "Qwen3-ASR GGUF (requires .gguf + mmproj.gguf)", "extensions": [".gguf"]},
        "online_api": {"description": "Online API (OpenAI Whisper API compatible)", "extensions": []},
    },
}

# ── Model registry — loaded from JSON config files ──

CONFIG_DIR = Path(__file__).parent.parent.parent / "config"
ASR_CONFIG_PATH = CONFIG_DIR / "asr_models.json"
LLM_CONFIG_PATH = CONFIG_DIR / "llm_models.json"


def _load_json_config(path: Path) -> dict:
    """Load a JSON config file. Returns empty dict if not found."""
    if not path.exists():
        return {"models": []}
    import json
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json_config(path: Path, data: dict) -> None:
    """Save a dict to JSON config file."""
    import json
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _get_asr_models() -> list[dict]:
    return _load_json_config(ASR_CONFIG_PATH).get("models", [])


def _get_llm_models() -> list[dict]:
    return _load_json_config(LLM_CONFIG_PATH).get("models", [])


def _get_all_default_models() -> list[dict]:
    """Combined list: ASR config + LLM config (both JSON-based)."""
    return _get_asr_models() + _get_llm_models()


# ===================================================================
#  GPU / VRAM Detection
# ===================================================================

@dataclass
class GPUInfo:
    available: bool = False
    name: str = ""
    vendor: str = ""      # "nvidia" | "amd" | "intel" | "apple" | "unknown"
    backend: str = "cpu"  # "cuda" | "rocm" | "vulkan" | "metal" | "cpu"
    vram_gb: float = 0.0
    ram_gb: float = 0.0
    devices: list[dict] = field(default_factory=list)  # all detected GPUs with id, name, vram

def enumerate_cuda_devices() -> list[dict]:
    """Enumerate all CUDA-capable GPUs with their details."""
    devices = []
    try:
        import torch
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                try:
                    name = torch.cuda.get_device_name(i)
                    vram = round(torch.cuda.get_device_properties(i).total_memory / 1e9, 1)
                    devices.append({"id": i, "name": name, "vram_gb": vram})
                except Exception:
                    pass
    except ImportError:
        pass
    # Also try nvidia-smi for additional GPU listing
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=index,name,memory.total", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5
        )
        if r.returncode == 0:
            for line in r.stdout.strip().splitlines():
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 3 and not any(d.get("name", "") == parts[1] for d in devices):
                    try:
                        devices.append({
                            "id": int(parts[0]),
                            "name": parts[1],
                            "vram_gb": round(int(parts[2].replace(" MiB", "")) / 1024, 1)
                        })
                    except ValueError:
                        pass
    except Exception:
        pass
    return devices


def detect_gpu() -> GPUInfo:
    """Detect GPU and enumerate all available GPUs.

    Detection priority:
    1. NVIDIA CUDA (via PyTorch + CUDA Toolkit DLL check)
    2. NVIDIA CUDA (via nvidia-smi)
    3. AMD (via wmic on Windows)
    4. Apple Metal (via platform check)
    5. CPU fallback
    """
    info = GPUInfo()
    # Enumerate all GPUs
    info.devices = enumerate_cuda_devices()
    try:
        import psutil
        info.ram_gb = round(psutil.virtual_memory().total / 1e9, 1)
    except ImportError:
        info.ram_gb = 16.0

    # ── Method 1: NVIDIA CUDA via PyTorch ──
    try:
        import torch
        if torch.cuda.is_available():
            info.available = True
            info.name = torch.cuda.get_device_name(0)
            info.vram_gb = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
            info.vendor = "nvidia"
            # Check CUDA Toolkit DLLs (support multiple CUDA versions)
            import ctypes
            for _dll in ["cublas64_12.dll", "cublas64_13.dll"]:
                try:
                    ctypes.cdll.LoadLibrary(_dll)
                    info.backend = "cuda"
                    break
                except Exception:
                    continue
            if info.backend != "cuda":
                info.backend = "cpu"
                logger.info("NVIDIA GPU detected but no CUDA Toolkit DLLs found")
            return info
    except ImportError:
        pass

    # ── Method 2: NVIDIA via nvidia-smi ──
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5
        )
        if r.returncode == 0 and r.stdout.strip():
            parts = r.stdout.strip().split(",")
            info.available = True
            info.name = parts[0].strip()
            info.vram_gb = round(int(parts[1].strip().replace(" MiB", "")) / 1024, 1)
            info.vendor = "nvidia"
            import ctypes
            try:
                ctypes.cdll.LoadLibrary("cublas64_12.dll")
                info.backend = "cuda"
            except Exception:
                info.backend = "cpu"
            return info
    except Exception:
        pass

    # ── Method 3: AMD GPU via wmic (Windows) ──
    try:
        r = subprocess.run(
            ["wmic", "path", "win32_VideoController", "get", "name", "/format:csv"],
            capture_output=True, text=True, timeout=5
        )
        for line in r.stdout.splitlines():
            if "AMD" in line.upper() or "RADEON" in line.upper() or "RX " in line:
                info.available = True
                info.name = line.split(",")[-1].strip()
                info.vendor = "amd"
                info.backend = "vulkan"  # Vulkan is best for AMD on Windows
                # Try to estimate VRAM (not always available via wmic)
                try:
                    r2 = subprocess.run(
                        ["wmic", "path", "win32_VideoController", "get", "adapterram", "/format:csv"],
                        capture_output=True, text=True, timeout=3
                    )
                    for l2 in r2.stdout.splitlines():
                        if l2.strip() and not l2.startswith("Node"):
                            val = l2.split(",")[-1].strip()
                            if val.isdigit():
                                info.vram_gb = round(int(val) / 1e9, 1)
                except Exception:
                    pass
                return info
    except Exception:
        pass

    # ── Method 4: Apple Metal ──
    import sys as _sys
    if _sys.platform == "darwin":
        try:
            r = subprocess.run(["sysctl", "-n", "hw.machine"], capture_output=True, text=True, timeout=3)
            info.available = True
            info.name = f"Apple {r.stdout.strip()}" if r.stdout.strip() else "Apple Silicon"
            info.vendor = "apple"
            info.backend = "metal"
        except Exception:
            pass

    # ── Respect user's explicit GPU_BACKEND setting ──
    # Hardware detection tells us what's AVAILABLE; the user setting tells
    # us what's actually being USED (launcher writes it to .env on startup).
    from app.config import settings as _s
    _configured = _s.gpu_backend
    if _configured in ("cuda", "vulkan", "cpu"):
        info.backend = _configured
        logger.info("GPU backend overridden by config: %s", _configured)

    return info


# ===================================================================
#  VRAM Estimation
# ===================================================================

def estimate_vram(param_b_str: str, format_hint: str = "") -> float:
    """Estimate VRAM needed in GB for a GGUF model."""
    # Parse param count
    b = param_b_str.upper().replace("B", "").replace("~", "").strip()
    try:
        params = float(b)
    except ValueError:
        return 0

    # Bytes per param based on quantization
    fmt = format_hint.lower()
    if "q4" in fmt or "mxFP4" in fmt or "fp4" in fmt:
        bytes_per = 0.5
    elif "q5" in fmt:
        bytes_per = 0.625
    elif "q6" in fmt:
        bytes_per = 0.75
    elif "q8" in fmt or "fp8" in fmt:
        bytes_per = 1.0
    elif "bf16" in fmt or "fp16" in fmt or "16" in fmt:
        bytes_per = 2.0
    else:
        bytes_per = 2.0  # default assume FP16

    # Rough estimate: params * bytes_per + ~10% overhead
    return round(params * bytes_per * 1.1, 1)


def would_overflow_vram(gpu: GPUInfo, needed_gb: float) -> bool:
    """Check if a model would overflow VRAM."""
    if not gpu.available:
        return True  # no GPU = overflow
    return needed_gb > gpu.vram_gb


# ===================================================================
#  Model Scanning & Registry
# ===================================================================

@dataclass
class ModelEntry:
    name: str
    display: str = ""
    path: str = ""
    type: str = ""
    format: str = ""
    size_gb: float = 0.0
    param_b: str = ""
    is_loaded: bool = False
    estimated_vram_gb: float = 0.0
    is_custom: bool = False


def scan_models() -> list[ModelEntry]:
    """Scan models from JSON config files + custom registered models."""
    found: dict[str, ModelEntry] = {}
    seen = set()

    def add(entry: ModelEntry):
        if entry.name not in seen:
            seen.add(entry.name)
            found[entry.name] = entry

    all_models = _get_all_default_models()

    # 1. API models (only if API key is configured)
    from app.config import settings as _s
    _api_available = {
        "deepseek-api": bool(_s.anthropic_api_key),
        "openai-api": bool(_s.openai_api_key),
    }
    for m in all_models:
        if m.get("format") == "api":
            if not _api_available.get(m["name"], True):
                continue
            add(ModelEntry(name=m["name"], display=m["display"], type=m["type"],
                           format=m["format"], param_b=m.get("param_b", ""), is_loaded=True))

    # 2. Whisper models (check if cached)
    whisper_cache = Path(os.path.expanduser("~")) / ".cache" / "whisper"
    for m in all_models:
        if m.get("format") == "whisper":
            parts = m["name"].split("-")
            cached = (whisper_cache / f"{parts[1] if len(parts) > 1 else m['name']}.pt").exists()
            add(ModelEntry(name=m["name"], display=m["display"], type=m["type"],
                           format=m["format"], param_b=m.get("param_b", ""),
                           is_loaded=cached, is_custom=False))

    # 3. Custom registered models (from JSON config — added by user via Settings)
    for cm in all_models:
        if cm.get("format") in ("api", "whisper"):
            continue  # already handled above
        fp = Path(cm.get("path", ""))
        sz = round(fp.stat().st_size / 1e9, 2) if fp.is_file() else 0
        add(ModelEntry(name=cm["name"], display=cm.get("display", cm["name"]),
                       path=cm.get("path", ""), type=cm["type"],
                       format=cm.get("format", "gguf"),
                       size_gb=sz, param_b=cm.get("param_b", ""), is_loaded=True,
                       estimated_vram_gb=estimate_vram(cm.get("param_b", ""), fp.name),
                       is_custom=True))

    return list(found.values())


# ===================================================================
#  Model Registration
# ===================================================================

def register_custom_model(name: str, path: str, model_type: str,
                          display: str = "", param_b: str = "", format: str = "gguf") -> dict:
    """Register a custom model — saves to JSON config file."""
    fp = Path(path)
    if not fp.exists():
        return {"ok": False, "error": f"Path not found: {path}"}
    if model_type not in ("asr", "understanding"):
        return {"ok": False, "error": "type must be 'asr' or 'understanding'"}

    config_path = ASR_CONFIG_PATH if model_type == "asr" else LLM_CONFIG_PATH
    data = _load_json_config(config_path)
    models: list[dict] = data.get("models", [])

    entry = {
        "name": name,
        "display": display or fp.name,
        "path": str(fp.absolute()),
        "type": model_type,
        "format": format,
        "param_b": param_b or "",
    }
    for i, m in enumerate(models):
        if m.get("name") == name:
            models[i] = entry
            _save_json_config(config_path, {"models": models})
            return {"ok": True, "message": f"Updated '{name}'"}
    models.append(entry)
    _save_json_config(config_path, {"models": models})
    return {"ok": True, "message": f"Registered '{name}'"}


def remove_custom_model(name: str) -> dict:
    """Remove a custom model from its JSON config file."""
    for config_path in (ASR_CONFIG_PATH, LLM_CONFIG_PATH):
        data = _load_json_config(config_path)
        models: list[dict] = data.get("models", [])
        for m in models:
            if m.get("name") == name:
                models.remove(m)
                _save_json_config(config_path, {"models": models})
                return {"ok": True, "message": f"Removed '{name}'"}
    return {"ok": False, "error": f"Model '{name}' not found"}


# ===================================================================
#  Whisper Download
# ===================================================================

WHISPER_CACHE = Path(os.path.expanduser("~")) / ".cache" / "whisper"

def is_whisper_downloaded(model_name: str) -> bool:
    return (WHISPER_CACHE / f"{model_name}.pt").exists()

def download_whisper(model_name: str) -> dict:
    """Download a Whisper model. Returns status dict."""
    if is_whisper_downloaded(model_name):
        return {"ok": True, "message": f"Whisper '{model_name}' already downloaded"}
    try:
        import whisper
        logger.info("Downloading Whisper model '%s'...", model_name)
        whisper.load_model(model_name)
        return {"ok": True, "message": f"Whisper '{model_name}' downloaded successfully"}
    except Exception as e:
        logger.error("Whisper download failed: %s", e)
        return {"ok": False, "error": str(e)}


# ===================================================================
#  Recommendation
# ===================================================================

def get_recommendation(gpu: GPUInfo, models: list[ModelEntry]) -> str:
    if gpu.available:
        _backend_note = {
            "cuda": f"NVIDIA CUDA (compiled from source for CUDA 13)",
            "vulkan": f"Vulkan (AMD/Intel/NVIDIA GPUs, pre-built wheel available)",
            "metal": f"Apple Metal",
            "cpu": f"GPU detected but no acceleration backend installed",
        }.get(gpu.backend, gpu.backend)
        return (
            f"GPU: {gpu.name} ({gpu.vram_gb} GB VRAM) | "
            f"Backend: {_backend_note} | RAM: {gpu.ram_gb} GB | "
            f"VRAM < model need → auto-use RAM offload (slower). "
            f"Recommended: Whisper{' small' if gpu.vram_gb < 4 else ' medium'} for ASR, "
            f"Use API models for understanding (local GGUF needs RAM offload)."
        )
    return (
        f"No GPU detected (CPU mode, RAM: {gpu.ram_gb} GB). "
        f"Use Whisper tiny/base for ASR (CPU-friendly). "
        f"Understanding: API mode recommended. "
        f"Local GGUF models on CPU will be very slow for 7B+."
    )


def get_system_status() -> dict:
    gpu = detect_gpu()
    models = scan_models()
    from app.config import settings
    return {
        "gpu": {"available": gpu.available, "name": gpu.name or "N/A",
                "vendor": gpu.vendor, "backend": gpu.backend,
                "vram_gb": gpu.vram_gb, "ram_gb": gpu.ram_gb,
                "devices": gpu.devices,
                "cuda_device": getattr(settings, "cuda_device", 0)},
        "models": [{"name": m.name, "display": m.display or m.name,
                     "type": m.type, "format": m.format,
                     "size_gb": m.size_gb, "param_b": m.param_b,
                     "path": m.path,
                     "is_loaded": m.is_loaded,
                     "estimated_vram_gb": m.estimated_vram_gb,
                     "is_custom": m.is_custom}
                    for m in models],
        "current": {
            "asr": {"provider": settings.asr_provider, "model": settings.asr_model},
            "llm": {"provider": settings.llm_provider, "model": settings.llm_model},
        },
        "voice_disabled": settings.voice_disabled,
        "formats": SUPPORTED_FORMATS,
        "recommendation": get_recommendation(gpu, models),
    }
