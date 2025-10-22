# ChromaDB Infrastructure - Complete Overhaul Plan

**Date**: October 17, 2025
**Status**: Planning Phase
**Priority**: CRITICAL - Context Continuity Infrastructure
**Estimated Time**: 2-3 hours
**Risk Level**: Medium (data migration involved)

---

## 🎯 Executive Summary

ChromaDB is the heart of our context continuity system. Currently it's misconfigured with:
- Hardcoded "test_db" (should be configurable)
- 684 memories in wrong database (archive + production mixed)
- Production DB exists but unused (only 10 items)
- No clear separation between historical and active content

**Goal**: Establish ChromaDB as robust, well-organized documentation and context continuity driver.

---

## 📊 Current State Assessment

### Databases Discovered

| Database | Location | Size | Items | Status | Purpose |
|----------|----------|------|-------|--------|---------|
| **chroma_test_db** | `/archive/mcp-memory/mcp-memory-service/` | 19M | 684 | ✅ ACTIVE | Hardcoded, mixed content |
| **chroma_production_db** | `/archive/mcp-memory/mcp-memory-service/` | 2.0M | 10 | ❌ UNUSED | Created but not configured |
| **chroma_meta_db** | `/archive/mcp-memory/mcp-memory-service/` | 1.8M | ? | ❓ UNKNOWN | Purpose unclear |
| **chroma_db** | `~/Library/Application Support/mcp-memory/` | 3.3M | ? | ❌ ORPHAN | Not connected to MCP |

### Problems Identified

1. **Hardcoded Database**: `start_memory_service.py:13` hardcodes `chroma_test_db`
2. **Mixed Content**: Old notes (humanizer-agent, LaTeX, archives) + new notes (humanizer_root) in one DB
3. **Lost Context**: Transition from `~/humanizer-agent/` to `~/humanizer_root/` not tracked properly
4. **No Segmentation**: Can't separate historical techniques from active development
5. **Orphaned Databases**: Unknown purpose databases wasting disk space

### What Went Right

- ✅ 684 memories preserved (nothing lost)
- ✅ Today's session tracking implementation works
- ✅ Memory agent architecture ready for multi-DB
- ✅ MCP server functional (just misconfigured)

---

## 🏗️ Target Architecture

### Database Structure

```
/Users/tem/archive/mcp-memory/mcp-memory-service/
├── chroma_production_db/          ← Active development (humanizer_root)
│   ├── memory_collection/         ← Current project notes
│   └── session-summaries/         ← Timestamped session tracking
│
├── chroma_archive_db/             ← Historical reference (humanizer-agent era)
│   ├── memory_collection/         ← Old techniques, learnings
│   └── project-specific/          ← LaTeX, archives, image handling, etc.
│
├── chroma_experiments_db/         ← Testing & experiments (optional)
│   └── memory_collection/         ← Sandbox for trying new features
│
└── backups/                       ← Daily snapshots
    ├── production_YYYYMMDD/
    ├── archive_YYYYMMDD/
    └── migration_backup_YYYYMMDD/
```

### Database Purposes

| Database | Purpose | Write Access | Query Frequency | Retention |
|----------|---------|--------------|-----------------|-----------|
| **production_db** | Active humanizer_root development | ✅ Yes | Very High | Indefinite |
| **archive_db** | Historical reference, old techniques | ❌ Read-only | Medium | Indefinite |
| **experiments_db** | Testing new features | ✅ Yes | Low | Pruned quarterly |

### Configurable Selection

**Environment Variable**: `MCP_MEMORY_DB_NAME`
- Default: `chroma_production_db`
- Override via `~/.claude.json`
- Logged at startup for verification

**Multi-Database Queries**:
- Memory agent can search across databases
- Specify target: `production`, `archive`, `both`, `all`
- Default: `production` only (fast, relevant)

---

## 📋 Implementation Plan - 7 Phases

### Phase 0: Backup Everything (CRITICAL - Do First)

**Duration**: 5 minutes
**Risk**: None (read-only)

**Actions**:
1. Create timestamped backup of all databases
2. Verify backup integrity
3. Document backup location
4. Create rollback script

**Commands**:
```bash
cd /Users/tem/archive/mcp-memory/mcp-memory-service
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups/migration_backup_${BACKUP_DATE}
cp -r chroma_test_db backups/migration_backup_${BACKUP_DATE}/
cp -r chroma_production_db backups/migration_backup_${BACKUP_DATE}/
cp -r chroma_meta_db backups/migration_backup_${BACKUP_DATE}/
tar -czf backups/migration_backup_${BACKUP_DATE}.tar.gz backups/migration_backup_${BACKUP_DATE}/
ls -lh backups/migration_backup_${BACKUP_DATE}.tar.gz
```

