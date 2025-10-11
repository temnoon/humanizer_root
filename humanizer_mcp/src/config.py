"""Configuration for Humanizer MCP server."""

import os
from pathlib import Path
from uuid import UUID

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CHROMADB_DIR = DATA_DIR / "chromadb"
SQLITE_PATH = DATA_DIR / "humanizer_mcp.db"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
CHROMADB_DIR.mkdir(exist_ok=True)

# Humanizer API
HUMANIZER_API_BASE_URL = os.getenv("HUMANIZER_API_BASE", "http://localhost:8000")
REQUEST_TIMEOUT = 60.0  # seconds (increased for long-running operations)

# Default user (for tracking)
# Using a default UUID for MCP users
DEFAULT_USER_ID = UUID(os.getenv("HUMANIZER_USER_ID", "c7a31f8e-91e3-47e6-bea5-e33d0f35072d"))

# ChromaDB settings
CHROMADB_COLLECTION_SESSIONS = "mcp_sessions"
CHROMADB_COLLECTION_INTERESTS = "interest_embeddings"

# SQLite settings
SQLITE_ECHO = False  # Set True for SQL debugging
