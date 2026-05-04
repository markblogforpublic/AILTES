"""Unified API router."""

from fastapi import APIRouter

from .conversation import router as conversation_router
from .analytics import router as analytics_router
from .models_api import router as models_router
from .task_api import router as task_router
from .system_check import router as system_check_router

router = APIRouter()
router.include_router(conversation_router)
router.include_router(analytics_router)
router.include_router(models_router)
router.include_router(task_router)
router.include_router(system_check_router)
