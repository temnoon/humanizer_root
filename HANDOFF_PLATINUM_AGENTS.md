# PLATINUM AGENT SYSTEM - Comprehensive Handoff

**Date**: January 22, 2026  
**Branch**: `blissful-rhodes`  
**Status**: Phase 1 Foundation - **COMPLETE** ✅  
**ChromaDB**: Search "platinum-agents" or "vimalakirti"

---

## WHAT WAS BUILT

A unified agent system combining:
1. **humanizer-gm agent council** (ported from golden master) 
2. **Vimalakirti boundary system** (ethical guardrails)
3. **Canon/Doctrine/Instruments** (agent knowledge framework)
4. **UCG** (Unified Concept Graph for content)
5. **Config Management** (no hardcoded literals!)

### Core Insight
> **Intelligence is in infrastructure, not model size.**
> Pre/post processing handles 80%. LLM only synthesizes.

---

## COMPLETED (Phase 1)

| Module | Status | Lines | Description |
|--------|--------|-------|-------------|
| `runtime/types.ts` | ✅ | ~500 | Agent types, messages, tasks, proposals, signoffs |
| `runtime/agent-base.ts` | ✅ | ~300 | Abstract base class for agents |
| `bus/message-bus.ts` | ✅ | ~350 | Pub/sub + request/response communication |
| `config/types.ts` | ✅ | ~300 | ConfigManager interface, prompt templates |
| `config/in-memory-config.ts` | ✅ | ~350 | In-memory implementation |
| `config/default-prompts.ts` | ✅ | ~250 | Seed prompts (Vimalakirti, agents) |
| `config/default-thresholds.ts` | ✅ | ~200 | Seed thresholds and limits |
| `vimalakirti/index.ts` | ✅ | ~350 | Ethical boundary system |
| `canon/index.ts` | ✅ | ~450 | Knowledge framework |
| `doctrine/index.ts` | ✅ | ~400 | Judgment system |
| `instruments/index.ts` | ✅ | ~400 | Capabilities framework |
| `ucg/index.ts` | ✅ | ~550 | Content pyramid |
| `index.ts` | ✅ | ~50 | Main exports |

**Total**: ~4,500 lines of TypeScript, **all typechecked and building**.

---

## KEY ARCHITECTURE DECISIONS

### 1. Config-Managed Everything
All literals (prompts, thresholds, limits) are stored in `ConfigManager`:
- NO hardcoded values in code files
- Admin UI can modify without code deploy
- Audit logging for all changes
- Support for encrypted secrets

```typescript
// WRONG - hardcoded
const threshold = 0.7;

// RIGHT - config managed
const threshold = await configManager.get('thresholds', THRESHOLD_KEYS.CONFIDENCE_MIN);
```

### 2. Vimalakirti Boundary System
Based on Vimalakirti Sutra's "skillful means":
- **Inquiry Level Assessment**: information / meaning / existential
- **Professional Distance**: redirect emotional requests to professionals
- **Shadow Check**: acknowledge but never glorify violence/harm

### 3. Multi-Resolution Content (UCG)
Content stored at multiple granularities:
- L0: Sentences (finest)
- L1: Passages (~200 words)
- L2: Sections (~800 words)
- L3: Chapters (~3000 words)
- Apex: Single summary

### 4. Canon/Doctrine/Instruments Pattern
Agents are configured with:
- **Canon**: What they KNOW (formats, patterns, knowledge graph)
- **Doctrine**: How they JUDGE (evaluation axes, thresholds)
- **Instruments**: What they CAN DO (tools, search, transform)

---

## FILE STRUCTURE

```
packages/core/
├── package.json
├── tsconfig.json
├── dist/                    # Built output
└── src/
    ├── index.ts             # Main exports
    ├── runtime/
    │   ├── index.ts
    │   ├── types.ts         # Core agent types
    │   └── agent-base.ts    # Abstract base class
    ├── bus/
    │   ├── index.ts
    │   └── message-bus.ts   # Inter-agent communication
    ├── config/
    │   ├── index.ts
    │   ├── types.ts         # ConfigManager interface
    │   ├── in-memory-config.ts
    │   ├── default-prompts.ts
    │   └── default-thresholds.ts
    ├── vimalakirti/
    │   └── index.ts         # Ethical boundaries
    ├── canon/
    │   └── index.ts         # What agents know
    ├── doctrine/
    │   └── index.ts         # How agents judge
    ├── instruments/
    │   └── index.ts         # What agents can do
    └── ucg/
        └── index.ts         # Content pyramid
```

---

## NEXT STEPS (Phase 2)

### 1. Port House Agents
Port the 7 house agents from humanizer-gm:
- `model-master.ts` - AI routing
- `harvester.ts` - Archive search
- `curator.ts` - Quality assessment
- `reviewer.ts` - Signoffs
- `builder.ts` - Chapter composition
- `project-manager.ts` - Lifecycle
- `explorer.ts` - Import intelligence

### 2. Port Orchestrator
Port `council/orchestrator.ts` for:
- Session management
- Signoff coordination
- Task routing

### 3. Port Task Queue
Port `tasks/queue.ts` for:
- Priority queue
- Task dependencies
- Retry logic

### 4. Database Persistence
Create database-backed implementations of:
- `DatabaseConfigManager`
- `DatabaseCanonProvider`
- `DatabaseDoctrineProvider`
- `DatabaseUCGProvider`

### 5. Admin UI
Build admin interface for:
- Prompt editing
- Threshold adjustment
- Audit log viewing

---

## COMMANDS

```bash
cd /Users/tem/.claude-worktrees/humanizer-platinum/blissful-rhodes/packages/core

# Build
npm run build

# Typecheck
npm run typecheck

# Development (watch mode)
npm run dev
```

---

## USAGE EXAMPLE

```typescript
import {
  AgentBase,
  getMessageBus,
  getConfigManager,
  getVimalakirtiBoundary,
  getCanonProvider,
  getDoctrineProvider,
  getInstrumentsProvider,
  getUCGProvider,
  PROMPT_IDS,
} from '@humanizer/core';

// Initialize config with seed data
const configManager = getConfigManager();
await configManager.initialize();

// Create Vimalakirti boundary (needs LLM provider)
const boundary = getVimalakirtiBoundary({
  complete: async (prompt) => {
    // Your LLM call here
    return await yourLLM.complete(prompt);
  }
});

// Check boundaries before processing
const check = await boundary.checkBoundaries(userRequest);
if (!check.shouldProceed) {
  return check.interventionMessage;
}

// Get a prompt template
const compiled = await configManager.compilePrompt(
  PROMPT_IDS.AGENT_CURATOR,
  { additionalContext: '...' }
);

// Use the compiled prompt with your LLM
const response = await yourLLM.complete(compiled.text);
```

---

## SOURCE REFERENCE

Original source (humanizer-gm):
```
/Users/tem/humanizer_root/humanizer-gm/electron/agents/
├── runtime/types.ts
├── runtime/agent-base.ts
├── bus/message-bus.ts
├── houses/                 # Next to port
├── council/orchestrator.ts # Next to port
└── tasks/queue.ts          # Next to port
```

---

## DEPRECATED (DO NOT USE)

`humanizer-app/packages/` contains old implementations being replaced.

---

**Resume**: Run `npm run build` in packages/core, then start Phase 2 (port house agents).
