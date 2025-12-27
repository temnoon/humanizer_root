# AUI + Book Integration - Handoff

**Date**: December 27, 2025
**Status**: Complete - Electron IPC + Workflow Tools
**Branch**: `feature/subjective-intentional-constraint`

---

## Overview

Wired the AUI system to the Book context, enabling the complete book creation workflow from within the chat interface. Users can now:
- Ask "show me my AI conversations" → lists archive
- Ask "harvest passages about X" → searches + adds to bookshelf
- Ask "generate a first draft" → creates chapter from passages
- All with "show don't tell" teaching animations

---

## Changes Made

### 1. AUI-Book Context Integration
**File**: `apps/web/src/lib/aui/AUIContext.tsx`

- Removed stubbed `useBook()` (lines 31-43)
- Added real import: `import { useBookOptional } from '../book';`
- Added fallback for when BookProvider is not available
- All existing book tools now work with real data

### 2. New AUI Tools
**File**: `apps/web/src/lib/aui/tools.ts`

| Tool | Purpose | Key Params |
|------|---------|------------|
| `list_conversations` | List archive conversations | `limit`, `search`, `hasImages` |
| `harvest_archive` | Search + auto-add passages | `query`, `limit`, `minSimilarity` |
| `generate_first_draft` | Create chapter from passages | `chapterTitle`, `passageIds`, `style` |

**Implementation details**:
- `list_conversations`: Calls `/api/conversations` on archive server
- `harvest_archive`: Combines semantic search + `addPassage()` calls
- `generate_first_draft`: Uses LLM to weave passages, falls back to concatenation

### 3. Settings Expansion
**File**: `apps/web/src/lib/aui/settings.ts`

Added two new setting categories:

```typescript
interface AutomationSettings {
  mode: 'guided' | 'autonomous';
  showProposals: boolean;
  autoApproveLowRisk: boolean;
}

interface ModelSettings {
  draftModel: 'haiku' | 'sonnet' | 'opus' | 'ollama-local';
  summaryModel: 'haiku' | 'sonnet';
  preferLocal: boolean;
}
```

---

## Architecture

```
User: "Harvest passages about consciousness"
          ↓
AUIContext.sendMessage()
          ↓
LLM parses → USE_TOOL(harvest_archive, {...})
          ↓
executeHarvestArchive()
    ├─ fetch(/api/embeddings/search/messages)
    ├─ filter by minSimilarity
    └─ for each result: context.addPassage()
          ↓
BookContext updates activeProject.passages
          ↓
Teaching animation: "Archive > Explore > Select > Add"
          ↓
User sees: "Harvested 8 passages!"
```

---

## Current Tool Count

The AUI now has **37 tools**:

| Category | Tools |
|----------|-------|
| Chapter | create, update, delete, render, list, get |
| Workspace | get_workspace, save_to_chapter |
| Archive | search_archive, search_facebook, **list_conversations**, **harvest_archive** |
| Passage | add, list, mark |
| Image | describe, search, classify, find_similar, cluster, add_image_passage |
| Persona/Style | list, apply, extract, discover, create (x2) |
| Transform | humanize, detect_ai, translate, analyze_text, quantum_read |
| Pyramid | build, get, search, **generate_first_draft** |

---

## Phase 2: Agent-AUI Bridge (Complete)

### New File: `apps/web/src/lib/aui/agent-bridge.ts` (~450 lines)

The bridge connects house agents to AUI tool execution:

| Component | Purpose |
|-----------|---------|
| `AgentAUIBridge` class | Main bridge singleton |
| `receiveProposal()` | Receives proposals from agents |
| `approveProposal()` | Executes approved proposals via AUI tools |
| `rejectProposal()` | Rejects proposals with optional reason |
| `executeTool()` | Direct tool execution for agents |
| `ACTION_TO_TOOL_MAP` | Maps agent actions → AUI tools |
| `useAgentBridge()` | React hook for bridge state |

**Action Type Mappings:**
```typescript
'add-passages-to-thread' → harvest_archive
'search-archive' → search_archive
'feature-gem' → mark_passage (status: 'gem')
'approve-passage' → mark_passage (status: 'approved')
'create-chapter' → create_chapter
'update-chapter' → update_chapter
'build-chapter-draft' → generate_first_draft
'detect-ai' → detect_ai
```

