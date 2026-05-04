#!/usr/bin/env python3
"""
AI English Speaking Evaluation — Launcher

Copies the selected GPU backend's pre-downloaded DLLs into the active
llama-cpp-python installation, then starts both servers.

No pip install at startup — all backends are pre-cached by setup_resources.py.
Switching backends is a local file copy (instant).

Usage:
    python setup_resources.py    # one-time setup (download all 3 backends)
    python launcher.py           # start the app
"""

import os
import shutil
import site
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = Path(__file__).parent
RESOURCES_DIR = BACKEND_DIR / "resources"
VENDOR_DIR = BACKEND_DIR / "vendor"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

BACKEND_CHOICES = {
    "1": "cuda",
    "2": "vulkan",
    "3": "cpu",
}


def print_banner():
    print("""
╔══════════════════════════════════════════════╗
║   AI English Speaking Evaluation System      ║
║   LLM 雅思口语评估系统                          ║
║                                              ║
║   Developed by Mark                          ║
║   https://markblogforpublic.github.io         ║
║                                              ║
║   Licensed under GNU GPL v3+                 ║
║   Non-Commercial Use Only                     ║
║                                              ║
║   Disclaimer: This software is for           ║
║   educational use only. AI evaluations       ║
║   are not official IELTS scores.             ║
║   All trademarks belong to their owners.     ║
╚══════════════════════════════════════════════╝
""")


def detect_gpu():
    """Quick GPU detection for informational display (does NOT auto-select)."""
    result = {"vendor": "unknown", "backend": "cpu", "name": "N/A", "vram": 0}
    try:
        import torch
        if torch.cuda.is_available():
            result["vendor"] = "nvidia"
            result["name"] = torch.cuda.get_device_name(0)
            result["vram"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
            return result
    except ImportError:
        pass
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5
        )
        if r.returncode == 0 and r.stdout.strip():
            parts = r.stdout.strip().split(",")
            result["vendor"] = "nvidia"
            result["name"] = parts[0].strip()
            result["vram"] = round(int(parts[1].strip().replace(" MiB", "")) / 1024, 1)
            return result
    except Exception:
        pass
    try:
        r = subprocess.run(
            ["wmic", "path", "win32_VideoController", "get", "name", "/format:csv"],
            capture_output=True, text=True, timeout=5
        )
        for line in r.stdout.splitlines():
            if any(x in line.upper() for x in ["AMD", "RADEON", "RX "]):
                result["vendor"] = "amd"
                result["name"] = line.split(",")[-1].strip()
                return result
    except Exception:
        pass
    return result


def find_lib_dir():
    """Find llama-cpp-python's lib directory WITHOUT importing it."""
    for sp in site.getsitepackages():
        c = os.path.join(sp, "llama_cpp", "lib")
        if os.path.isdir(c):
            return c
    for sp in site.getusersitepackages():
        c = os.path.join(sp, "llama_cpp", "lib")
        if os.path.isdir(c):
            return c
    return None


def apply_backend(backend: str) -> bool:
    """Copy pre-downloaded DLLs from resources/<backend>/ into llama-cpp-python lib.

    Returns True on success, False if resource folder doesn't exist.
    """
    src_dir = RESOURCES_DIR / backend
    if not src_dir.exists() or not list(src_dir.glob("*.dll")):
        print(f"\n  [ERROR] resources/{backend}/ not found or empty.")
        print(f"  Run setup first: python setup_resources.py")
        return False

    lib_dir = find_lib_dir()
    if not lib_dir:
        print("\n  [ERROR] Could not find llama-cpp-python lib directory.")
        print("  Install llama-cpp-python first: pip install llama-cpp-python")
        return False

    print(f"  Source: {src_dir}")
    print(f"  Target: {lib_dir}")

    copied = 0
    for dll_file in src_dir.iterdir():
        if dll_file.suffix in (".dll", ".lib"):
            dst = os.path.join(lib_dir, dll_file.name)
            try:
                shutil.copy2(str(dll_file), dst)
                copied += 1
            except PermissionError:
                print(f"    [SKIP] {dll_file.name} — file in use (server already running?)")

    print(f"  [OK] {backend.upper()} backend — {copied} files copied")
    return True


def update_env(backend: str):
    """Update .env with the selected GPU_BACKEND."""
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        print("  [WARN] .env not found, skipping")
        return

    lines = []
    found = False
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("GPU_BACKEND="):
                lines.append(f"GPU_BACKEND={backend}\n")
                found = True
            else:
                lines.append(line)
    if not found:
        lines.append(f"\nGPU_BACKEND={backend}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"  [OK] .env updated → GPU_BACKEND={backend}")


def main():
    print_banner()
    gpu = detect_gpu()
    print(f"  Detected: {gpu['name']}")
    if gpu["vram"] > 0:
        print(f"  VRAM: {gpu['vram']} GB  |  Vendor: {gpu['vendor']}")
    print()

    # ── Check resource folders ──
    missing = []
    for v in BACKEND_CHOICES.values():
        rdir = RESOURCES_DIR / v
        ready = rdir.exists() and list(rdir.glob("*.dll"))
        status = f"{len(list(rdir.glob('*.dll')))} files" if ready else "NOT READY"
        missing.append(v) if not ready else None
        print(f"  Resources/{v}:  {status}")
    if missing:
        print("\n  ⚠  Missing GPU resource packages — see README for download links.\n")
    print()

    # ── Backend selection ──
    print("  Select GPU acceleration backend:")
    print("  [1] CUDA    — NVIDIA GPU with CUDA Toolkit")
    print("  [2] Vulkan  — AMD / Intel / NVIDIA (universal GPU)")
    print("  [3] CPU     — no GPU acceleration (safest default)")
    print()

    choice = input("  Choose [1/2/3] (default: 3 = CPU): ").strip()
    backend = BACKEND_CHOICES.get(choice, "cpu")
    print(f"\n  ── Starting with {backend.upper()} backend ──\n")

    # 1. Apply backend DLLs (copy from resources/)
    apply_backend(backend)

    # 2. Update .env
    update_env(backend)

    # 3. Start backend
    print("  Starting backend (port 8000)...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=str(BACKEND_DIR),
    )

    # 4. Start frontend
    frontend_proc = None
    if FRONTEND_DIR.exists():
        print("  Starting frontend (port 3000)...")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            shell=True,
        )

    print(f"""
  ══════════════════════════════════════════════
    Backend:   http://localhost:8000
    Frontend:  http://localhost:3000
    Settings:  http://localhost:3000/settings
    Accelerator: {backend.upper()}
    Press Ctrl+C to stop all servers
  ══════════════════════════════════════════════
""")

    try:
        backend_proc.wait()
    except KeyboardInterrupt:
        print("\n  Shutting down...")
        backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
        print("  Servers stopped.")


if __name__ == "__main__":
    main()
