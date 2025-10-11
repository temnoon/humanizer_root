#!/usr/bin/env python3
"""
ChromaDB Production Database Operator

Purpose: Create and manage a production-focused ChromaDB for humanizer-agent development.
         Separates production notes from historical debugging/dead-end exploration.

Target Application: /Users/tem/humanizer-agent/
Goal: Complete production-ready API + WebGUI for archive-to-publication transformation
Output Formats: Academic Paper, Book, Picture Book with publication-ready PDFs and covers

Philosophy: "Write when necessary, reuse until you really need to add functionality"
            Track large files needing refactoring, document phenomenology of current state.

Database Strategy:
- production_db: Focused on completing publication pipeline features
- historical_db: All development history (debugging, dead ends, experiments)
- Switch between DBs based on task context
"""

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from pathlib import Path
from datetime import datetime
import json
from typing import List, Dict, Optional
import os


class ChromaDBOperator:
    """Manage multiple ChromaDB instances for different purposes."""

    def __init__(self, base_path: str = "/Users/tem/archive/mcp-memory/mcp-memory-service"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

        # Database paths
        self.production_path = self.base_path / "chroma_production_db"  # Dev content only
        self.historical_path = self.base_path / "chroma_test_db"        # Complete archive
        self.meta_path = self.base_path / "chroma_meta_db"              # System/guides/tooling

        # Current active database
        self.current_db: Optional[chromadb.ClientAPI] = None
        self.current_collection = None
        self.current_db_name = None

        # Embedding function (same as MCP memory service)
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )

    def create_production_db(self) -> chromadb.ClientAPI:
        """Initialize new production database."""
        print(f"Creating production database at: {self.production_path}")

        client = chromadb.PersistentClient(
            path=str(self.production_path),
            settings=Settings(anonymized_telemetry=False)
        )

        # Create production collection
        try:
            collection = client.get_or_create_collection(
                name="production_memories",
                embedding_function=self.embedding_function,
                metadata={
                    "description": "Production-focused development notes for humanizer-agent",
                    "created": datetime.now().isoformat(),
                    "purpose": "Complete publication pipeline (Academic Paper, Book, Picture Book outputs)"
                }
            )
            print(f"✓ Production collection created: {collection.count()} memories")
        except Exception as e:
            print(f"Error creating collection: {e}")
            raise

        return client

    def switch_to_production(self):
        """Switch to production database."""
        self.current_db = chromadb.PersistentClient(
            path=str(self.production_path),
            settings=Settings(anonymized_telemetry=False)
        )
        self.current_collection = self.current_db.get_or_create_collection(
            name="production_memories",
            embedding_function=self.embedding_function
        )
        self.current_db_name = "production"
        print(f"✓ Switched to PRODUCTION database ({self.current_collection.count()} memories)")

    def switch_to_historical(self):
        """Switch to historical/debugging database."""
        self.current_db = chromadb.PersistentClient(
            path=str(self.historical_path),
            settings=Settings(anonymized_telemetry=False)
        )
        self.current_collection = self.current_db.get_or_create_collection(
            name="memories",
            embedding_function=self.embedding_function
        )
        self.current_db_name = "historical"
        print(f"✓ Switched to HISTORICAL database ({self.current_collection.count()} memories)")

    def switch_to_meta(self):
        """Switch to meta/system database (guides, tooling, procedures)."""
        self.current_db = chromadb.PersistentClient(
            path=str(self.meta_path),
            settings=Settings(anonymized_telemetry=False)
        )
        self.current_collection = self.current_db.get_or_create_collection(
            name="meta_memories",
            embedding_function=self.embedding_function,
            metadata={
                "description": "System documentation, guides, and tooling notes",
                "purpose": "Meta-level content separate from development context"
            }
        )
        self.current_db_name = "meta"
        print(f"✓ Switched to META database ({self.current_collection.count()} memories)")

    def store_memory(
        self,
        content: str,
        tags: List[str],
        metadata: Optional[Dict] = None
    ) -> str:
        """Store a memory in current database."""
        if not self.current_collection:
            raise RuntimeError("No database selected. Call switch_to_production() or switch_to_historical() first.")

        import hashlib
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]

        mem_metadata = {
            "tags": ",".join(tags),
            "timestamp": datetime.now().isoformat(),
            "db_type": self.current_db_name
        }
        if metadata:
            mem_metadata.update(metadata)

        self.current_collection.add(
            documents=[content],
            metadatas=[mem_metadata],
            ids=[content_hash]
        )

        print(f"✓ Stored memory [{','.join(tags)}]: {content[:80]}...")
        return content_hash

    def query_memories(
        self,
        query: str,
        n_results: int = 5,
        filter_tags: Optional[List[str]] = None
    ) -> Dict:
        """Query memories from current database."""
        if not self.current_collection:
            raise RuntimeError("No database selected.")

        where_filter = None
        if filter_tags:
            # ChromaDB metadata filtering (simplified)
            pass

        results = self.current_collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_filter
        )

        return results

    def seed_production_database(self, project_path: str = "/Users/tem/humanizer-agent"):
        """Seed production database with initial project phenomenology."""
        if self.current_db_name != "production":
            raise RuntimeError("Must be on production database to seed. Call switch_to_production() first.")

        print("\n🌱 Seeding production database with project phenomenology...\n")

        # Project structure overview
        self.store_memory(
            content="""Humanizer-agent project structure (Oct 2025):
Backend (Python 3.11 + FastAPI):
- main.py (153 lines) - FastAPI app with 7 router modules
- api/routes.py (567 lines) - Core transformation API endpoints
- agents/transformation_agent.py (319 lines) - Claude Agent SDK integration
- services/madhyamaka_service.py (1003 lines) ⚠️ NEEDS REFACTORING - too large
- models/chunk_models.py (558 lines) - database chunking models
- database/ - PostgreSQL + pgvector integration
- memory/ - Memory persistence system

Frontend (React + Vite): Simple upload interface, token counter, transformation UI

Key Technologies: FastAPI, PostgreSQL, pgvector, Claude Agent SDK, React, Vite
""",
            tags=["architecture", "structure", "overview"],
            metadata={"file_count": "30+", "largest_file": "madhyamaka_service.py:1003"}
        )

        # Files needing refactoring
        self.store_memory(
            content="""Files requiring refactoring (>500 lines):
1. backend/services/madhyamaka_service.py - 1003 lines (Middle Path philosophical service)
   → Split into: madhyamaka_core.py, madhyamaka_transformations.py, madhyamaka_contemplation.py
2. backend/api/routes.py - 567 lines (main transformation routes)
   → Already focused, but consider splitting chunking logic to separate module
3. backend/models/chunk_models.py - 558 lines (database models)
   → Consider splitting by concern: archive_models.py, transformation_models.py
4. backend/api/philosophical_routes.py - 540 lines
5. backend/api/library_routes.py - 526 lines

Best Practice: Target 200-300 lines per file. Refactor when > 500 lines.""",
            tags=["refactoring", "tech-debt", "file-size"],
            metadata={"priority": "high", "threshold": "500_lines"}
        )

        # Current capabilities
        self.store_memory(
            content="""Current humanizer-agent capabilities:
✅ PERSONA/NAMESPACE/STYLE narrative transformation
✅ PostgreSQL + pgvector for embeddings
✅ Session management and history tracking
✅ Philosophical perspectives generation
✅ Madhyamaka (Middle Path) contemplation
✅ ChatGPT archive import
✅ Token counting and validation
✅ Chunking for large documents
✅ Frontend React UI with drag-drop upload

Philosophical Features:
- Word dissolution contemplation
- Socratic dialogue generation
- Multi-perspective analysis
- Belief framework mapping
- Three Realms design system (Corporeal/Symbolic/Subjective)
""",
            tags=["features", "capabilities", "status"],
            metadata={"completion": "MVP", "phase": "development"}
        )

        # Missing: Publication pipeline
        self.store_memory(
            content="""MISSING: Publication Pipeline (PRIMARY GOAL)

Target Outputs:
1. Academic Paper - LaTeX/PDF with proper citations, formatting
2. Book - Typeset chapters with front matter, pagination
3. Picture Book - Layout with image placement, text flow

Required Components:
📝 Archive-to-structure converter (extract sections, chapters, themes)
📐 LaTeX template engine (academic, book, picture book templates)
🎨 Cover generator (front outside, front inside, spine, back inside, back outside)
📄 PDF compositor (combine typeset content + covers)
🖼️ Image processor (resize, embed, caption for picture books)
📚 Bibliography generator (extract references, format citations)
🔄 Format detector (auto-detect archive type → best output format)

Tech Stack Needed:
- LaTeX/XeLaTeX for typesetting
- Pillow/ImageMagick for cover generation
- PyPDF2/pdfplumber for PDF manipulation
- Jinja2 for LaTeX template rendering
- citation-parser for bibliography
""",
            tags=["publication", "todo", "pipeline", "priority"],
            metadata={"status": "not_started", "priority": "critical"}
        )

        # Architecture decision: Why not abandon current work
        self.store_memory(
            content="""DEC Jupiter Lesson: Don't abandon working architecture

Current humanizer-agent is the "VAX" - proven, working, extensible.
- FastAPI backend is solid
- PostgreSQL + pgvector works
- Claude Agent SDK integration functional
- Frontend shows data

DON'T: Start over with Cloudflare Workers (that's "Jupiter" - the next shiny thing)
DO: Extend current stack with publication features
DO: Incremental refactoring of large files
DO: Add LaTeX/PDF generation to existing services

Principle: "One basket, one egg" - nurture what works, don't chase rewrites.
Refactor when necessary, but keep the engine running.""",
            tags=["architecture", "philosophy", "dec", "decision"],
            metadata={"reference": "Digital Equipment Corporation", "lesson": "jupiter_cancellation"}
        )

        # Development workflow
        self.store_memory(
            content="""Development workflow best practices:
1. Check ChromaDB production memories FIRST before coding
2. Write when necessary, reuse existing code until you must add functionality
3. Refactor files > 500 lines into focused modules
4. Mark large files with ⚠️ in notes
5. After significant work, store notes in ChromaDB with relevant tags
6. Use tags: architecture, feature, bug-fix, refactoring, todo, publication

File organization:
- backend/services/ - Business logic (transformation, embedding, import)
- backend/api/ - Route handlers (thin layer over services)
- backend/models/ - Database schemas and Pydantic models
- backend/agents/ - Claude Agent SDK wrappers
- backend/utils/ - Pure utility functions

When to refactor: File exceeds 500 lines OR has >3 distinct concerns""",
            tags=["workflow", "best-practice", "development"],
            metadata={"refactor_threshold": "500_lines"}
        )

        # Tech stack overview
        self.store_memory(
            content="""Technology Stack Overview:

Backend:
- Python 3.11 (required - virtual env at backend/venv)
- FastAPI - async web framework
- PostgreSQL - primary database
- pgvector - vector similarity search
- SQLAlchemy (async) - ORM
- Anthropic Claude API - transformations
- sentence-transformers - embeddings (all-MiniLM-L6-v2)

Frontend:
- React 18
- Vite - build tool
- TailwindCSS - styling
- Axios - API client

Development:
- uvicorn - ASGI server
- pytest - testing
- black - code formatting
- ruff - linting
- mypy - type checking

Startup: ./start.sh (handles venv, deps, starts both servers)
Backend port: 8000, Frontend port: 5173
""",
            tags=["tech-stack", "dependencies", "setup"],
            metadata={"python_version": "3.11", "backend_port": "8000", "frontend_port": "5173"}
        )

        # Database schema understanding
        self.store_memory(
            content="""Database Schema (PostgreSQL):

Key Tables:
- transformations - PERSONA/NAMESPACE/STYLE transformation records
  - id, session_id, user_id
  - source_text, transformed_content
  - source_embedding, transformed_embedding (pgvector)
  - persona, namespace, style
  - status, error_message
  - extra_metadata (JSONB)

- sessions - User session tracking
- chunks - Document chunking for large texts
- philosophical_* - Madhyamaka contemplation data

Embedding Strategy:
- Multi-level: document, chunk, sentence embeddings
- Source + transformed content both embedded
- Cosine similarity search via pgvector
- Model: all-MiniLM-L6-v2 (384 dimensions)

Storage:
- Small content (<100KB): in PostgreSQL
- Large media: filesystem with hash reference
""",
            tags=["database", "schema", "embeddings"],
            metadata={"db_type": "postgresql", "vector_dim": "384"}
        )

        # API endpoint map
        self.store_memory(
            content="""API Endpoints Map:

Transformation:
POST /api/transform - Start transformation (PERSONA/NAMESPACE/STYLE)
GET /api/transform/{id} - Status check
GET /api/transform/{id}/result - Download result
POST /api/check-tokens - Validate token count
DELETE /api/transform/{id} - Delete transformation

Philosophical:
POST /api/philosophical/perspectives - Generate multiple viewpoints
POST /api/philosophical/contemplate - Word dissolution, Socratic dialogue
POST /api/philosophical/archive/analyze - Map belief structures

Sessions:
POST /api/sessions - Create session
GET /api/sessions/{id} - Get session details

Madhyamaka (Middle Path):
POST /api/madhyamaka/detect - Detect dualistic tensions
POST /api/madhyamaka/transform - Transform to Middle Path view
POST /api/madhyamaka/contemplate - Nagarjuna-inspired contemplation

Import:
POST /api/import/chatgpt - Import ChatGPT archive
POST /api/import/claude - Import Claude conversations

Library/Gizmo routes also exist - check api/ directory for details.
""",
            tags=["api", "endpoints", "routes"],
            metadata={"framework": "fastapi", "base_url": "http://localhost:8000"}
        )

        print("\n✅ Production database seeded with 9 initial memories")
        print(f"Total memories in production DB: {self.current_collection.count()}\n")

    def show_status(self):
        """Show status of all databases."""
        print("\n" + "="*60)
        print("ChromaDB Status Report")
        print("="*60)

        # Production DB
        if self.production_path.exists():
            prod_client = chromadb.PersistentClient(path=str(self.production_path))
            try:
                prod_coll = prod_client.get_collection("production_memories",
                                                       embedding_function=self.embedding_function)
                print(f"\n📊 PRODUCTION DB: {self.production_path}")
                print(f"   Memories: {prod_coll.count()}")
                print(f"   Purpose: Publication pipeline development")
            except Exception as e:
                print(f"\n📊 PRODUCTION DB: {self.production_path}")
                print(f"   Status: Not initialized ({e})")
        else:
            print(f"\n📊 PRODUCTION DB: Not created")

        # Historical DB
        if self.historical_path.exists():
            hist_client = chromadb.PersistentClient(path=str(self.historical_path))
            try:
                hist_coll = hist_client.get_collection("memories",
                                                       embedding_function=self.embedding_function)
                print(f"\n📚 HISTORICAL DB: {self.historical_path}")
                print(f"   Memories: {hist_coll.count()}")
                print(f"   Purpose: All development history (debugging, experiments)")
            except Exception as e:
                print(f"\n📚 HISTORICAL DB: {self.historical_path}")
                print(f"   Status: Error ({e})")
        else:
            print(f"\n📚 HISTORICAL DB: Not found")

        # Meta DB
        if self.meta_path.exists():
            meta_client = chromadb.PersistentClient(path=str(self.meta_path))
            try:
                meta_coll = meta_client.get_collection("meta_memories",
                                                       embedding_function=self.embedding_function)
                print(f"\n🔧 META DB: {self.meta_path}")
                print(f"   Memories: {meta_coll.count()}")
                print(f"   Purpose: System docs, guides, procedures, tooling")
            except Exception as e:
                print(f"\n🔧 META DB: {self.meta_path}")
                print(f"   Status: Not initialized ({e})")
        else:
            print(f"\n🔧 META DB: Not created")

        # Current selection
        if self.current_db_name:
            print(f"\n🎯 CURRENT: {self.current_db_name.upper()} database")
        else:
            print(f"\n🎯 CURRENT: None (call switch_to_production() or switch_to_historical())")

        print("\n" + "="*60 + "\n")


