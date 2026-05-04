"""Model management API endpoints."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.core.model_manager import (
    get_system_status,
    register_custom_model,
    remove_custom_model,
    download_whisper,
    is_whisper_downloaded,
)

router = APIRouter(prefix="/api/models", tags=["models"])


# ─── System Status ───

@router.get("/status")
async def model_status():
    return get_system_status()


# ─── Select ASR / LLM Provider ───

class SelectRequest(BaseModel):
    asr_provider: str | None = None
    asr_model: str | None = None
    llm_provider: str | None = None
    llm_model: str | None = None
    llm_local_model_path: str | None = None
    voice_disabled: bool | None = None
    gpu_backend: str | None = None
    cuda_device: int | None = None

@router.post("/select")
async def select_model(data: SelectRequest):
    if data.asr_provider:
        settings.asr_provider = data.asr_provider
    if data.asr_model:
        settings.asr_model = data.asr_model
    if data.llm_provider:
        settings.llm_provider = data.llm_provider
    if data.llm_model:
        settings.llm_model = data.llm_model
    if data.llm_local_model_path is not None:
        settings.llm_local_model_path = data.llm_local_model_path
    if data.voice_disabled is not None:
        settings.voice_disabled = data.voice_disabled
    if data.gpu_backend is not None:
        settings.gpu_backend = data.gpu_backend
    if data.cuda_device is not None:
        settings.cuda_device = data.cuda_device
    return {"ok": True, "current": {
        "asr": {"provider": settings.asr_provider, "model": settings.asr_model},
        "llm": {"provider": settings.llm_provider, "model": settings.llm_model},
    }, "voice_disabled": settings.voice_disabled, "cuda_device": settings.cuda_device}


# ─── Save LLM API Config ───

class SaveAPIConfigRequest(BaseModel):
    provider: str        # "openai" | "anthropic"
    api_key: str = ""
    model: str = ""
    base_url: str = ""

@router.post("/save-api")
async def save_api_config(data: SaveAPIConfigRequest):
    """Save LLM API configuration (key, model, base URL). Persists for session."""
    if data.provider not in ("openai", "anthropic"):
        raise HTTPException(400, "Provider must be 'openai' or 'anthropic'")

    if data.provider == "openai":
        if data.api_key:
            settings.openai_api_key = data.api_key
        if data.model:
            settings.llm_model = data.model
            settings.llm_provider = "openai"
        if data.base_url:
            settings.openai_base_url = data.base_url
    else:  # anthropic
        if data.api_key:
            settings.anthropic_api_key = data.api_key
        if data.model:
            settings.llm_model = data.model
            settings.llm_provider = "anthropic"
        if data.base_url:
            settings.anthropic_base_url = data.base_url

    return {"ok": True, "message": f"{data.provider} API config updated"}


@router.get("/api-config")
async def get_api_config():
    """Return current API configuration (keys masked)."""
    return {
        "openai": {
            "configured": bool(settings.openai_api_key),
            "model": settings.llm_model if settings.llm_provider == "openai" else "",
        },
        "anthropic": {
            "configured": bool(settings.anthropic_api_key),
            "base_url": settings.anthropic_base_url or "https://api.anthropic.com",
            "model": settings.llm_model if settings.llm_provider == "anthropic" else "",
        },
        "current_provider": settings.llm_provider,
    }


# ─── Custom Model Registration ───

class RegisterModelRequest(BaseModel):
    name: str
    path: str
    type: str           # "asr" | "understanding"
    display: str = ""
    param_b: str = ""
    format: str = "gguf"

@router.post("/register")
async def register_model(data: RegisterModelRequest):
    result = register_custom_model(
        name=data.name, path=data.path,
        model_type=data.type, display=data.display,
        param_b=data.param_b, format=data.format,
    )
    if not result["ok"]:
        raise HTTPException(400, result["error"])
    return result

@router.delete("/register/{name}")
async def unregister_model(name: str):
    return remove_custom_model(name)


# ─── Whisper Download ───

class DownloadASRRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_name: str  # tiny/base/small/medium/large

@router.post("/download-asr")
async def download_asr(data: DownloadASRRequest):
    if data.model_name not in ("tiny", "base", "small", "medium", "large"):
        raise HTTPException(400, "Invalid model name. Choose: tiny/base/small/medium/large")
    # Check first
    if is_whisper_downloaded(data.model_name):
        return {"ok": True, "message": f"Whisper '{data.model_name}' already cached"}
    # Download
    result = download_whisper(data.model_name)
    if not result["ok"]:
        raise HTTPException(500, result["error"])
    return result

@router.get("/check-asr/{model_name}")
async def check_asr(model_name: str):
    if model_name not in ("tiny", "base", "small", "medium", "large"):
        raise HTTPException(400, "Invalid model name")
    return {"downloaded": is_whisper_downloaded(model_name)}


# ─── File picker (native OS dialog) ───

@router.get("/pick-file")
async def pick_file():
    """Open a native OS file picker dialog and return the selected file path.

    Only works when the backend runs locally (localhost).  The dialog
    appears on the server's desktop — which is the user's machine.
    """
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askopenfilename(
            title="Select GGUF model file",
            filetypes=[("GGUF files", "*.gguf"), ("All files", "*.*")],
        )
        root.destroy()
        return {"ok": True, "path": path or ""}
    except Exception as e:
        return {"ok": False, "error": f"File picker failed: {e}"}


# ─── GGUF Model Probe ───

class ProbeRequest(BaseModel):
    path: str
    model_config = {"protected_namespaces": ()}

@router.post("/probe")
async def probe_gguf(data: ProbeRequest):
    """Probe a GGUF file and auto-detect its metadata (name, params, arch)."""
    import struct
    fp = Path(data.path)
    if not fp.exists():
        raise HTTPException(400, f"File not found: {data.path}")
    if not fp.is_file():
        raise HTTPException(400, "Path must be a file, not a directory")

    try:
        with open(fp, "rb") as f:
            magic = f.read(4)
            if magic != b"GGUF":
                raise HTTPException(400, "Not a valid GGUF file (missing GGUF magic)")
            version = struct.unpack("<I", f.read(4))[0]
            tensor_count = struct.unpack("<Q", f.read(8))[0]
            kv_count = struct.unpack("<Q", f.read(8))[0]

            metadata = {}
            for _ in range(min(kv_count, 100)):
                key_len = struct.unpack("<Q", f.read(8))[0]
                key = f.read(key_len).decode("utf-8", errors="replace")
                val_type = struct.unpack("<I", f.read(4))[0]
                val = _read_gguf_value(f, val_type)
                if key in ("general.name", "general.architecture",
                           "general.file_type", "general.quantization_version",
                           "tokenizer.ggml.model", "tokenizer.ggml.tokens",
                           "general.description"):
                    metadata[key] = val

        # Extract useful info
        name = metadata.get("general.name", "")
        arch = metadata.get("general.architecture", "")
        file_type = metadata.get("general.file_type", "")
        file_size_gb = round(fp.stat().st_size / 1e9, 2)

        # Estimate params from file size (rough: Q8≈1B/GB, Q4≈2B/GB, FP16≈0.5B/GB)
        estimated_b = ""
        if file_size_gb > 0:
            if "Q8" in str(file_type) or "q8" in str(file_type).lower():
                estimated_b = f"~{file_size_gb:.0f}B"
            elif "Q4" in str(file_type) or "q4" in str(file_type).lower():
                estimated_b = f"~{file_size_gb * 2:.0f}B"
            else:
                estimated_b = f"~{file_size_gb:.0f}B"

        return {
            "ok": True,
            "path": str(fp.absolute()),
            "name": name or "",
            "architecture": arch or "",
            "file_type": str(file_type),
            "size_gb": file_size_gb,
            "estimated_params": estimated_b,
            "version": version,
            "metadata_keys": list(metadata.keys()),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Failed to probe GGUF file: {e}")


def _read_gguf_value(f, val_type: int):
    """Read a single GGUF value from file handle."""
    import struct
    if val_type == 0:   return f.read(1)[0]          # u8
    elif val_type == 1: return struct.unpack("<b", f.read(1))[0]     # i8
    elif val_type == 2: return struct.unpack("<H", f.read(2))[0]     # u16
    elif val_type == 3: return struct.unpack("<h", f.read(2))[0]     # i16
    elif val_type == 4: return struct.unpack("<I", f.read(4))[0]     # u32
    elif val_type == 5: return struct.unpack("<i", f.read(4))[0]     # i32
    elif val_type == 6: return struct.unpack("<f", f.read(4))[0]     # f32
    elif val_type == 7: return f.read(1)[0] != 0                     # bool
    elif val_type == 8:                                              # string
        s_len = struct.unpack("<Q", f.read(8))[0]
        return f.read(s_len).decode("utf-8", errors="replace")
    elif val_type == 9:                                              # array
        a_type = struct.unpack("<I", f.read(4))[0]
        a_count = struct.unpack("<Q", f.read(8))[0]
        if a_type == 8:                                              # string array
            items = []
            read_n = min(a_count, 20)
            for _ in range(read_n):
                s_len = struct.unpack("<Q", f.read(8))[0]
                items.append(f.read(s_len).decode("utf-8", errors="replace"))
            # MUST skip remaining items — otherwise file position is corrupted
            for _ in range(read_n, a_count):
                s_len = struct.unpack("<Q", f.read(8))[0]
                f.seek(s_len, 1)
            return items
        else:
            f.seek(a_count * _gguf_type_size(a_type), 1)
            return f"[array:{a_type}x{a_count}]"
    elif val_type == 10: return struct.unpack("<Q", f.read(8))[0]   # u64
    elif val_type == 11: return struct.unpack("<q", f.read(8))[0]   # i64
    elif val_type == 12: return struct.unpack("<d", f.read(8))[0]   # f64
    else:
        return f"[unknown_type:{val_type}]"


def _gguf_type_size(t: int) -> int:
    sizes = {0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8}
    return sizes.get(t, 1)