### AUIContext Integration

Updated `AUIContext.tsx` to:
- Initialize bridge on mount
- Subscribe to bridge events
- Display proposals in chat
- Expose `approveProposal`, `rejectProposal`, `requestAgentWork` methods
- Track `pendingProposals`, `agents`, `agentBridgeConnected` state

### New AUI Tools (4 tools)

| Tool | Purpose |
|------|---------|
| `list_agents` | Show available agents with status |
| `get_agent_status` | Get specific agent's status |
| `list_pending_proposals` | Show proposals awaiting approval |
| `request_agent` | Dispatch task to an agent |

**Total AUI Tools: 41**

---

## Remaining Work

### HIGH PRIORITY
1. **Electron-side Orchestrator Integration**
   - Wire house agents to emit proposals
   - Connect proposal system to IPC bridge
   - Enable Electron↔Web communication for agent events

### MEDIUM PRIORITY
2. **discover_threads tool** - AI clustering of passages
3. **start_book_workflow** - Guided orchestration
4. **Archive navigation animations** - Animate panel opens

### LOWER PRIORITY
5. **Book format migration** - Verify legacy format support
6. **Model preference UI** - Settings panel for model selection

---

## Testing

### Manual Test Flow
```bash
# Start archive server
cd /Users/tem/humanizer_root/narrative-studio
npx tsx archive-server.js &

# Start Electron app
cd /Users/tem/humanizer_root/humanizer-app
npm run dev

# In AUI chat:
# 1. "Show me my AI conversations"
# 2. "Harvest passages about phenomenology"
# 3. "Build a pyramid from my passages"
# 4. "Generate first draft chapter called 'Introduction'"
```

### Key Assertions
- `list_conversations` returns conversation list from archive
- `harvest_archive` adds passages to activeProject
- `generate_first_draft` creates chapter in book
- Teaching animations play for each tool

---

## Files Changed

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `apps/web/src/lib/aui/AUIContext.tsx` | ~100 | Book context + agent bridge integration |
| `apps/web/src/lib/aui/tools.ts` | ~600 | 7 new tools + agent tools + docs |
| `apps/web/src/lib/aui/settings.ts` | ~35 | Automation + model settings |
| `apps/web/src/lib/aui/agent-bridge.ts` | ~450 | **NEW** Agent-AUI bridge |

---

## Context for Next Session

The AUI is now fully wired to the Book system AND the Agent Bridge is complete on the web side. The remaining piece is the Electron-side connection:

### What's Done (Web Side):
1. ✅ Agent Bridge (`agent-bridge.ts`) can receive, approve, reject proposals
2. ✅ AUIContext subscribes to bridge events, displays proposals in chat
3. ✅ 4 agent tools let users interact with agents via chat
4. ✅ ACTION_TO_TOOL_MAP translates agent actions to AUI tools

### What Needs Wiring (Electron Side):
The house agents (`electron/agents/houses/*.ts`) use `proposeAction()` which emits to the message bus. This needs to:
1. Emit proposals via Electron IPC to the renderer
2. Renderer's AgentBridge receives via `window.electronAPI.onAgentProposal()`
3. User approves in AUI chat
4. Approval goes back via IPC to orchestrator
5. Orchestrator resolves the proposal, agent proceeds

### Architecture Diagram:
```
[House Agent] → proposeAction() → [Message Bus] → [Orchestrator]
                                                      ↓
                                               [IPC Preload]
                                                      ↓
                                               [AgentBridge]
                                                      ↓
                                               [AUI Chat Display]
                                                      ↓
                                               [User Approves]
                                                      ↓
                                               [IPC Back]
                                                      ↓
                                               [Orchestrator.resolveProposal()]
                                                      ↓
                                               [Agent Continues]
```

Key design decisions (from planning):
- **Automation mode toggle**: User chooses between guided (approve each action) and autonomous (agents work freely, pause at checkpoints)
- **Display pattern**: Tool results animate Archive panel open, highlight results there

---

## Phase 3: Electron IPC Bridge (Complete)

### Preload Agent API
**File**: `electron/preload.ts`

