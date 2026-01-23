# Humanizer Platinum - Agent Architecture

**Date**: January 22, 2026  
**Status**: Architecture Clarification

---

## Two Distinct Agent Systems

The codebase has **two separate agent councils** with different purposes:

### 1. CodeGuard Council (Development Standards)

**Purpose**: Enforce code quality standards during development. These agents review YOUR code (the developer's) to maintain codebase health.

**Invocation**: Via Claude Code direct API, pre-commit hooks, or CI/CD

**Location**: `packages/core/src/houses/development/`

| Agent | Domain | Checks |
|-------|--------|--------|
| **Architect** | Structure & patterns | Coupling, cohesion, complexity, design patterns |
| **Stylist** | Code conventions | Naming, formatting, consistency |
| **Security** | Vulnerabilities | XSS, injection, secrets, crypto, permissions |
| **Accessibility** | A11y compliance | WCAG, ARIA, contrast, keyboard navigation |
| **Data** | Schema/Interface | Zod schemas, type compatibility, API contracts |

**Missing**: Data Agent (schema validation, interface compatibility)

### 2. AppAgent Council (Humanizer Application)

**Purpose**: Power the Humanizer application features. These agents work WITH the user on their content (books, archives, transformations).

**Invocation**: Via Humanizer app UI, AUI chat interface, or API

**Location**: `packages/core/src/houses/` (top level)

| Agent | Domain | Does |
|-------|--------|------|
| **Model Master** | AI Routing | Routes requests to appropriate LLMs |
| **Harvester** | Archive Search | Finds passages in user's archives |
| **Curator** | Quality Assessment | Rates passage quality, detects redundancy |
| **Builder** | Composition | Writes chapters from curated passages |
| **Reviewer** | Quality Checks | Reviews drafts, signoff decisions |
| **Project Manager** | Lifecycle | Manages book project phases |
| **Explorer** | Format Discovery | Learns new archive formats |

---

## Naming Convention

```
packages/core/src/houses/
├── index.ts                    # All agents exported
├── codeguard/                  # RENAMED from "development/"
│   ├── architect.ts
│   ├── stylist.ts  
│   ├── security.ts
│   ├── accessibility.ts
│   └── data.ts                 # NEW
└── appagent/                   # RENAMED from top-level
    ├── model-master.ts
    ├── harvester.ts
    ├── curator.ts
    ├── builder.ts
    ├── reviewer.ts
    ├── project-manager.ts
    └── explorer.ts
```

**Type Updates**:
```typescript
// CodeGuard types
export type CodeGuardHouse = 
  | 'architect' 
  | 'stylist' 
  | 'security' 
  | 'accessibility'
  | 'data';

// AppAgent types  
export type AppAgentHouse = 
  | 'model-master'
  | 'harvester'
  | 'curator'
  | 'builder'
  | 'reviewer'
  | 'project-manager'
  | 'explorer';

// Combined (for HouseType compatibility)
export type HouseType = CodeGuardHouse | AppAgentHouse;
```

---

## Data Agent Specification

The missing **Data Agent** enforces schema and interface standards:

### Capabilities

```typescript
export class DataAgent extends CodeGuardBase {
  house = 'data' as const;

  // Schema validation
  async validateSchemas(files: CodeFile[]): Promise<SchemaReport>;
  async checkZodUsage(files: CodeFile[]): Promise<ZodUsageReport>;
  
  // Interface compatibility
  async checkInterfaceCompatibility(types: TypeFile[]): Promise<CompatibilityReport>;
  async validateApiContracts(routes: RouteFile[]): Promise<ContractReport>;
  
  // Data flow
  async traceDataFlow(entryPoint: string): Promise<DataFlowGraph>;
  async validateTransformations(transforms: TransformFile[]): Promise<TransformReport>;
}
```

### What It Checks

1. **Zod Schema Presence**: All API inputs validated with Zod
2. **Type Exports**: Interfaces exported for consumers
3. **Breaking Changes**: Detect interface modifications that break callers
4. **Nullability**: Proper handling of optional fields
5. **Serialization**: JSON-safe types for API boundaries

---

## Import/Ingest Adapter Architecture

For archive imports (ChatGPT, Claude, Facebook, etc.), we need:

### Adapter Interface

```typescript
// packages/core/src/adapters/types.ts

export interface ArchiveAdapter {
  /** Unique adapter ID */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** File patterns this adapter handles */
  patterns: string[];  // e.g., ['conversations.json', '**/message_*.json']
  
  /** Detect if this adapter can handle a folder */
  canHandle(folder: FolderStructure): Promise<AdapterMatch>;
  
  /** Parse the archive into unified format */
  parse(source: AdapterSource): AsyncGenerator<ParsedItem>;
  
  /** Validate parsed items */
  validate(item: ParsedItem): ValidationResult;
}

export interface AdapterMatch {
  confidence: number;  // 0-1
  evidence: string[];
  warnings?: string[];
}

export interface ParsedItem {
  type: 'conversation' | 'message' | 'media' | 'metadata';
  data: unknown;
  source: { adapter: string; path: string };
}
```

### Adapter Registry

```typescript
// packages/core/src/adapters/registry.ts

export class AdapterRegistry {
  private adapters: Map<string, ArchiveAdapter> = new Map();
  
  register(adapter: ArchiveAdapter): void;
  unregister(adapterId: string): void;
  
  /** Find best adapter for a folder */
  async detect(folder: FolderStructure): Promise<AdapterMatch[]>;
  
  /** Get adapter by ID */
  get(adapterId: string): ArchiveAdapter | undefined;
  
  /** List all registered adapters */
  list(): AdapterInfo[];
}
```

### Built-in Adapters

```
packages/core/src/adapters/
├── index.ts           # Registry + exports
├── types.ts           # Adapter interfaces
├── base.ts            # BaseAdapter class
├── chatgpt/           
│   └── index.ts       # ChatGPT export adapter
├── claude/
│   └── index.ts       # Claude export adapter
├── facebook/
│   └── index.ts       # Facebook export adapter
├── filesystem/
│   └── index.ts       # Generic folder adapter
└── custom/
    └── index.ts       # User-defined adapter support
```

---

## Zod Integration

Add Zod for runtime validation at API boundaries:

### Package Addition
```json
{
  "dependencies": {
    "zod": "^3.22.0"
  }
}
```

### Usage Pattern

```typescript
// packages/core/src/schemas/transformation.ts
import { z } from 'zod';

export const TransformRequestSchema = z.object({
  text: z.string().min(1).max(100000),
  persona: z.string().optional(),
  style: z.string().optional(),
  options: z.object({
    preserveFormatting: z.boolean().default(true),
    temperature: z.number().min(0).max(2).default(0.7),
  }).optional(),
});

export type TransformRequest = z.infer<typeof TransformRequestSchema>;

// In API handler
const validated = TransformRequestSchema.parse(request.body);
```

### Data Agent Integration

The Data Agent would check:
1. All API endpoints use Zod schemas
2. Schemas match TypeScript types
3. Error messages are user-friendly
4. Validation is applied consistently

---

## Claude Code Integration (No MCP Needed)

Claude Code can call the agents directly via function calls:

```typescript
// Direct API for Claude Code
import { getArchitectAgent, getDataAgent } from '@humanizer/core';

// Review architecture
const architect = getArchitectAgent();
const review = await architect.reviewArchitecture({
  codebase: { files: [...] },
  focus: 'coupling',
});

// Check schemas
const data = getDataAgent();
const schemaReport = await data.validateSchemas(files);
```

No MCP server needed - Claude Code can execute TypeScript directly.

---

## Next Steps

1. **Rename directories**: `development/` → `codeguard/`
2. **Create Data Agent**: `codeguard/data.ts`
3. **Add Zod**: Package dependency + base schemas
4. **Create adapter framework**: `adapters/` directory
5. **Update exports**: Reflect new structure

---

## Summary

| System | Purpose | Agents | Invoked By |
|--------|---------|--------|------------|
| **CodeGuard** | Enforce dev standards | 5 (architect, stylist, security, a11y, data) | Claude Code, CI/CD |
| **AppAgent** | Power Humanizer app | 7 (model-master, harvester, curator, builder, reviewer, pm, explorer) | User via app UI |
