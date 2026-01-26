# Humanizer AUI CLI Test Report

**Date:** January 25, 2026
**Tester:** Claude Code
**CLI Location:** `packages/core/src/cli/humanizer-cli.ts`
**Start Command:** `cd packages/core && npx tsx src/cli/humanizer-cli.ts`

---

## Executive Summary

The CLI successfully connects to PostgreSQL storage and provides working search, analysis, and export functionality. Key transformations (persona rewriting) require persona profiles to be created first via the harvest workflow.

---

## Test Results

### Storage Connection
| Feature | Status | Notes |
|---------|--------|-------|
| PostgreSQL Connection | ✅ Working | Connects to `humanizer_archive` |
| Has Store | ✅ true | AUI store connected |
| Has Books Store | ✅ true | Books store connected |
| Has Archive Store | ✅ true | Archive store connected |
| Ollama Connection | ✅ Working | Embeddings via `nomic-embed-text:latest` |

### Search & Discovery
| Feature | Status | Notes |
|---------|--------|-------|
| Semantic Search | ✅ Working | "Loaded 5 results into buffer" |
| Cluster Discovery | ✅ Working | "Found 10 clusters" |
| Buffer Loading | ✅ Working | Shows word count, format, preview |

### Analysis
| Feature | Status | Notes |
|---------|--------|-------|
| Quality Analysis | ✅ Working | Overall Score: 70%, Reading Level, etc. |
| AI Detection | ✅ Working | AI Probability: 30%, Classification: Likely Human |
| Provenance Tracking | ✅ Working | Shows operation chain, timestamps |

### Export
| Feature | Status | Notes |
|---------|--------|-------|
| Save as Markdown | ✅ Working | Includes metadata and provenance |
| Export PDF | ✅ Available | Requires puppeteer |
| Export Pandoc | ✅ Available | Requires pandoc installed |

### Books
| Feature | Status | Notes |
|---------|--------|-------|
| List Books | ✅ Working | Shows existing books |
| Book Details | ✅ Available | via `book <id>` |

### Personas
| Feature | Status | Notes |
|---------|--------|-------|
| List Personas | ✅ Working | Shows "No personas found" correctly |
| Start Harvest | ✅ Working | Creates harvest session |
| Persona Transform | ⚠️ Requires Persona | Must create persona first |

### Transformations
| Feature | Status | Notes |
|---------|--------|-------|
| Generic Transform | ⚠️ Stub | Records operation but doesn't change content |
| Persona Rewrite | ⚠️ Requires Persona | Full LLM rewriting with Builder agent |

---

## Sample Session Output

```
humanizer [4581ca8c] > status
System Status:
  Session: 4581ca8c-47f8-4b6b-9a3b-d78807ef39db
  User: cli-user
  Active Buffer: None
  Command History: 1 commands
  Output Directory: ./humanizer-output
  Has Store: true
  Has Books Store: true
  Has Archive Store: true

humanizer [4581ca8c] > search "writing about technology"
Searching for: "writing about technology"...
Loaded 5 results into buffer

humanizer [b92af980] (31464184) > analyze
Quality Analysis:
  Overall Score: 70.0%
  Reading Level: Grade 12.1
  Avg Sentence Length: 16.4 words
  Formality: 50%

humanizer [b92af980] (f127b268) > detect-ai
AI Detection Results:
  AI Probability: 30.0%
  Confidence: 80.0%
  Classification: Likely Human

humanizer [b92af980] (2c5d7e3c) > history
Provenance Chain: e5fe1200-3e74-495b-ac58-107ca33f106f
  Root Buffer: 31464184
  Branch: main (main)
  Transformations: 3

Operations:
  [10:16:00 AM] create_manual: Created from text
  [10:16:02 AM] analyze_quality: Quality analysis performed
  [10:16:05 AM] detect_ai: AI detection: 30.0% probability, 0 tells found
```

---

## Sample Content Retrieved

The archive contains diverse content including:
- **Tech discussions** - YouTuber conversations about smartphones, gadgets
- **Philosophical essays** - Derrida's "Of Grammatology", Husserl's phenomenology
- **Personal narratives** - Self-discovery and reflection pieces
- **Technical analysis** - QBism, quantum mechanics, consciousness studies
- **Buddhist philosophy** - Nagarjuna's Catuskoti, Four Noble Truths

---

## Code Changes Made

### 1. Fixed Type Export Error
**File:** `packages/core/src/aui/service/index.ts`
**Issue:** Type-only exports were using value export syntax
**Fix:** Combined all type exports into `export type { ... }`

### 2. Added Storage Initialization to CLI
**File:** `packages/core/src/cli/humanizer-cli.ts`
**Changes:**
- Added `EmbeddingService` import
- Updated constructor to accept pre-initialized service
- Updated `main()` to use `initUnifiedAuiWithStorage()`
- Added `--no-storage` flag for offline mode
- Added environment variable support for database config

### 3. Fixed Archive Store Attachment
**File:** `packages/core/src/aui/service/factory.ts`
**Issue:** `contentStore` was created but never attached to service
**Fix:** Added `service.setArchiveStore(contentStore)`

### 4. Implemented Personas Listing
**File:** `packages/core/src/cli/humanizer-cli.ts`
**Issue:** `listPersonas()` was a stub
**Fix:** Implemented using `service.listPersonaProfiles()`

---

## Recommendations

### For Full Transformation Testing
1. Create a persona via the harvest workflow:
   ```
   harvest "My Voice"
   search "personal writing samples"
   # (add samples to harvest)
   # (finalize persona)
   ```
2. Then use `persona <personaId>` for LLM-based transformation

### For Production Use
1. Set environment variables:
   ```bash
   export POSTGRES_HOST=localhost
   export POSTGRES_PORT=5432
   export POSTGRES_USER=postgres
   export POSTGRES_DB=humanizer_archive
   export OLLAMA_URL=http://localhost:11434
   ```
2. Ensure Ollama is running with embedding model
3. Ensure PostgreSQL has `humanizer_archive` database

---

## Files Created

- `humanizer-output/test-output.md` - Sample exported essay (5560 words)
- `humanizer-output/transformed-essay.md` - Test output
- `humanizer-output/CLI_TEST_REPORT.md` - This report
