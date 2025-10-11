"""Configuration for Humanizer MCP server."""

import os
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CHROMADB_DIR = DATA_DIR / "chromadb"
SQLITE_PATH = DATA_DIR / "humanizer_mcp.db"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
CHROMADB_DIR.mkdir(exist_ok=True)

# Humanizer API
HUMANIZER_API_BASE = os.getenv("HUMANIZER_API_BASE", "http://localhost:8000")
HUMANIZER_API_TIMEOUT = 30.0  # seconds

# Default user (for tracking)
# Using first existing anonymous user from database
DEFAULT_USER_ID = os.getenv("HUMANIZER_USER_ID", "c7a31f8e-91e3-47e6-bea5-e33d0f35072d")

# ChromaDB settings
CHROMADB_COLLECTION_SESSIONS = "mcp_sessions"
CHROMADB_COLLECTION_INTERESTS = "interest_embeddings"

# SQLite settings
SQLITE_ECHO = False  # Set True for SQL debugging