def main():
    """Main operator interface."""
    import sys

    operator = ChromaDBOperator()

    if len(sys.argv) < 2:
        print(__doc__)
        print("\nUsage:")
        print("  python production_chromadb_operator.py create         - Create production DB")
        print("  python production_chromadb_operator.py create-meta    - Create meta DB")
        print("  python production_chromadb_operator.py seed           - Seed production with data")
        print("  python production_chromadb_operator.py seed-meta      - Seed meta with guides")
        print("  python production_chromadb_operator.py migrate-meta   - Move meta content from production")
        print("  python production_chromadb_operator.py status         - Show all DB status")
        print("  python production_chromadb_operator.py query <db> <text> - Query specific DB")
        print("                                                         (db: prod|meta|hist)")
        return

    command = sys.argv[1]

    if command == "create":
        operator.create_production_db()
        print("\n✓ Production database created")
        operator.show_status()

    elif command == "seed":
        operator.switch_to_production()
        operator.seed_production_database()
        operator.show_status()

    elif command == "status":
        operator.show_status()

    elif command == "create-meta":
        operator.switch_to_meta()
        print("\n✓ Meta database created")
        operator.show_status()

    elif command == "seed-meta":
        operator.switch_to_meta()
        # Seed with essential guides
        operator.store_memory(
            content=open('/Users/tem/humanizer_root/claude_code_memory_guide.md').read(),
            tags=["pinned", "guide", "best-practice", "meta", "claude-code"],
            metadata={"priority": "critical", "type": "guide", "pinned": True}
        )
        operator.store_memory(
            content=open('/Users/tem/humanizer_root/TRACKING_GUIDE.md').read(),
            tags=["tracking", "tooling", "guide", "meta"],
            metadata={"priority": "high", "type": "guide"}
        )
        print("\n✓ Meta database seeded with guides")
        operator.show_status()

    elif command == "migrate-meta":
        # Get meta content from production
        operator.switch_to_production()
        prod_results = operator.current_collection.get(
            where={"tags": {"$in": ["meta", "guide", "pinned", "tracking"]}}
        )

        # Move to meta
        operator.switch_to_meta()
        if prod_results['documents']:
            for doc, meta in zip(prod_results['documents'], prod_results['metadatas']):
                # Re-store in meta DB
                import hashlib
                content_hash = hashlib.sha256(doc.encode()).hexdigest()[:16]
                operator.current_collection.add(
                    documents=[doc],
                    metadatas=[meta],
                    ids=[content_hash]
                )
            print(f"\n✓ Migrated {len(prod_results['documents'])} meta memories from production to meta DB")

        # Delete from production
        operator.switch_to_production()
        if prod_results['ids']:
            operator.current_collection.delete(ids=prod_results['ids'])
            print(f"✓ Removed {len(prod_results['ids'])} meta memories from production DB")

        operator.show_status()

    elif command == "query":
        if len(sys.argv) < 4:
            print("Usage: python production_chromadb_operator.py query <db> <search_text>")
            print("       db: prod, meta, hist")
            return

        db_type = sys.argv[2].lower()
        query_text = " ".join(sys.argv[3:])

        if db_type in ['prod', 'production']:
            operator.switch_to_production()
        elif db_type == 'meta':
            operator.switch_to_meta()
        elif db_type in ['hist', 'historical']:
            operator.switch_to_historical()
        else:
            print(f"Unknown database: {db_type}")
            return

        results = operator.query_memories(query_text, n_results=3)

        print(f"\n🔍 Query: '{query_text}'")
        print(f"📊 Database: {operator.current_db_name} ({operator.current_collection.count()} total memories)\n")

        if results['documents'] and results['documents'][0]:
            for i, (doc, metadata, distance) in enumerate(zip(
                results['documents'][0],
                results['metadatas'][0],
                results['distances'][0]
            ), 1):
                print(f"{i}. [similarity: {1-distance:.3f}] {metadata.get('tags', 'no-tags')}")
                print(f"   {doc[:200]}...")
                print()
        else:
            print("No results found.")

    else:
        print(f"Unknown command: {command}")
        print("Available: create, create-meta, seed, seed-meta, migrate-meta, status, query")


if __name__ == "__main__":
    main()