Added new `agents` namespace to ElectronAPI:
- `listAgents()` - List all registered agents
- `getAgent(id)` - Get specific agent info
- `getPendingProposals()` - Get proposals awaiting approval
- `approveProposal(id)` - Approve a proposal
- `rejectProposal(id)` - Reject a proposal
- `requestTask(spec)` - Dispatch a task to an agent
- `getTaskStatus(id)` - Get task progress
- `startSession()` / `endSession()` - Manage council sessions
- `getStats()` - Get orchestrator statistics
- Event subscriptions: `onProposal`, `onAgentStatus`, `onSessionEvent`

### Main Process Handlers
**File**: `electron/main.ts`

- Imports `getCouncilOrchestrator()` and `getAgentRegistry()`
- Initializes orchestrator on startup
- Subscribes to orchestrator events, forwards to renderer via IPC
- Handles all `agents:*` IPC invocations

### AgentBridge IPC Connection
**File**: `apps/web/src/lib/aui/agent-bridge.ts`

Updated to detect Electron and connect via IPC:
- `setupElectronConnection()` - Subscribes to IPC events
- `refreshAgents()` - Syncs agent list from Electron
- `requestAgentWork()` - Dispatches via IPC when available
- `cleanup()` - Unsubscribes IPC listeners

---

## Phase 4: Workflow Tools (Complete)

### New AUI Tools
**File**: `apps/web/src/lib/aui/tools.ts`

| Tool | Purpose |
|------|---------|
| `discover_threads` | AI clustering of passages by shared keywords/themes |
| `start_book_workflow` | Guided multi-step workflow orchestration |

**Total AUI Tools: 43**

### discover_threads
Clusters passages by extracting keywords and grouping by shared terms:
```typescript
USE_TOOL(discover_threads, {"minPassages": 2, "maxThreads": 5})
```
Returns: threads with theme names, passage counts, and unclustered items

### start_book_workflow
Orchestrates agents for book creation:
```typescript
USE_TOOL(start_book_workflow, {"workflowType": "full", "topic": "consciousness"})
```
Workflow types:
- `harvest` - Search archive for passages
- `curate` - Assess and organize passages
- `build` - Discover threads, compose chapters
- `full` - All steps: Harvest → Curate → Build Pyramid → Compose → Review

---

## Files Changed (This Session)

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `electron/preload.ts` | ~70 | AgentAPI types + IPC implementations |
| `electron/main.ts` | ~180 | Agent IPC handlers + orchestrator init |
| `apps/web/src/lib/aui/agent-bridge.ts` | ~100 | Electron IPC connection + cleanup |
| `apps/web/src/lib/aui/tools.ts` | ~300 | discover_threads + start_book_workflow |

---

## Testing

### Start Everything
```bash
ollama serve  # Ensure Ollama running
cd /Users/tem/humanizer_root/narrative-studio && npx tsx archive-server.js &
cd /Users/tem/humanizer_root/humanizer-app && npm run dev
```

### Test Commands in AUI Chat
- "Find themes in my passages" → `discover_threads`
- "Help me build a book about consciousness" → `start_book_workflow`
- "What agents are available?" → `list_agents`
- "Ask the harvester to find content about X" → `request_agent`

---

## Architecture Summary

```
[User in AUI Chat]
       ↓
[AUIContext.sendMessage()]
       ↓
[LLM Response with USE_TOOL()]
       ↓
[executeTool() in tools.ts]
       ↓
[Tool execution (local or via Electron IPC)]
       ↓
[Result with teaching animation]
       ↓
[Display in chat + animate UI]
```

For agent-related operations:
```
[AUI] ─→ [AgentBridge] ─→ [Electron IPC] ─→ [Orchestrator]
                                                    ↓
                                            [House Agents]
                                                    ↓
                                            [Proposals]
                                                    ↓
                         [IPC Event] ←────────────────
                              ↓
                      [AUI Chat Display]
                              ↓
                      [User Approval]
```

---

## What's Done

| Feature | Status |
|---------|--------|
| AUI → Book wiring | ✅ |
| Agent Bridge (web) | ✅ |
| Electron IPC Bridge | ✅ |
| discover_threads tool | ✅ |
| start_book_workflow tool | ✅ |
| TypeScript compilation | ✅ |

**Total AUI Tools: 43**
