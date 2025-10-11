"""
API package - FastAPI routes
"""

from .reading import router as reading_router
from .povm import router as povm_router
from .chatgpt import router as chatgpt_router
from .aui import router as aui_router
from .media import router as media_router
from .interest import router as interest_router
from .interest_list import router as interest_list_router
from .transform import router as transform_router
from .tools import router as tools_router

__all__ = [
    "reading_router",
    "povm_router",
    "chatgpt_router",
    "aui_router",
    "media_router",
    "interest_router",
    "interest_list_router",
    "transform_router",
    "tools_router",
]
