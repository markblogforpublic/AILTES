"""FastAPI application entry point."""

import os as _os
_os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.config import settings
from app.db.database import close_db, ping_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — DLL setup (before any llama_cpp import)
    _setup_vendor_dlls()
    db_ok = await ping_db()
    if db_ok:
        print("[OK] MongoDB connected")
    else:
        print("[WARN] MongoDB not available -- running without database")
    yield
    await close_db()


def _setup_vendor_dlls():
    """Ensure the correct GPU backend DLLs are in llama-cpp-python lib.

    Normally handled by launcher.py (copy from resources/).  This is a
    lightweight fallback for when someone starts uvicorn directly.

    Priority: resources/ > vendor/ > skip (if nothing available).
    """
    try:
        from pathlib import Path
        import shutil, os, site

        backend = settings.gpu_backend

        # Find llama_cpp lib dir WITHOUT importing (avoids DLL lock)
        lib_dir = None
        for sp in site.getsitepackages():
            c = os.path.join(sp, "llama_cpp", "lib")
            if os.path.isdir(c):
                lib_dir = c
                break
        if not lib_dir:
            for p in site.getusersitepackages():
                c = os.path.join(p, "llama_cpp", "lib")
                if os.path.isdir(c):
                    lib_dir = c
                    break
        if not lib_dir:
            print("[WARN] Could not find llama-cpp-python lib directory")
            return

        # 1) Best: copy from pre-downloaded resources/<backend>/
        resources_dir = Path(__file__).parent.parent / "resources" / backend
        if resources_dir.exists() and list(resources_dir.glob("*.dll")):
            for dll_file in resources_dir.iterdir():
                if dll_file.suffix in (".dll", ".lib"):
                    shutil.copy2(str(dll_file), os.path.join(lib_dir, dll_file.name))
            print(f"[GPU] {backend} DLLs applied from resources/")
            return

        # 2) Fallback: copy from vendor/ (legacy behavior)
        vendor = Path(__file__).parent.parent / "vendor"
        if not vendor.exists():
            print("[WARN] No resources/ or vendor/ found — GPU acceleration may not work")
            return

        print(f"[GPU] Setting up {backend} backend from vendor/ (resources/ not found)")
        if backend == "cuda":
            cuda_vendor = vendor / "cuda"
            if cuda_vendor.exists():
                for dll_file in cuda_vendor.iterdir():
                    if dll_file.suffix == ".dll":
                        shutil.copy2(str(dll_file), os.path.join(lib_dir, dll_file.name))
        elif backend == "vulkan":
            vk_vendor = vendor / "vulkan"
            if vk_vendor.exists():
                for dll_file in vk_vendor.iterdir():
                    if dll_file.suffix == ".dll":
                        dst = "llama.dll" if dll_file.name == "llama-vulkan.dll" else dll_file.name
                        shutil.copy2(str(dll_file), os.path.join(lib_dir, dst))

        for dll_file in vendor.iterdir():
            if dll_file.suffix == ".dll" and dll_file.name not in ("llama.dll",):
                if not os.path.exists(os.path.join(lib_dir, dll_file.name)):
                    shutil.copy2(str(dll_file), os.path.join(lib_dir, dll_file.name))

        print(f"[GPU] {backend} DLLs applied from vendor/")
    except Exception as e:
        print(f"[GPU] DLL setup: {e}")


app = FastAPI(
    title="AI English Speaking Evaluation System",
    description="An AI-driven interactive English speaking system with expression quality evaluation.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — supports comma-separated origins or "*" for any
_cors_origins = settings.cors_origins.split(",") if settings.cors_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=settings.cors_origins != "*",  # credentials not allowed with "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"message": "AI English Speaking Evaluation API", "status": "running"}
