"""
Main FastAPI application

This is the entry point for the Humanizer API.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from humanizer.config import settings
from humanizer.database import init_db
from humanizer.api import reading_router, povm_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup/shutdown events.

    Startup:
    - Initialize database (create tables if needed)

    Shutdown:
    - Clean up resources
    """
    # Startup
    print("🚀 Starting Humanizer API...")
    await init_db()
    print("✅ Database initialized")

    yield

    # Shutdown
    print("👋 Shutting down Humanizer API...")


# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="""
    Humanizer API - Transformation via Recursive Measurement

    Making you smarter by helping you know your actual subjective self.

    This API provides:
    - Quantum reading (density matrices, POVM measurements)
    - Text transformation (TRM-guided)
    - Archive search (semantic similarity)
    - Adaptive learning (AUI)
    """,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(reading_router)
app.include_router(povm_router)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.api_version,
        "service": "humanizer-api",
    }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "message": "Humanizer API - Consciousness work through quantum-inspired ML",
        "version": settings.api_version,
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "humanizer.main:app",
        host="0.0.0.0",
        port=settings.api_port,
        reload=True,
    )
