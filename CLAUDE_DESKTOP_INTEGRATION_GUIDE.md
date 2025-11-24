# Claude Desktop Integration Guide - ChromaDB Navigation & Best Practices

**Version**: 1.0
**Date**: November 23, 2025
**Database**: ChromaDB Production (359 memories, 18.6 MB)
**Purpose**: Enable Claude Desktop to efficiently integrate side projects with existing Humanizer ecosystem

---

## 🎯 Quick Start Protocol

### Step 1: Understand Your Environment
```bash
# Always check these first:
1. Current working directory
2. Git branch (if applicable)
3. Which project you're in (humanizer vs narrative-studio vs cloud-workbench)
4. Available MCP servers (humanizer, chromadb-memory, chrome-devtools)
```

### Step 2: Query ChromaDB for Context
```typescript
// Use these search patterns to get oriented:

// 1. For architectural overview:
mcp__chromadb-memory__search_by_tag(["architecture", "overview"])

// 2. For specific component:
mcp__chromadb-memory__retrieve_memory("query about [component]")

// 3. For recent session context:
mcp__chromadb-memory__recall_memory("last session about [topic]")

// 4. For configuration details:
mcp__chromadb-memory__search_by_tag(["configuration", "[project-name]"])
```

### Step 3: Verify - NO MOCK DATA
Before implementing anything:
1. ✅ Check if real data sources exist
2. ✅ Verify API endpoints are live
3. ✅ Confirm database connections work
4. ❌ NEVER create mock data without explicit warning
5. ❌ NEVER stub functions without marking them clearly

---

## 📊 Project Namespace Map

### Project 1: **humanizer** (`/Users/tem/humanizer_root/`)
**Purpose**: Core transformation engine with TRM (Transformation via Reading Measurement)
**Active Branch**: Usually `main` (check git status)
**Key Components**:
- `humanizer/core/trm/` - Stateless transformation core (density.py, povm.py, verification.py)
- `humanizer/adapters/storage/` - Pluggable storage (postgres, sqlite, ephemeral)
- `humanizer/services/` - Business logic (reading, transformation_engine, embeddings)
- `humanizer/api/` - FastAPI endpoints
- `humanizer_mcp/` - MCP server for reading tools

**Environment**:
- Backend: http://localhost:8000 (FastAPI)
- Database: PostgreSQL with pgvector
- LLM: Ollama (localhost:11434) - Llama 3.1 8B, Mistral 7B
- Embeddings: sentence-transformers (all-MiniLM-L6-v2, 384 dim)

**Configuration Files**:
- `humanizer/config.py` - All settings (NO hard-coded values!)
- `pyproject.toml` - Dependencies via poetry
- `.env` - Secrets (ANTHROPIC_API_KEY, etc.)

**Tags to Search**: `trm`, `quantum-reading`, `density-matrix`, `povm`, `transformation-engine`, `humanizer`

---

### Project 2: **narrative-studio** (`/Users/tem/humanizer_root/narrative-studio/`)
**Purpose**: Frontend UI for archive browsing + session management
**Active Branch**: `feature/archive-import-parser` (current), `feature/session-history-and-buffers` (recent)
**Key Components**:
- `src/components/archive/` - Archive browser, sessions, imports
- `src/components/workspace/` - MainWorkspace, BufferTabs, ViewModeToggle
- `src/services/` - API clients (archiveService, sessionStorage, transformationService)
- `src/contexts/` - React contexts (SessionContext, ProviderContext)
- `archive-server.js` - Node.js backend (port 3002) - MUST USE `npx tsx`

**Environment**:
- Frontend: http://localhost:5173 (Vite)
- Archive Server: http://localhost:3002 (Express + TypeScript via tsx)
- Archive Root: `/Users/tem/openai-export-parser/output_v13_final`
- Session Storage: `~/.humanizer/sessions/`
- Upload Directory: `/tmp/archive-uploads/`

**Configuration Files**:
- `src/config/storage-paths.ts` - Storage paths
- `src/config/view-modes.ts` - View mode constants
- `package.json` - Dependencies via npm/pnpm
- `tsconfig.json` - TypeScript config

**Tags to Search**: `narrative-studio`, `archive-parser`, `session-history`, `buffers`, `import-archive`

---

### Project 3: **cloud-workbench** (`/Users/tem/humanizer_root/cloud-workbench/`)
**Purpose**: Cloudflare Pages frontend for transformation UI
**Active Branch**: Usually `main` or `feature/npe-integration`
**Key Components**:
- `src/features/canvas/` - Canvas component for text editing
- `src/features/panels/` - Transformation panels (allegorical, round-trip, etc.)
- `src/core/context/` - React contexts (CanvasContext, AuthContext)
- `src/core/adapters/` - API adapters (local vs remote)