**Verification**:
- [ ] Backup size ~25M (19M + 2M + 1.8M + overhead)
- [ ] All 3 databases copied
- [ ] Tarball created successfully
- [ ] Can list contents: `tar -tzf backups/migration_backup_${BACKUP_DATE}.tar.gz | head`

**Rollback**: Keep original databases untouched until Phase 6 complete

---

### Phase 1: Inspect & Categorize Existing Memories

**Duration**: 15 minutes
**Risk**: None (read-only)

**Objective**: Understand what's in test_db and categorize for migration

**Actions**:
1. Export all 684 memories from test_db with metadata
2. Analyze by date, tags, project
3. Identify cutoff date for migration (humanizer-agent → humanizer_root transition)
4. Create categorization report

**Script**: `scripts/analyze_memories.py`

**Analysis Goals**:
- How many memories from humanizer-agent era?
- How many from humanizer_root era?
- What's the date of transition? (likely Sept-Oct 2025)
- Any orphaned/uncategorized memories?
- Tag distribution (which projects represented)

**Deliverable**: `MEMORY_ANALYSIS_REPORT.md`
- Memory count by date range
- Tag frequency analysis
- Recommended migration cutoff date
- List of memories to migrate vs archive

**Verification**:
- [ ] All 684 memories exported
- [ ] Clear date ranges identified
- [ ] Transition point found (~Sept 2025?)
- [ ] Migration list created

---

### Phase 2: Make Database Configurable

**Duration**: 10 minutes
**Risk**: Low (code change, but backward compatible)

**Objective**: Remove hardcoded database, enable runtime selection

**Files to Modify**:
1. `/Users/tem/archive/mcp-memory/mcp-memory-service/start_memory_service.py`
2. `~/.claude.json` (add env variable)

**Changes**:

**File 1**: `start_memory_service.py`
```python
# OLD (line 13):
os.environ["MCP_MEMORY_CHROMA_PATH"] = str(Path(__file__).parent / "chroma_test_db")

# NEW:
# Allow database selection via environment variable
# Default to production_db, fallback to test_db for backward compatibility during migration
DEFAULT_DB = os.environ.get("MCP_MEMORY_DEFAULT_DB", "chroma_production_db")
DB_NAME = os.environ.get("MCP_MEMORY_DB_NAME", DEFAULT_DB)

# Validate database exists
db_path = Path(__file__).parent / DB_NAME
if not db_path.exists():
    print(f"WARNING: Database '{DB_NAME}' not found at {db_path}", file=sys.stderr, flush=True)
    print(f"Falling back to chroma_test_db", file=sys.stderr, flush=True)
    DB_NAME = "chroma_test_db"
    db_path = Path(__file__).parent / DB_NAME

os.environ["MCP_MEMORY_CHROMA_PATH"] = str(db_path)

# Log configuration
print(f"=== ChromaDB Configuration ===", file=sys.stderr, flush=True)
print(f"Active Database: {DB_NAME}", file=sys.stderr, flush=True)
print(f"Database Path: {db_path}", file=sys.stderr, flush=True)
print(f"Collection: memory_collection", file=sys.stderr, flush=True)
print(f"=============================", file=sys.stderr, flush=True)
```

**File 2**: `~/.claude.json`
```json
{
  "mcpServers": {
    "chromadb-memory": {
      "command": "bash",
      "args": ["/Users/tem/archive/mcp-memory/wrapper.sh"],
      "env": {
        "MCP_MEMORY_DB_NAME": "chroma_production_db",
        "MCP_MEMORY_DEFAULT_DB": "chroma_production_db"
      }
    }
  }
}
```

**Verification**:
- [ ] Code changes made
- [ ] No syntax errors: `python3 -m py_compile start_memory_service.py`
- [ ] Test with test_db: `MCP_MEMORY_DB_NAME=chroma_test_db ./start_memory_service.py`
- [ ] Logs show correct database name
- [ ] Fallback works if DB doesn't exist

---

### Phase 3: Rename & Reorganize Databases

**Duration**: 5 minutes
**Risk**: Low (files already backed up)

**Objective**: Clear naming that reflects purpose

**Actions**:
```bash
cd /Users/tem/archive/mcp-memory/mcp-memory-service

# Rename test_db to archive_db (will hold old notes)
mv chroma_test_db chroma_archive_db

# Production_db stays as is (will receive migrated notes)
# (currently has 10 items - we'll inspect these first)

# Investigate meta_db
# (determine purpose, likely can delete or archive)

# Delete orphaned Library/Application Support DB
# (after verifying it's not in use)
```

