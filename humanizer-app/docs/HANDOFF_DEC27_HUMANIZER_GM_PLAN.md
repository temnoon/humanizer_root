# Humanizer GM - Golden Master Consolidation Plan

**Date**: December 27, 2025
**Status**: APPROVED - Ready for Execution
**Next Session**: Create repo + Phase 1 Migration

---

## Executive Summary

We are creating a new clean GitHub repository **"humanizer-gm"** (Golden Master) that consolidates the essential code from multiple repos while discarding experimental/deprecated code. The result is a single Electron app with embedded archive server.

---

## Session Accomplishments (Dec 27)

### Completed This Session

1. **Electron IPC Bridge** - Full agent council IPC wiring
   - `electron/preload.ts` - AgentAPI with 12 methods
   - `electron/main.ts` - IPC handlers + orchestrator init
   - `apps/web/src/lib/aui/agent-bridge.ts` - Real IPC connection

2. **Workflow Tools** - 2 new AUI tools (43 total)
   - `discover_threads` - AI clustering of passages
   - `start_book_workflow` - Guided orchestration

3. **Security Audit Fixes** (House Council approved)
   - SECURITY: `ALLOWED_AUI_TOOLS` whitelist (43 tools)
   - MATH: Real Jaccard similarity calculation
   - DATA: `ThreadPassage`, `DiscoveredThread` types

4. **AGENT.md** - Updated capability registry with new systems

5. **Architecture Discovery** - Mapped current state:
   - humanizer-app depends on narrative-studio/archive-server.js
   - 15+ files with hardcoded localhost:3002
   - Two Electron installs (wasteful)

---

## The Plan: Humanizer GM

### Source Repos

| Repo | Role | Keep/Discard |
|------|------|--------------|
| humanizer-app | Foundation | KEEP (base) |
| narrative-studio | Archive server + services | MIGRATE essential |
| humanizer-portal | Reference AUI | DISCARD (already in humanizer-app) |
| workers/ | Cloud APIs | KEEP npe-api, gptzero-api |
| humanizer_mcp | Python MCP | SEPARATE repo |

### Target Structure

```
humanizer-gm/
├── .github/workflows/
├── .claude/
│   └── agents/              # House agent definitions
├── apps/
│   └── web/                 # React frontend (from humanizer-app)
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── agents/              # Agent Council (from humanizer-app)
│   │   ├── council/
│   │   ├── houses/
│   │   ├── bus/
│   │   ├── runtime/
│   │   └── tasks/
│   ├── archive-server/      # EMBEDDED (from narrative-studio)
│   │   ├── server.ts        # Converted from archive-server.js
│   │   └── services/
│   │       ├── embeddings/  # SQLite + vec0
│   │       ├── facebook/    # Archive parsers
│   │       └── parser/      # Import parsers
│   ├── chat/
│   ├── queue/
│   └── vision/
├── packages/
│   ├── core/                # Shared types (@humanizer/core)
│   └── ui/                  # Shared styles (@humanizer/ui)
├── workers/
│   ├── npe-api/
│   ├── gptzero-api/
│   └── shared/
├── docs/
│   ├── CLAUDE.md
│   ├── AGENT.md
│   └── ARCHITECTURE.md
├── electron-builder.json
├── package.json
├── turbo.json
└── tsconfig.json
```

---

## Migration Phases

### Phase 1: Foundation (Next Session)

**Goal**: Create new repo with clean structure from humanizer-app

```bash
# 1. Create new GitHub repo
gh repo create humanizer-gm --public --description "Humanizer Desktop - Golden Master"

# 2. Clone and set up
git clone https://github.com/YOUR_USERNAME/humanizer-gm.git
cd humanizer-gm

# 3. Copy foundation from humanizer-app
cp -r humanizer-app/apps .
cp -r humanizer-app/packages .
cp -r humanizer-app/electron .
cp humanizer-app/package.json .
cp humanizer-app/turbo.json .
cp humanizer-app/tsconfig.json .
cp humanizer-app/electron-builder.json .

# 4. Copy docs
mkdir docs
cp humanizer-app/docs/CLAUDE.md docs/
cp AGENT.md docs/

# 5. Set up .claude/agents/
mkdir -p .claude/agents
cp .claude/agents/*.md .claude/agents/
```

**House Review**: Architect Agent verifies no parallel implementations

### Phase 2: Archive Server Migration (Session 2-3)

**Goal**: Convert archive-server.js to TypeScript, embed in electron/

1. Create `electron/archive-server/` structure
2. Convert `archive-server.js` (5,561 lines) to TypeScript
3. Migrate `src/services/embeddings/` (5,233 lines)
4. Migrate `src/services/facebook/` (exclude test-*.ts)
5. Migrate `src/services/parser/`
6. Update imports to use `@humanizer/core` types

**House Review**:
- Data Agent: Type compatibility
- Security Agent: API security
- Math Agent: Embeddings math integrity

### Phase 3: Workers Migration (Session 4)

**Goal**: Copy production workers

