"""Initialize databases for Humanizer MCP."""

import chromadb
from chromadb.config import Settings

from src.database import init_database
from src.config import CHROMADB_DIR, CHROMADB_COLLECTION_SESSIONS, CHROMADB_COLLECTION_INTERESTS

def init_chromadb():
    """Initialize ChromaDB collections."""
    client = chromadb.PersistentClient(
        path=str(CHROMADB_DIR),
        settings=Settings(anonymized_telemetry=False)
    )

    # Create collections
    try:
        client.get_or_create_collection(
            name=CHROMADB_COLLECTION_SESSIONS,
            metadata={"description": "MCP session memory"}
        )
        print(f"✓ ChromaDB collection created: {CHROMADB_COLLECTION_SESSIONS}")
    except Exception as e:
        print(f"! ChromaDB collection already exists: {CHROMADB_COLLECTION_SESSIONS}")

    try:
        client.get_or_create_collection(
            name=CHROMADB_COLLECTION_INTERESTS,
            metadata={"description": "Interest list embeddings"}
        )
        print(f"✓ ChromaDB collection created: {CHROMADB_COLLECTION_INTERESTS}")
    except Exception as e:
        print(f"! ChromaDB collection already exists: {CHROMADB_COLLECTION_INTERESTS}")


if __name__ == "__main__":
    print("Initializing Humanizer MCP databases...")
    print()

    # SQLite
    init_database()

    # ChromaDB
    init_chromadb()

    print()
    print("✓ All databases initialized successfully")
    print(f"  SQLite: {CHROMADB_DIR.parent / 'humanizer_mcp.db'}")
    print(f"  ChromaDB: {CHROMADB_DIR}")