**Verification**:
- [ ] chroma_archive_db exists (was test_db)
- [ ] chroma_production_db unchanged
- [ ] No processes using renamed databases
- [ ] Backup still intact

---

### Phase 4: Create Migration & Management Scripts

**Duration**: 30 minutes
**Risk**: None (tools for later use)

**Objective**: Robust tooling for database operations

**Scripts to Create**:

#### 1. `scripts/migrate_memories.py`
**Purpose**: Move memories between databases with filtering

**Features**:
- Date-based filtering (e.g., "after 2025-09-01")
- Tag-based filtering (e.g., "humanizer_root" tagged only)
- Dry-run mode (show what would be migrated)
- Deduplication (check for existing memories)
- Progress reporting
- Verification after migration

**Usage**:
```bash
# Dry run - see what would migrate
python3 scripts/migrate_memories.py \
  --source chroma_archive_db \
  --target chroma_production_db \
  --after-date 2025-09-01 \
  --dry-run

# Actual migration
python3 scripts/migrate_memories.py \
  --source chroma_archive_db \
  --target chroma_production_db \
  --after-date 2025-09-01 \
  --confirm
```

#### 2. `scripts/query_database.py`
**Purpose**: Search across databases from command line

**Features**:
- Multi-database search
- Filter by tags, date, content
- Export to JSON/Markdown
- Summary statistics

**Usage**:
```bash
# Search production only
python3 scripts/query_database.py --db production --query "tabs implementation"

# Search across both
python3 scripts/query_database.py --db both --query "MCP permissions"

# Get all session summaries
python3 scripts/query_database.py --db production --tags session-summary
```

#### 3. `scripts/backup_database.py`
**Purpose**: Create timestamped backups

**Features**:
- Compress backups
- Verify integrity
- Automatic old backup cleanup (keep last 30 days)
- Backup to multiple locations (local + remote if configured)

**Usage**:
```bash
# Backup production
python3 scripts/backup_database.py --db production

# Backup all
python3 scripts/backup_database.py --db all
```

#### 4. `scripts/inspect_database.py`
**Purpose**: Health check and statistics

**Features**:
- Memory count
- Collection info
- Tag distribution
- Date range coverage
- Duplicate detection
- Orphaned memories
- Disk usage

**Usage**:
```bash
python3 scripts/inspect_database.py --db production
python3 scripts/inspect_database.py --db all --report
```

#### 5. `scripts/cleanup_duplicates.py`
**Purpose**: Find and remove duplicate memories

**Features**:
- Content-based deduplication
- Hash-based detection
- Safe removal (keep newest)
- Dry-run mode

**Verification**:
- [ ] All scripts created
- [ ] No syntax errors
- [ ] Help text works: `python3 scripts/migrate_memories.py --help`
- [ ] Dry-run modes functional

---

### Phase 5: Migrate Recent Memories to Production

**Duration**: 20 minutes
**Risk**: Medium (data migration - relies on backups)

**Objective**: Move humanizer_root era memories to production_db

**Pre-Migration Checks**:
1. Verify backups exist
2. Inspect production_db's current 10 items (what are they?)
3. Determine migration cutoff date (from Phase 1 analysis)
4. Run migration in dry-run mode
5. Review what will be migrated

**Migration Strategy**:

**Option A: Date-based** (if clear cutoff exists)
```bash
# Migrate all memories after Sept 1, 2025
python3 scripts/migrate_memories.py \
  --source chroma_archive_db \
  --target chroma_production_db \
  --after-date 2025-09-01 \
  --confirm
```

**Option B: Tag-based** (if tagged consistently)
```bash
# Migrate memories tagged with humanizer_root
python3 scripts/migrate_memories.py \
  --source chroma_archive_db \
  --target chroma_production_db \
  --include-tags "humanizer_root,oct17,oct16,oct15" \
  --confirm
```

**Option C: Hybrid** (most likely)
```bash
# Date + tag filtering
python3 scripts/migrate_memories.py \
  --source chroma_archive_db \
  --target chroma_production_db \
  --after-date 2025-09-01 \
  --exclude-tags "humanizer-agent,old-project" \
  --confirm
```

**Expected Migration**:
- From archive: ~50-100 recent memories (estimate)
- To production: 10 existing + ~50-100 new = ~60-110 total
- Remaining in archive: ~574-634 historical memories