1. Copy `workers/npe-api/`
2. Copy `workers/gptzero-api/`
3. Copy `workers/shared/`
4. Update wrangler configs
5. Remove post-social references

**House Review**: Security Agent for API keys/secrets

### Phase 4: Cleanup & Testing (Session 5)

**Goal**: Verify everything works

1. `npm install` at root
2. `npm run build` all packages
3. `npm run electron:dev` - verify app runs
4. Test archive browsing
5. Test embeddings search
6. Test AUI tools

**House Review**: Full Council audit

---

## What Gets Migrated

### From humanizer-app (Foundation)

| Path | Lines | Status |
|------|-------|--------|
| `electron/main.ts` | 785 | COPY |
| `electron/preload.ts` | 519 | COPY |
| `electron/agents/` | ~3,000 | COPY |
| `electron/chat/` | ~500 | COPY |
| `electron/queue/` | ~400 | COPY |
| `electron/vision/` | ~450 | COPY |
| `apps/web/` | ~50,000 | COPY |
| `packages/core/` | ~5,000 | COPY |
| `packages/ui/` | ~2,000 | COPY |

### From narrative-studio (Archive Server)

| Path | Lines | Status |
|------|-------|--------|
| `archive-server.js` | 5,561 | CONVERT to TS |
| `src/services/embeddings/EmbeddingDatabase.ts` | 3,361 | MIGRATE |
| `src/services/embeddings/ClusteringService.ts` | 483 | MIGRATE |
| `src/services/embeddings/ArchiveIndexer.ts` | 443 | MIGRATE |
| `src/services/embeddings/*.ts` (others) | ~950 | MIGRATE |
| `src/services/facebook/*.ts` (no test-*) | ~5,000 | MIGRATE |
| `src/services/parser/*.ts` | ~2,500 | MIGRATE |

### From workers/

| Path | Status |
|------|--------|
| `npe-api/` | COPY |
| `gptzero-api/` | COPY |
| `shared/` | COPY |

---

## What Gets Discarded

### From narrative-studio

| Path | Lines | Reason |
|------|-------|--------|
| `scripts/*.ts` | ~15,000 | Research experiments |
| `data/*.json` | - | Research artifacts |
| `src/components/` | ~8,000 | Old UI (replaced) |
| `src/contexts/` | ~2,000 | Old contexts |
| `src/services/detection/` | ~3,000 | Experimental |
| `test-*.ts` files | ~2,500 | Ad-hoc tests |

### From workers/

| Path | Reason |
|------|--------|
| `post-social-api/` | Experimental |
| `post-social-frontend/` | Experimental |
| `post-social-ui/` | Reference only |

### Entire repos

| Repo | Reason |
|------|--------|
| humanizer-portal | Already integrated in humanizer-app |

---

## Key Decisions Made

1. **Archive Server**: Embed as TypeScript module in `electron/archive-server/`
2. **Single Electron**: No more spawning external processes
3. **Type Unity**: All services import from `@humanizer/core`
4. **House Agents**: Keep for ongoing code review
5. **Python MCP**: Separate repo (different stack)

---

## Files to Reference

When starting next session, read these first:

1. **This handoff**: `docs/HANDOFF_DEC27_HUMANIZER_GM_PLAN.md`
2. **Architecture context**: `docs/PHILOSOPHY_STATE_DEC25.md`
3. **Agent definitions**: `AGENT.md`
4. **Archive server**: `narrative-studio/archive-server.js`
5. **Embeddings**: `narrative-studio/src/services/embeddings/EmbeddingDatabase.ts`

---

## Commands to Start Next Session

```bash
# Verify current state
cd /Users/tem/humanizer_root
ls -la  # Should see: humanizer-app, narrative-studio, workers, etc.

# Check GitHub CLI is authenticated
gh auth status

# Read this handoff
cat humanizer-app/docs/HANDOFF_DEC27_HUMANIZER_GM_PLAN.md
```

---

## Success Criteria

Phase 1 is complete when:
- [ ] New `humanizer-gm` repo exists on GitHub
- [ ] Foundation copied (electron/, apps/, packages/)
- [ ] `npm install` succeeds
- [ ] `npm run build:electron` succeeds
- [ ] Architect Agent approves structure

Full migration is complete when:
- [ ] Single `npm run electron:dev` starts everything
- [ ] No references to `localhost:3002` (embedded server)
- [ ] No references to `narrative-studio/`
- [ ] All 43 AUI tools work
- [ ] Archive browsing works
- [ ] Embeddings search works
- [ ] House Council gives final approval

---

## Estimated Effort

| Phase | Sessions | Focus |
|-------|----------|-------|
| Phase 1 | 1 | Foundation + repo setup |
| Phase 2 | 2-3 | Archive server conversion |
| Phase 3 | 1 | Workers migration |
| Phase 4 | 1 | Testing + cleanup |
| **Total** | **5-6 sessions** | |

---

## ChromaDB Memory ID

Store this handoff with tags: `handoff,humanizer-gm,golden-master,migration,dec27`

---

**End of Handoff**
