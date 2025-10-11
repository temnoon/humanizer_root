#!/usr/bin/env python3
"""
Codebase Hash Tracker - Monitor humanizer-agent changes and cross-reference with ChromaDB

Tracks:
- File hashes (individual files)
- Tree hash (entire codebase state)
- Timestamps and change history
- Undocumented changes (no ChromaDB note)

Usage:
    ./codebase_tracker.py snapshot          # Take current snapshot
    ./codebase_tracker.py check             # Check for changes since last snapshot
    ./codebase_tracker.py verify-notes      # Cross-reference changes with ChromaDB
    ./codebase_tracker.py status            # Show current state
    ./codebase_tracker.py diff              # Show detailed file-level changes
"""

import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import subprocess

# Add operator to path for ChromaDB access
sys.path.insert(0, '/Users/tem/humanizer_root')


class CodebaseTracker:
    """Track codebase changes and correlate with ChromaDB notes."""

    def __init__(self, project_path: str = "/Users/tem/humanizer-agent"):
        self.project_path = Path(project_path)
        self.tracker_dir = Path("/Users/tem/humanizer_root/.codebase_tracking")
        self.tracker_dir.mkdir(exist_ok=True)

        self.snapshot_file = self.tracker_dir / "snapshots.json"
        self.flags_file = self.tracker_dir / "undocumented_flags.json"

        # Patterns to ignore
        self.ignore_patterns = {
            '__pycache__',
            'node_modules',
            '.git',
            'venv',
            '.env',
            '.DS_Store',
            '*.pyc',
            '*.swp',
            '*.log',
            'dist',
            'build',
            '.pytest_cache',
            'chroma_*_db'  # Don't track ChromaDB files
        }

        # Files to track (Python, JS, config)
        self.track_extensions = {'.py', '.js', '.jsx', '.json', '.sh', '.md', '.txt'}

    def _should_ignore(self, path: Path) -> bool:
        """Check if path should be ignored."""
        path_str = str(path)

        # Check ignore patterns
        for pattern in self.ignore_patterns:
            if pattern.startswith('*.'):
                if path.suffix == pattern[1:]:
                    return True
            else:
                if pattern in path_str:
                    return True

        return False

    def _hash_file(self, file_path: Path) -> str:
        """Generate SHA-256 hash of file content."""
        hasher = hashlib.sha256()
        try:
            with open(file_path, 'rb') as f:
                hasher.update(f.read())
            return hasher.hexdigest()
        except Exception as e:
            print(f"Warning: Could not hash {file_path}: {e}")
            return "ERROR"

    def _hash_tree(self, file_hashes: Dict[str, str]) -> str:
        """Generate hash of entire codebase tree."""
        # Sort by path for consistency
        sorted_items = sorted(file_hashes.items())
        combined = ''.join(f"{path}:{hash}" for path, hash in sorted_items)
        return hashlib.sha256(combined.encode()).hexdigest()

    def scan_codebase(self) -> Dict[str, str]:
        """Scan project and generate file hashes."""
        file_hashes = {}

        for root, dirs, files in os.walk(self.project_path):
            root_path = Path(root)

            # Remove ignored directories from traversal
            dirs[:] = [d for d in dirs if not self._should_ignore(root_path / d)]

            for file in files:
                file_path = root_path / file

                # Skip ignored files and unwanted extensions
                if self._should_ignore(file_path):
                    continue

                if file_path.suffix not in self.track_extensions:
                    continue

                # Store relative path
                rel_path = str(file_path.relative_to(self.project_path))
                file_hash = self._hash_file(file_path)

                if file_hash != "ERROR":
                    file_hashes[rel_path] = file_hash

        return file_hashes

    def take_snapshot(self, note: Optional[str] = None) -> Dict:
        """Take a snapshot of current codebase state."""
        print("📸 Scanning codebase...")
        file_hashes = self.scan_codebase()
        tree_hash = self._hash_tree(file_hashes)

        snapshot = {
            "timestamp": datetime.now().isoformat(),
            "tree_hash": tree_hash,
            "file_count": len(file_hashes),
            "file_hashes": file_hashes,
            "note": note
        }

        # Load existing snapshots
        snapshots = self._load_snapshots()
        snapshots.append(snapshot)

        # Keep last 50 snapshots
        if len(snapshots) > 50:
            snapshots = snapshots[-50:]

        # Save
        with open(self.snapshot_file, 'w') as f:
            json.dump(snapshots, f, indent=2)

        print(f"✓ Snapshot taken: {tree_hash[:12]}")
        print(f"  Files tracked: {len(file_hashes)}")
        print(f"  Timestamp: {snapshot['timestamp']}")

        return snapshot

    def _load_snapshots(self) -> List[Dict]:
        """Load snapshot history."""
        if not self.snapshot_file.exists():
            return []

        try:
            with open(self.snapshot_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load snapshots: {e}")
            return []

    def check_changes(self) -> Tuple[bool, Dict]:
        """Check if codebase changed since last snapshot."""
        snapshots = self._load_snapshots()

        if not snapshots:
            print("⚠️  No previous snapshot found. Run 'snapshot' first.")
            return False, {}

        last_snapshot = snapshots[-1]
        current_hashes = self.scan_codebase()
        current_tree_hash = self._hash_tree(current_hashes)

        changed = current_tree_hash != last_snapshot['tree_hash']

        if not changed:
            print("✓ No changes since last snapshot")
            print(f"  Last snapshot: {last_snapshot['timestamp']}")
            return False, {}

        # Detect specific changes
        last_hashes = last_snapshot['file_hashes']

        added = set(current_hashes.keys()) - set(last_hashes.keys())
        removed = set(last_hashes.keys()) - set(current_hashes.keys())
        modified = {
            path for path in current_hashes.keys() & last_hashes.keys()
            if current_hashes[path] != last_hashes[path]
        }

        changes = {
            "detected": True,
            "last_snapshot": last_snapshot['timestamp'],
            "current_tree_hash": current_tree_hash,
            "last_tree_hash": last_snapshot['tree_hash'],
            "added": sorted(added),
            "removed": sorted(removed),
            "modified": sorted(modified),
            "total_changes": len(added) + len(removed) + len(modified)
        }

        print(f"🔄 Changes detected since {last_snapshot['timestamp']}")
        print(f"  Tree hash: {last_snapshot['tree_hash'][:12]} → {current_tree_hash[:12]}")
        print(f"  Added: {len(added)} files")
        print(f"  Modified: {len(modified)} files")
        print(f"  Removed: {len(removed)} files")

        return True, changes

    def verify_chromadb_notes(self, changes: Dict) -> List[str]:
        """Check if changes are documented in ChromaDB."""
        if not changes.get('detected'):
            print("No changes to verify")
            return []

        print("\n🔍 Checking ChromaDB for change documentation...")

        try:
            from production_chromadb_operator import ChromaDBOperator
            op = ChromaDBOperator()
            op.switch_to_production()

            undocumented = []
            documented = []

            # Check each changed file
            all_changed_files = (
                changes.get('added', []) +
                changes.get('modified', []) +
                changes.get('removed', [])
            )

            for file_path in all_changed_files:
                # Query for notes about this file
                file_name = Path(file_path).name
                query = f"{file_name} {file_path}"

                results = op.query_memories(query, n_results=3)

                # Check if any results mention this file in recent context
                if results['documents'] and results['documents'][0]:
                    # Check timestamp - only consider notes from last 7 days
                    has_recent_note = False
                    for meta in results['metadatas'][0]:
                        timestamp = meta.get('timestamp', '')
                        if timestamp:
                            try:
                                note_time = datetime.fromisoformat(timestamp)
                                last_snapshot_time = datetime.fromisoformat(changes['last_snapshot'])
                                if note_time >= last_snapshot_time:
                                    has_recent_note = True
                                    documented.append(file_path)
                                    break
                            except:
                                pass

                    if not has_recent_note:
                        undocumented.append(file_path)
                else:
                    undocumented.append(file_path)

            print(f"\n📝 Documentation check:")
            print(f"  Documented: {len(documented)} files")
            print(f"  Undocumented: {len(undocumented)} files")

            if undocumented:
                print(f"\n⚠️  Undocumented changes:")
                for path in undocumented[:10]:  # Show first 10
                    change_type = (
                        "added" if path in changes.get('added', []) else
                        "removed" if path in changes.get('removed', []) else
                        "modified"
                    )
                    print(f"    [{change_type}] {path}")

                if len(undocumented) > 10:
                    print(f"    ... and {len(undocumented) - 10} more")

            return undocumented

        except Exception as e:
            print(f"❌ Error checking ChromaDB: {e}")
            return all_changed_files

    def flag_undocumented(self, undocumented: List[str], changes: Dict):
        """Flag undocumented changes for review."""
        if not undocumented:
            print("\n✓ All changes are documented!")
            return

        flag = {
            "timestamp": datetime.now().isoformat(),
            "last_snapshot": changes['last_snapshot'],
            "undocumented_files": undocumented,
            "change_summary": {
                "added": len(changes.get('added', [])),
                "modified": len(changes.get('modified', [])),
                "removed": len(changes.get('removed', []))
            },
            "status": "needs_documentation"
        }

        # Load existing flags
        flags = []
        if self.flags_file.exists():
            with open(self.flags_file, 'r') as f:
                flags = json.load(f)

        flags.append(flag)

        # Save
        with open(self.flags_file, 'w') as f:
            json.dump(flags, f, indent=2)

        print(f"\n🚩 Undocumented changes flagged: {self.flags_file}")
        print(f"   Run 'clear-flags' after documenting changes in ChromaDB")

    def show_status(self):
        """Show current tracking status."""
        snapshots = self._load_snapshots()

        print("\n" + "="*60)
        print("Codebase Tracker Status")
        print("="*60)

        if not snapshots:
            print("\n⚠️  No snapshots yet. Run 'snapshot' to begin tracking.")
            return

        last = snapshots[-1]
        print(f"\n📊 Latest Snapshot:")
        print(f"  Timestamp: {last['timestamp']}")
        print(f"  Tree Hash: {last['tree_hash'][:16]}...")
        print(f"  Files Tracked: {last['file_count']}")
        if last.get('note'):
            print(f"  Note: {last['note']}")

        print(f"\n📚 Snapshot History: {len(snapshots)} snapshots")

        # Check for undocumented flags
        if self.flags_file.exists():
            with open(self.flags_file, 'r') as f:
                flags = json.load(f)

            active_flags = [f for f in flags if f.get('status') == 'needs_documentation']

            if active_flags:
                print(f"\n🚩 Active Flags: {len(active_flags)} undocumented change sets")
                for flag in active_flags[-3:]:  # Show last 3
                    print(f"  {flag['timestamp']}: {len(flag['undocumented_files'])} files")

        print("\n" + "="*60 + "\n")

    def show_diff(self):
        """Show detailed file-level changes."""
        changed, changes = self.check_changes()

        if not changed:
            return

        print("\n" + "="*60)
        print("Detailed Changes")
        print("="*60)

        if changes.get('added'):
            print(f"\n➕ Added ({len(changes['added'])} files):")
            for path in changes['added']:
                print(f"   + {path}")

        if changes.get('modified'):
            print(f"\n✏️  Modified ({len(changes['modified'])} files):")
            for path in changes['modified']:
                print(f"   ~ {path}")

        if changes.get('removed'):
            print(f"\n➖ Removed ({len(changes['removed'])} files):")
            for path in changes['removed']:
                print(f"   - {path}")

        print("\n" + "="*60 + "\n")

    def clear_flags(self):
        """Clear all undocumented change flags."""
        if self.flags_file.exists():
            os.remove(self.flags_file)
            print("✓ All flags cleared")
        else:
            print("No flags to clear")

    def update_claude_md(self):
        """Update CLAUDE.md with tracking checklist."""
        claude_md_path = Path("/Users/tem/humanizer-agent/CLAUDE.md")

        if not claude_md_path.exists():
            print(f"⚠️  CLAUDE.md not found at {claude_md_path}")
            return

        with open(claude_md_path, 'r') as f:
            content = f.read()

        # Check if tracking section already exists
        if "## 🔔 ACTIVATION CHECKLIST" in content:
            print("✓ CLAUDE.md already has activation checklist")
            return

        # Add checklist at the top (after title)
        checklist = """
## 🔔 ACTIVATION CHECKLIST - Run on Every New Claude Code Session

**MANDATORY STARTUP SEQUENCE:**

1. **Check Codebase Changes**
   ```bash
   cd /Users/tem/humanizer_root
   ./codebase_tracker.py check
   ```
   - If changes detected, verify documentation

2. **Verify ChromaDB Notes**
   ```bash
   ./codebase_tracker.py verify-notes
   ```
   - Ensure all changes since last session are documented
   - If undocumented, create ChromaDB notes immediately

3. **Review Pinned Guide**
   ```
   Query ChromaDB: "pinned guide best practice"
   ```
   - Read the Claude Code Memory Best Practices guide
   - Follow query-before-code workflow

4. **Check Flags**
   ```bash
   ./codebase_tracker.py status
   ```
   - Review any active undocumented change flags
   - Document or clear as appropriate

5. **Query Production DB for Context**
   ```
   recall_memory "what we were working on"
   recall_memory "critical priority todos"
   recall_memory "files need refactoring"
   ```

6. **Take New Snapshot** (after significant work)
   ```bash
   ./codebase_tracker.py snapshot
   ```

---
"""

        # Insert after first heading
        lines = content.split('\n')
        insert_pos = 1  # After "# CLAUDE.md"

        for i, line in enumerate(lines):
            if line.startswith('# ') and i > 0:
                insert_pos = i
                break

        lines.insert(insert_pos, checklist)
        new_content = '\n'.join(lines)

        with open(claude_md_path, 'w') as f:
            f.write(new_content)

        print(f"✓ Updated {claude_md_path} with activation checklist")


def main():
    """Main CLI interface."""
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1]
    tracker = CodebaseTracker()

    if command == "snapshot":
        note = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else None
        tracker.take_snapshot(note)

    elif command == "check":
        changed, changes = tracker.check_changes()
        if changed:
            print("\n💡 Run 'verify-notes' to check documentation status")

    elif command == "verify-notes":
        changed, changes = tracker.check_changes()
        if changed:
            undocumented = tracker.verify_chromadb_notes(changes)
            if undocumented:
                tracker.flag_undocumented(undocumented, changes)

    elif command == "status":
        tracker.show_status()

    elif command == "diff":
        tracker.show_diff()

    elif command == "clear-flags":
        tracker.clear_flags()

    elif command == "update-claude-md":
        tracker.update_claude_md()

    else:
        print(f"Unknown command: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
