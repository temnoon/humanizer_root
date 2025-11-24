# Claude Desktop Quick Reference Card

**Version**: 1.0 | **Date**: Nov 23, 2025 | **Full Guide**: CLAUDE_DESKTOP_INTEGRATION_GUIDE.md

---

## 🚀 3-Step Start Protocol

```typescript
// 1. Environment Check
const cwd = process.cwd();  // Which project?
const branch = await exec('git branch --show-current');
const services = await checkServices();  // Ollama, PG, archive server

// 2. Query ChromaDB for Context
mcp__chromadb-memory__search_by_tag(["architecture", "component-name"])

// 3. Verify - NO MOCK DATA
✅ Real data sources exist
✅ API endpoints live
✅ Database connections work
```

---

## 📊 Project Quick IDs

| Project | Path | Port | Config | Branch |
|---------|------|------|--------|--------|
| **humanizer** | ~/humanizer_root/ | :8000 | config.py | main |
| **narrative-studio** | ~/humanizer_root/narrative-studio/ | :5173, :3002 | config/*.ts | feature/archive-import-parser |
| **cloud-workbench** | ~/humanizer_root/cloud-workbench/ | :3001 | .env | main |

---

## 🔍 5 Search Patterns (Copy-Paste Ready)

```typescript
// 1. Architecture Overview
mcp__chromadb-memory__search_by_tag(["architecture", "component-name"])

// 2. Configuration
mcp__chromadb-memory__search_by_tag(["configuration", "component-name"])

// 3. Recent Session
mcp__chromadb-memory__recall_memory("last session about topic")

// 4. Fix/Solution
mcp__chromadb-memory__search_by_tag(["fix", "problem-name"])

// 5. Status Check
mcp__chromadb-memory__search_by_tag(["component-name", "complete"])
```

---

## 🚫 Mock Data Protocol (REQUIRED)

```typescript
// ❌ WRONG - Silent mock:
const data = [{ id: 1, title: 'Example' }];

// ✅ CORRECT - Loud warning:
// ⚠️ MOCK DATA - Replace with real API call to /api/endpoint
// ⚠️ TODO: Implement data fetching (Priority: HIGH, Estimate: 2h)
const data = [{ id: 1, title: 'Example' }];
// ⚠️ END MOCK DATA

// ALSO: Log to ChromaDB
mcp__chromadb-memory__store_memory({
  content: "Technical Debt: Mock data in component.tsx line 42...",
  metadata: { tags: "technical-debt,mock-data,component-name" }
});
```

---

## 🏷️ Tag Cheat Sheet

### Tier 1: Architecture
`architecture`, `core-shell`, `deployment-modes`, `phase-0`, `phase-1`

### Tier 2: Components
`trm`, `quantum-reading`, `density-matrix`, `povm`, `transformation-engine`, `storage-adapters`, `session-history`, `archive-parser`, `buffers`

### Tier 3: Tech
`mcp`, `chromadb`, `ollama`, `pgvector`, `cloudflare`

### Tier 4: Status
`complete`, `phase1-complete`, `production-ready`, `session-complete`

### Tier 5: Problems
`fix`, `workaround`, `debugging`, `resolved`

---

## ✅ Before-Commit Checklist

```typescript
const authenticityAudit = {
  ✅ No mock data (or clearly marked with ⚠️),
  ✅ All functions implemented (no stubs),
  ✅ Real API calls working,
  ✅ Error handling present,
  ✅ Config values not hard-coded,
  ✅ Tests passing,
  ✅ Technical debt logged to ChromaDB
};

// Minimum score: 12/15 to merge
```

---

## 🌍 Environment Detection

```typescript
// ALWAYS check environment first:
const isHumanizer = cwd.includes('/humanizer_root/humanizer');
const isNarrativeStudio = cwd.includes('/narrative-studio');
const isCloudWorkbench = cwd.includes('/cloud-workbench');

const isLocal = hostname === 'localhost';
const ollamaAvailable = await ping('http://localhost:11434');
const pgAvailable = await ping('postgresql://localhost:5432');

// Use config files (NEVER hard-code):
const apiUrl = config.get('api.url');  // ✅
const apiUrl = 'http://localhost:8000';  // ❌
```

---

## 🎯 Common Scenarios (1-Liners)

| Scenario | Action |
|----------|--------|
| Build transformation panel | `search_by_tag(["transformation-panels", "architecture"])` |
| Add storage backend | `retrieve_memory("storage adapter protocol")` |
| Debug MCP connection | `search_by_tag(["mcp-config", "fix"])` |
| Extend archive parser | `search_by_tag(["archive-parser", "architecture"])` |
| Recent work | `recall_memory("last session")` |

---

## 📞 "I'm Stuck" Protocol

```
1. search_by_tag(["fix", "problem"])
2. Read CLAUDE.md section
3. Check git history: git log --grep="topic"
4. Test manually with curl
5. If still stuck: Log issue, ask user
```

---

## 🚨 Critical Warnings

### NEVER:
- ❌ Mock data without `// ⚠️ MOCK DATA` warnings
- ❌ Stub functions without throwing errors
- ❌ Hard-code paths (use config files)
- ❌ Hard-code URLs (detect environment)
- ❌ Skip error handling
- ❌ Commit without authenticity audit

### ALWAYS:
- ✅ Search ChromaDB before implementing
- ✅ Check for existing patterns
- ✅ Verify data sources are real
- ✅ Use config files
- ✅ Log technical debt
- ✅ Update handoff documents

---

## 📖 Key Documents

| Document | Purpose | Location |
|----------|---------|----------|
| **CLAUDE.md** | Main project guide | ~/humanizer_root/CLAUDE.md |
| **Integration Guide** | This guide (full) | ~/humanizer_root/CLAUDE_DESKTOP_INTEGRATION_GUIDE.md |
| **Handoffs** | Session handoffs | /tmp/*_HANDOFF*.md |
| **ChromaDB** | Memory database | 359 memories, 18.6 MB, healthy ✅ |

---

## 💡 Pro Tips

1. **Start broad, narrow down**: `search_by_tag(["architecture"])` → `search_by_tag(["architecture", "component"])`
2. **Use recall for sessions**: `recall_memory("last session")` finds recent work
3. **Tag combinations work**: `search_by_tag(["fix", "mcp", "connection"])`
4. **Check health first**: `check_database_health()` before heavy queries
5. **Log as you go**: Store insights immediately with proper tags

---

## 🎓 Success Score (15 Points)

- **Architecture**: /5 (patterns, namespace, environment, config, integration)
- **Code Quality**: /5 (no mocks, no stubs, errors, tests, types)
- **Documentation**: /3 (comments, debt logged, handoff)
- **Integration**: /2 (works with existing, doesn't break)

**Minimum to merge**: 12/15 (80%)

---

**Remember**: This database contains 45 years of consciousness work. Respect the vision, follow the patterns, log your debt, and never mock what should be real.

**Full Guide**: See CLAUDE_DESKTOP_INTEGRATION_GUIDE.md for complete details (60+ pages)
