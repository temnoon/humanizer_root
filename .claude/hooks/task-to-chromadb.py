#!/usr/bin/env python3
"""
Claude Code Hook: Task State Changes → ChromaDB Memory

This hook captures TaskCreate and TaskUpdate events and stores them in ChromaDB
for cross-session context continuity.

Usage: Receives JSON via stdin from Claude Code PostToolUse hook.

Configuration:
- CHROMADB_PATH: Path to ChromaDB persistent storage (default: ~/.chromadb-memory)
- TASK_LOG_PATH: Path to JSON log file (default: ~/.claude/task-events.jsonl)
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

# Configuration
CHROMADB_PATH = os.environ.get("CHROMADB_PATH", os.path.expanduser("~/.chromadb-memory"))
TASK_LOG_PATH = os.environ.get("TASK_LOG_PATH", os.path.expanduser("~/.claude/task-events.jsonl"))

def log_to_file(event_data: dict):
    """Always log to JSONL file as backup."""
    Path(TASK_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(TASK_LOG_PATH, "a") as f:
        f.write(json.dumps(event_data) + "\n")

def store_in_chromadb(content: str, tags: list[str], metadata: dict):
    """Store memory in ChromaDB if available."""
    try:
        import chromadb
        from chromadb.config import Settings

        # Connect to persistent chromadb
        client = chromadb.PersistentClient(
            path=CHROMADB_PATH,
            settings=Settings(anonymized_telemetry=False)
        )

        # Get or create memories collection
        collection = client.get_or_create_collection(
            name="memories",
            metadata={"hnsw:space": "cosine"}
        )

        # Generate a unique ID
        doc_id = f"task-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{hash(content) % 10000:04d}"

        # Store the memory
        collection.add(
            ids=[doc_id],
            documents=[content],
            metadatas=[{
                **metadata,
                "tags": ",".join(tags),
                "type": "task-event",
                "timestamp": datetime.now().isoformat()
            }]
        )
        return True
    except ImportError:
        # chromadb not installed, log only
        return False
    except Exception as e:
        # Log error but don't fail the hook
        log_to_file({"error": str(e), "type": "chromadb_error"})
        return False

def process_task_create(tool_input: dict, tool_result: dict) -> dict:
    """Process TaskCreate event."""
    subject = tool_input.get("subject", "Unknown task")
    description = tool_input.get("description", "")
    active_form = tool_input.get("activeForm", "")
    iso_date = datetime.now().strftime('%Y-%m-%d')

    # Extract task ID from result if available
    task_id = tool_result.get("taskId", "unknown") if tool_result else "unknown"

    # Content with ISO date prefix for temporal clarity
    content = f"[{iso_date}] TASK CREATED [{task_id}]: {subject}\n\nDescription: {description}"
    if active_form:
        content += f"\nActive Form: {active_form}"

    # Tags: type,ISO-date,domain,version (per CLAUDE.md protocol)
    tags = ["task-created", iso_date, "task", "v1"]
    metadata = {
        "task_id": task_id,
        "subject": subject,
        "event": "created",
        "iso_date": iso_date
    }

    return {"content": content, "tags": tags, "metadata": metadata}

def process_task_update(tool_input: dict, tool_result: dict) -> dict:
    """Process TaskUpdate event."""
    task_id = tool_input.get("taskId", "unknown")
    status = tool_input.get("status")
    subject = tool_input.get("subject")
    description = tool_input.get("description")
    iso_date = datetime.now().strftime('%Y-%m-%d')

    # Build content based on what changed
    changes = []
    if status:
        changes.append(f"status → {status}")
    if subject:
        changes.append(f"subject → {subject}")
    if description:
        changes.append(f"description updated")

    change_summary = ", ".join(changes) if changes else "metadata updated"

    # Content with ISO date prefix for temporal clarity
    content = f"[{iso_date}] TASK UPDATED [{task_id}]: {change_summary}"

    # Tags: type,ISO-date,domain,version (per CLAUDE.md protocol)
    event_type = f"task-{status}" if status else "task-updated"
    tags = [event_type, iso_date, "task", "v1"]

    metadata = {
        "task_id": task_id,
        "event": "updated",
        "status": status or "unchanged",
        "iso_date": iso_date
    }

    return {"content": content, "tags": tags, "metadata": metadata}

def main():
    try:
        # Read JSON from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # Invalid input, exit silently

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    tool_result = input_data.get("tool_result", {})

    # Process based on tool type
    if tool_name == "TaskCreate":
        event = process_task_create(tool_input, tool_result)
    elif tool_name == "TaskUpdate":
        event = process_task_update(tool_input, tool_result)
    else:
        sys.exit(0)  # Unknown tool, exit silently

    # Add raw event data for debugging
    event["raw"] = {
        "tool_name": tool_name,
        "tool_input": tool_input,
        "session_id": input_data.get("session_id"),
        "timestamp": datetime.now().isoformat()
    }

    # Always log to file
    log_to_file(event)

    # Try to store in ChromaDB
    stored = store_in_chromadb(event["content"], event["tags"], event["metadata"])

    # Output for verbose mode
    if stored:
        print(f"✓ Task event stored in ChromaDB: {event['content'][:50]}...")
    else:
        print(f"✓ Task event logged to {TASK_LOG_PATH}")

    sys.exit(0)

if __name__ == "__main__":
    main()