**Environment**:
- Frontend: http://localhost:3001 (Vite)
- Backend Options:
  - Local: http://localhost:8000 (FastAPI - humanizer)
  - Remote: https://api.humanizer.com (Cloudflare Workers)
- Deployment: Cloudflare Pages (https://996852cf.workbench-4ec.pages.dev)

**Configuration Files**:
- `.env` - API URLs, auth settings
- `package.json` - Dependencies
- `wrangler.toml` - Cloudflare config (if applicable)

**Tags to Search**: `workbench`, `m4`, `npe-integration`, `canvas-context`, `transformation-panels`

---

## 🏷️ Tag Taxonomy & Search Strategies

### Tier 1: Architecture & Design (Use for "How does X work?")
```
architecture      - System design, component relationships
core-shell        - Stateless core + adapters pattern
deployment-modes  - LOCAL, WEB_EPHEMERAL, API_SERVICE
phase-0, phase-1  - Implementation phases
```

### Tier 2: Component-Specific (Use for "Find code for X")
```
trm               - Transformation via Reading Measurement
quantum-reading   - Sentence-by-sentence POVM analysis
density-matrix    - ρ (rho) state representation
povm              - Positive Operator-Valued Measures
transformation-engine - Text transformation logic
storage-adapters  - Database abstraction layer
session-history   - Session management system
archive-parser    - Import OpenAI/Claude exports
buffers           - Multi-buffer workspace
```

### Tier 3: Technology & Integration (Use for "How to configure X")
```
mcp               - Model Context Protocol
mcp-server        - MCP server implementations
chromadb          - Vector database
ollama            - Local LLM integration
pgvector          - PostgreSQL vector search
cloudflare        - Workers, Pages, R2, D1
```

### Tier 4: Status & Progress (Use for "What's the current state?")
```
complete          - Finished features
phase1-complete   - Phase 1 done
phase2-ready      - Ready to start Phase 2
session-complete  - Session summary
production-ready  - Deployed and working
```

### Tier 5: Problem-Solving (Use for "How to fix X")
```
fix               - Bug fixes, solutions
workaround        - Temporary solutions
debugging         - Debug information
test-fixes        - Test suite repairs
resolved          - Issues resolved
```

---

## 🔍 Efficient Search Patterns

### Pattern 1: "I need to understand the overall architecture"
```typescript
// Start broad, then narrow:
search_by_tag(["architecture", "overview"])
// Then drill down:
search_by_tag(["architecture", "trm"])
// Or search by project:
search_by_tag(["architecture", "narrative-studio"])
```

### Pattern 2: "I'm building a feature similar to X"
```typescript
// Find implementation reference:
retrieve_memory("how does [similar feature] work")
// Find design decisions:
search_by_tag(["design-pattern", "[feature-type]"])
// Find test examples:
search_by_tag(["testing", "[feature-type]"])
```

### Pattern 3: "I need configuration for X"
```typescript
// Configuration search:
search_by_tag(["configuration", "[component]"])
// Environment setup:
search_by_tag(["environment", "[component]"])
// MCP setup:
search_by_tag(["mcp-config", "[server-name]"])
```

### Pattern 4: "What was done in the last session?"
```typescript
// Recent work:
recall_memory("last session")
// Specific session:
search_by_tag(["session-complete", "nov-2025"])
// Progress tracking:
search_by_tag(["phase-N-complete"])
```

### Pattern 5: "I hit an error with X"
```typescript
// Find known issues:
search_by_tag(["fix", "[component]"])
// Find workarounds:
search_by_tag(["workaround", "[issue-type]"])
// Find resolved issues:
search_by_tag(["resolved", "[component]"])
```

---

## 🚫 CRITICAL: Mock Data & Function Prohibition

### Rule 1: NEVER Create Mock Data Without Warning
**Bad**:
```typescript
// ❌ DON'T DO THIS
const mockConversations = [
  { id: '1', title: 'Example', messages: [...] }
];
```

**Good**:
```typescript
// ✅ IF you must mock (for testing only):
// ⚠️ WARNING: MOCK DATA - Replace with real API call
// ⚠️ TODO: Implement actual data fetching from /api/conversations
const mockConversations = [
  { id: '1', title: 'Example', messages: [...] }
];
// ⚠️ END MOCK DATA
```

### Rule 2: NEVER Stub Functions Without Clear Marking
**Bad**:
```typescript
// ❌ DON'T DO THIS
async function fetchData() {
  return { data: [] };
}
```

**Good**:
```typescript
// ✅ Clearly marked stub:
async function fetchData() {
  // 🚧 STUB IMPLEMENTATION - NOT PRODUCTION READY
  // TODO: Implement real API call to /api/conversations
  // See: /tmp/API_SPEC.md for endpoint details
  console.error('STUB: fetchData() not implemented');
  throw new Error('fetchData is a stub - implement before production');
}
```

### Rule 3: Use Technical Debt Subagent for Tracking
When you encounter or create any mock/stub code:

```typescript
// 1. Log it immediately:
mcp__chromadb-memory__store_memory({
  content: `Technical Debt: Mock data in ${filename}:${line}
  - Component: ${componentName}
  - Reason: ${why it's mocked}
  - TODO: Implement real ${what needs implementation}
  - Priority: ${high/medium/low}
  - Estimate: ${hours}`,
  metadata: {
    tags: "technical-debt,mock-data,${component}",
    type: "debt"
  }
});

// 2. Create clear warning in code:
// 🚨 TECHNICAL DEBT: [Brief description]
// Logged to ChromaDB: [timestamp]
// Priority: [high/medium/low]
// Estimate: [hours to fix]

// 3. If using debt-tracker subagent, call it:
Task(subagent_type="debt-tracker", prompt=`
  Audit ${filename} and track the following technical debt:
  - Mock data in ${function}
  - Priority: ${level}
  - Path to production: ${steps}
`);
```

---

## 🧪 Authenticity Audit Workflow

### Before Committing Code:
```typescript
// Run this mental checklist:
const authenticityChecklist = {
  dataSource: {
    ✅: "Uses real API endpoints",
    ❌: "Uses mock/hardcoded data"
  },
  functions: {
    ✅: "All functions implemented",
    ❌: "Contains stubs or TODOs"
  },
  configuration: {
    ✅: "Uses config files (no hard-coded values)",
    ❌: "Has magic numbers or hard-coded paths"
  },
  errorHandling: {
    ✅: "Proper try/catch with user-facing messages",
    ❌: "Silent failures or console.error only"
  },
  testing: {
    ✅: "Has unit tests",
    ❌: "Untested code"
  }
};

// If ANY ❌ exists:
// 1. Mark clearly with warnings
// 2. Log to technical debt
// 3. Create TODO item
// 4. Document in handoff
```

### Technical Debt Logging Pattern:
```typescript
// When you create/discover debt:
await logTechnicalDebt({
  file: __filename,
  line: __line,
  type: "mock-data" | "stub-function" | "hard-coded" | "missing-test",
  description: "Clear description of what's wrong",
  impact: "high" | "medium" | "low",
  blocksProduction: boolean,
  estimatedHours: number,
  dependencies: ["other tasks that must be done first"],
  proposedSolution: "How to fix it"
});
```

---

## 🔧 Environment Detection Patterns

### Always Check Environment First:
```typescript
// 1. Check which project you're in:
const cwd = process.cwd();
const isHumanizer = cwd.includes('/humanizer_root/humanizer');
const isNarrativeStudio = cwd.includes('/narrative-studio');
const isCloudWorkbench = cwd.includes('/cloud-workbench');

// 2. Check if running locally or deployed:
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
const isDevelopment = process.env.NODE_ENV === 'development';

// 3. Check available services:
const ollamaAvailable = await ping('http://localhost:11434');
const pgAvailable = await ping('postgresql://localhost:5432');
const archiveServerAvailable = await ping('http://localhost:3002');

// 4. Use appropriate backend:
const apiUrl = isLocal
  ? 'http://localhost:8000'  // Local FastAPI
  : 'https://api.humanizer.com';  // Production Workers
```

### Configuration Priority:
```
1. Environment variables (.env)
2. Config files (config.py, config/storage-paths.ts)
3. Runtime detection (check for file existence, ping services)
4. Graceful fallbacks (ephemeral storage if DB unavailable)
5. NEVER hard-code paths or URLs
```

---

## 📚 Common Integration Scenarios

### Scenario 1: "I'm building a new transformation panel"
```typescript
// 1. Search for existing patterns:
search_by_tag(["transformation-panels", "architecture"])

// 2. Check Canvas integration:
retrieve_memory("how does CanvasContext work")

// 3. Find API endpoints:
search_by_tag(["api", "transformations"])

// 4. Get config values:
search_by_tag(["configuration", "transformation"])

// 5. Follow the pattern:
// - Read from useCanvas().getActiveText()
// - Transform via API
// - Display results with markdown
// - "Load to Canvas" callback
// - Auto-save to history
```

### Scenario 2: "I need to add a new storage backend"
```typescript
// 1. Find storage protocol:
retrieve_memory("storage adapter protocol")

// 2. Check existing implementations:
search_by_tag(["storage-adapters", "implementation"])

// 3. Verify interface:
// - Implement ConversationStorage protocol
// - Implement DocumentStorage protocol
// - Implement TransformationStorage protocol

// 4. Add to factory:
// - Update get_storage_for_mode()
// - Add configuration option
// - Write integration tests
```

### Scenario 3: "I'm debugging an MCP connection issue"
```typescript
// 1. Check MCP config history:
search_by_tag(["mcp-config", "fix"])

// 2. Find known issues:
retrieve_memory("mcp connection problem")

// 3. Check stdio handling:
// - Must use bash wrapper with 'python -u'
// - Check working directory is set
// - Verify Python virtualenv path

// 4. Test manually:
// echo '{"jsonrpc":"2.0","method":"initialize",...}' | python src/server.py
```

### Scenario 4: "I need to add a new feature to archive parser"
```typescript
// 1. Check current architecture:
search_by_tag(["archive-parser", "architecture"])

// 2. Find Python reference:
retrieve_memory("python archive parser")

// 3. Verify TypeScript implementation:
search_by_tag(["archive-parser", "typescript"])

// 4. Check what's implemented:
// - Core parser: ✅ Complete
// - 4 media strategies: ✅ Complete
// - Backend endpoints: ✅ Complete
// - Frontend UI: ✅ Complete
// - Testing: ⏳ Manual testing pending
```

---

## 🎓 Best Practices for Side Projects

### 1. **Start with Context Gathering**
```typescript
// Always begin with:
1. Read CLAUDE.md in project root
2. Search ChromaDB for relevant architecture
3. Check git branch and recent commits
4. Verify services are running
5. Read any /tmp/*_HANDOFF*.md files
```

### 2. **Use Existing Code Patterns**
```typescript
// Don't reinvent:
1. Search for similar components
2. Copy working patterns
3. Adapt to your use case
4. Follow established conventions
5. Maintain consistency
```

### 3. **Verify Before Implementing**
```typescript
// Before writing code:
1. Check if API endpoint exists (curl/fetch)
2. Verify database schema matches
3. Confirm configuration keys available
4. Test data sources are live
5. Validate dependencies installed
```

### 4. **Document as You Go**
```typescript
// While implementing:
1. Add comments explaining WHY (not what)
2. Mark TODOs with priority
3. Log technical debt to ChromaDB
4. Update handoff documents
5. Write tests alongside features
```

### 5. **Test Authenticity**
```typescript
// Before considering "done":
1. ✅ No mock data (or clearly marked if testing)
2. ✅ All functions implemented (no stubs)
3. ✅ Real API calls working
4. ✅ Error handling present
5. ✅ Config values not hard-coded
6. ✅ Tests passing
7. ✅ Technical debt logged
```

---

## 🗺️ Navigation Cheat Sheet

### "I need to know..."
| Question | Search Pattern | Fallback |
|----------|---------------|----------|
| How does X work? | `search_by_tag(["architecture", "X"])` | `retrieve_memory("X architecture")` |
| Where is X configured? | `search_by_tag(["configuration", "X"])` | Read config files |
| How to implement X? | `search_by_tag(["implementation", "X"])` | Find similar component |
| What's the status of X? | `search_by_tag(["X", "complete\|ready"])` | Check git commits |
| How to fix X error? | `search_by_tag(["fix", "X"])` | `retrieve_memory("X error")` |
| What was done last session? | `recall_memory("last session")` | `search_by_tag(["session-complete"])` |

### "I'm working on..."
| Task | Required Context | Key Files |
|------|-----------------|-----------|
| Archive import feature | Archive parser architecture | `src/services/parser/`, `archive-server.js` |
| Session management | Session history system | `src/contexts/SessionContext.tsx`, `sessionStorage.ts` |
| Transformation panel | Canvas integration | `src/core/context/CanvasContext.tsx`, API adapters |
| MCP server | MCP configuration | `~/.claude.json`, `humanizer_mcp/` |
| Database migration | Storage adapters | `humanizer/adapters/storage/`, Alembic migrations |
| TRM implementation | Quantum reading | `humanizer/core/trm/`, Phase completion docs |

### "I need to verify..."
| Verification | Command | Expected Result |
|-------------|---------|----------------|
| Database health | `mcp__chromadb-memory__check_database_health` | 359 memories, healthy |
| Backend running | `curl localhost:8000/health` | 200 OK |
| Archive server | `curl localhost:3002/api/conversations` | JSON response |
| Ollama available | `curl localhost:11434/api/tags` | Model list |
| Tests passing | `pytest` or `pnpm test` | All green |
| MCP servers | Check `~/.claude.json` | humanizer, chromadb-memory, chrome-devtools |

---

## 🚨 Critical Warnings

### ⚠️ NEVER:
1. ❌ Create mock data without `// ⚠️ MOCK DATA` warnings
2. ❌ Stub functions without error throwing
3. ❌ Hard-code paths (use config files)
4. ❌ Hard-code URLs (use environment detection)
5. ❌ Skip error handling
6. ❌ Skip tests
7. ❌ Commit without verifying authenticity
8. ❌ Ignore technical debt (log it!)

### ✅ ALWAYS:
1. ✅ Search ChromaDB before implementing
2. ✅ Check for existing patterns
3. ✅ Verify data sources are real
4. ✅ Use config files for values
5. ✅ Add proper error handling
6. ✅ Write tests
7. ✅ Log technical debt
8. ✅ Update handoff documents

---

## 📖 Key Documents Reference

### Handoff Documents (in `/tmp/`):
- `ARCHIVE_PARSER_HANDOFF_NOV23.md` - Archive parser Phases 1-3
- `ARCHIVE_PARSER_PHASE45_COMPLETE_NOV23.md` - Backend + Frontend complete
- `FINAL_SESSION_HANDOFF_NOV23.md` - Session system complete
- `MARKDOWN_COMPLETE_HANDOFF_NOV22_LATE.md` - Markdown preservation
- `NARRATIVE_SESSIONS_ARCHITECTURE_HANDOFF.md` - Narrative sessions
- `NOV_17_MEDIA_POLISH_AND_ARCHITECTURE_HANDOFF.md` - Media support + Desktop planning

### Project Documentation:
- `/Users/tem/humanizer_root/CLAUDE.md` - **START HERE** - Main project guide
- `/Users/tem/humanizer_root/narrative-studio/IMPLEMENTATION_PLAN_SESSION_HISTORY.md` - 10-phase session plan
- `/Users/tem/humanizer_root/DUAL_DEPLOYMENT_GUIDE.md` - Cloud/local architecture

### ChromaDB Quick Reference:
- Total memories: 359
- Database size: 18.6 MB
- Location: `/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db`
- Status: Healthy ✅

---

## 🎯 Success Criteria for Side Projects

Before considering a side project "done":

**Architecture** (Score: /5):
- [ ] Follows existing patterns from ChromaDB
- [ ] Uses correct project namespace
- [ ] Detects environment properly
- [ ] Config-driven (no hard-coded values)
- [ ] Integrates with existing components

**Code Quality** (Score: /5):
- [ ] No mock data (or clearly marked)
- [ ] No stub functions (or clearly marked + throw errors)
- [ ] Proper error handling
- [ ] Tests written and passing
- [ ] TypeScript types correct

**Documentation** (Score: /3):
- [ ] Comments explain WHY
- [ ] Technical debt logged to ChromaDB
- [ ] Handoff document updated

**Integration** (Score: /2):
- [ ] Works with existing services
- [ ] Doesn't break existing features

**Total**: /15 points
**Minimum to merge**: 12/15 (80%)

---

## 📞 Quick Help

### "I'm stuck on X"
1. Search ChromaDB: `retrieve_memory("X problem")`
2. Check for fixes: `search_by_tag(["fix", "X"])`
3. Read CLAUDE.md section on X
4. Check git history: `git log --grep="X"`
5. Test manually with curl/fetch
6. If still stuck: Log issue and ask user

### "I need to add X feature"
1. Search for similar: `search_by_tag(["X", "implementation"])`
2. Check architecture: `search_by_tag(["architecture", "X"])`
3. Find patterns: Look for existing components
4. Verify requirements: Check if API/DB ready
5. Implement with tests
6. Log any technical debt
7. Update documentation

### "I broke X"
1. Check error logs
2. Search for known issues: `search_by_tag(["fix", "X"])`
3. Verify environment (services running?)
4. Check recent changes (git diff)
5. Run tests to isolate issue
6. Fix and add test to prevent regression
7. Document solution in ChromaDB

---

**END OF GUIDE**

Remember: This database contains 45 years of consciousness work distilled into code. Respect the vision, follow the patterns, log your debt, and never mock what should be real.