**Post-Migration Verification**:
- [ ] Production DB memory count increased
- [ ] No duplicates created
- [ ] All recent session summaries present
- [ ] Query test: `query_database.py --db production --query "tabs system"`
- [ ] Archive DB still intact
- [ ] Today's session summary found in production

---

### Phase 6: Update Memory Agent for Multi-Database

**Duration**: 30 minutes
**Risk**: Low (additive changes)

**Objective**: Memory agent can search across databases intelligently

**Changes to** `.claude/agents/memory-agent.md`:

**Add Database Selection Section**:
```markdown
## 🗄️ Database Selection

You have access to multiple ChromaDB databases:

### Available Databases

1. **production** (`chroma_production_db`)
   - Active humanizer_root development
   - Recent session summaries (Sept 2025 - present)
   - Current architecture decisions
   - In-progress work

2. **archive** (`chroma_archive_db`)
   - Historical techniques and learnings
   - humanizer-agent era notes
   - Old project implementations (LaTeX, archives, image handling)
   - Read-only reference

3. **both** (production + archive)
   - Comprehensive search
   - Use when topic may span both eras

### Default Behavior

**For session start briefing (Task 0)**:
- Search **production only** (fast, relevant)
- Look back 24-48 hours
- Recent session summaries only

**For research queries (Task 1)**:
- Default to **production**
- If no results or explicitly requested, search **both**
- Indicate which database results came from

**For session summaries (Task 2)**:
- Store in **production only**
- Check production for related memories
- Archive is read-only

### How to Specify Database

Main agent can request specific database:
```
Launch memory-agent and search [production|archive|both] for [topic]
```

If not specified, use intelligent defaults:
- Session briefing → production
- Recent work → production
- Historical techniques → both
- Old projects → archive
```

**Implementation** (if memory agent needs direct DB access):

This might require extending the MCP server to support database parameter in tool calls, OR the memory agent can make multiple queries with different DB configurations.

**Simpler approach**: Memory agent uses existing tools, but main agent can switch DB via environment variable restart (more complex workflow).

**Recommended**: Keep single database per session, use migration to ensure production has recent content. Archive search is manual when needed.

**Alternative**: Create separate MCP server instance for archive database (read-only).

**Verification**:
- [ ] Memory agent understands database distinction
- [ ] Session briefings query production
- [ ] Research can query both when needed
- [ ] Storage always goes to production

---

### Phase 7: Testing, Documentation & Rollout

**Duration**: 30 minutes
**Risk**: None (verification only)

**Objective**: Ensure everything works, document procedures

**Testing Checklist**:

1. **Basic Operations**:
   - [ ] Store memory in production DB
   - [ ] Retrieve memory from production DB
   - [ ] Search by tags works
   - [ ] Recall memory works
   - [ ] Session summary storage works with timestamp

2. **Database Selection**:
   - [ ] MCP server starts with production DB
   - [ ] Logs show correct database name
   - [ ] Check_database_health shows correct count
   - [ ] Can manually switch to archive (change env var, restart)

3. **Memory Agent**:
   - [ ] Session start briefing works (production DB)
   - [ ] Finds recent session summaries
   - [ ] Research queries work
   - [ ] Storage workflow (main drafts, agent stores) works

4. **Scripts**:
   - [ ] Can query production: `query_database.py --db production --query "test"`
   - [ ] Can inspect: `inspect_database.py --db production`
   - [ ] Can backup: `backup_database.py --db production`
   - [ ] Migration script works (if need to re-run)

5. **Rollback Test**:
   - [ ] Know how to restore from backup if needed
   - [ ] Documented rollback procedure

**Documentation to Create**:

1. **CHROMADB_ARCHITECTURE.md**:
   - Database structure explanation
   - When to use which database
   - Migration history
   - Maintenance procedures

2. **CHROMADB_OPERATIONS.md**:
   - How to backup databases
   - How to query from command line
   - How to migrate memories
   - How to switch databases
   - Troubleshooting common issues

3. **Update CLAUDE.md**:
   - Add ChromaDB section
   - Database architecture overview
   - Link to detailed docs
   - Session start protocol (already there) confirmation

4. **Scripts README**:
   - `/Users/tem/archive/mcp-memory/mcp-memory-service/scripts/README.md`
   - Usage examples for all scripts
   - Common workflows

**Final Verification**:
- [ ] Store this session summary via memory agent
- [ ] Verify it goes to production DB
- [ ] Next session start briefing should find it
- [ ] Archive DB remains read-only and accessible
- [ ] All documentation complete
- [ ] CLAUDE.md updated with ChromaDB architecture

---

## 🚨 Rollback Procedures

If anything goes wrong during migration:

### Full Rollback (Nuclear Option)
```bash
cd /Users/tem/archive/mcp-memory/mcp-memory-service
# Stop MCP server first!
rm -rf chroma_archive_db chroma_production_db chroma_meta_db
tar -xzf backups/migration_backup_YYYYMMDD_HHMMSS.tar.gz
cp -r backups/migration_backup_YYYYMMDD_HHMMSS/* .
# Restart MCP server
```

### Partial Rollback (Production DB Only)
```bash
cd /Users/tem/archive/mcp-memory/mcp-memory-service
rm -rf chroma_production_db
cp -r backups/migration_backup_YYYYMMDD_HHMMSS/chroma_production_db .
```

### Undo Migration
```bash
# If migration added unwanted memories
python3 scripts/rollback_migration.py \
  --db chroma_production_db \
  --backup backups/migration_backup_YYYYMMDD_HHMMSS/chroma_production_db
```

---

## 📊 Success Metrics

After completion, we should have:

1. **Clear Segmentation**:
   - ✅ Production DB: ~60-110 recent memories (humanizer_root era)
   - ✅ Archive DB: ~574-634 historical memories (read-only reference)
   - ✅ No hardcoded databases
   - ✅ Configurable via environment variable

2. **Working Systems**:
   - ✅ Session start briefing queries production
   - ✅ New session summaries stored in production with timestamps
   - ✅ Memory agent understands database structure
   - ✅ Archive searchable when needed

3. **Operational Excellence**:
   - ✅ Daily backup script (cron job?)
   - ✅ Database health monitoring
   - ✅ Clear migration path if needed again
   - ✅ Documentation complete

4. **Context Continuity**:
   - ✅ No lost memories (all 684 preserved)
   - ✅ Recent work easily accessible (production)
   - ✅ Historical techniques available (archive)
   - ✅ Next session starts with full context

---

## 🎯 Expected Timeline

| Phase | Duration | Dependencies | Can Parallelize? |
|-------|----------|--------------|------------------|
| 0. Backup | 5 min | None | No (do first!) |
| 1. Inspect | 15 min | Phase 0 | No |
| 2. Configure | 10 min | None | Yes (with Phase 1) |
| 3. Rename | 5 min | Phase 0, 1 | No |
| 4. Scripts | 30 min | None | Yes (while migrating) |
| 5. Migrate | 20 min | Phase 1, 2, 3, 4 | No |
| 6. Memory Agent | 30 min | Phase 5 | Partial |
| 7. Testing | 30 min | All previous | No |

**Total Sequential**: ~2 hours 25 minutes
**With Parallelization**: ~1 hour 45 minutes
**With Unexpected Issues**: 2-3 hours (buffer)

---

## 🔧 Maintenance Procedures (Post-Deployment)

### Daily (Automated)
- Backup production DB (cron job)
- Health check (memory count, no errors)

### Weekly
- Review new memories (quality check)
- Tag consistency audit
- Disk space check

### Monthly
- Archive old completed work (if needed)
- Cleanup duplicates
- Update documentation

### Quarterly
- Full database audit
- Performance optimization
- Backup verification (restore test)

---

## 💡 Future Enhancements

After this migration is stable:

1. **Read-Only Archive Access**: Separate MCP server instance for archive
2. **Cross-Database Search**: Memory agent enhancement
3. **Auto-Archival**: Automatically move old memories from production to archive
4. **Backup to Remote**: S3 or similar for disaster recovery
5. **Database Versioning**: Track schema changes over time
6. **Performance Monitoring**: Query time, memory usage, etc.

---

## 🎓 Lessons Learned (Pre-Mortem)

**What could go wrong**:
1. Migration script has bugs → Use dry-run extensively
2. Lose data during migration → Comprehensive backups first
3. Database corruption → Validate before deleting originals
4. Memory agent confused → Clear documentation and testing
5. Can't find recent notes → Careful cutoff date selection

**Mitigations**:
- Extensive backups before any changes
- Dry-run mode for all destructive operations
- Verification steps after each phase
- Keep originals until Phase 7 complete
- Document everything as we go

---

## ✅ Ready to Execute

This plan transforms ChromaDB from "accidentally working" to "mission-critical infrastructure."

**Key Principles**:
1. **Safety First**: Backups before everything
2. **Incremental Progress**: Verify each phase before next
3. **Reversibility**: Can rollback at any point
4. **Documentation**: Record all decisions and procedures
5. **Testing**: Verify before declaring complete

**Next Step**:
User approval, then execute Phase 0 (backup) immediately.

---

**End of Plan**
