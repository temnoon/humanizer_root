# Studio Tools Framework

**Version**: 1.0
**Created**: December 2, 2025
**Status**: Specification (Pre-Implementation)

---

## Executive Summary

This document defines a unified framework for integrating transformation, analysis, and publishing tools across all humanizer.com studio interfaces. The goal is a consistent, extensible architecture that works identically whether the user is in the local narrative-studio or the cloud-based post-social-ui—and any future interfaces we build.

**Core Principle**: Tools are first-class citizens with a registry-driven architecture. Adding a new tool means registering it, not writing new UI code.

---

## Table of Contents

1. [Goals & Constraints](#1-goals--constraints)
2. [Tool Taxonomy](#2-tool-taxonomy)
3. [Architecture Overview](#3-architecture-overview)
4. [Tool Registry Specification](#4-tool-registry-specification)
5. [UI Component Library](#5-ui-component-library)
6. [API Contracts](#6-api-contracts)
7. [State Management](#7-state-management)
8. [Interface Integration](#8-interface-integration)
9. [Adding New Tools](#9-adding-new-tools)
10. [Adding New Interfaces](#10-adding-new-interfaces)
11. [Security & Permissions](#11-security--permissions)
12. [Appendix: Tool Reference](#appendix-tool-reference)

---

## 1. Goals & Constraints

### Goals

1. **Consistency**: Same tool behaves identically across all interfaces
2. **Extensibility**: Add new tools without modifying existing code
3. **Reusability**: Shared components, services, and types
4. **Discoverability**: Users can find tools through intuitive categorization
5. **Composability**: Tool outputs can flow into other tools or editors

### Constraints

1. **npe-api is the backend**: All transformation/analysis tools call npe-api
2. **post-social-api handles publishing**: Node/narrative operations go through post-social-api
3. **Local-only tools exist**: Some tools (Quantum Reading, Voice Discovery) only work in narrative-studio
4. **Tier restrictions apply**: Some tools require Pro/Premium subscription
5. **Framework agnostic where possible**: Core logic shouldn't depend on React vs Solid.js

### Non-Goals

- This framework does NOT handle authentication (handled by auth stores)
- This framework does NOT define the 3-panel layout (handled by each interface)
- This framework does NOT replace interface-specific features (e.g., local archive browsing)

---

## 2. Tool Taxonomy

Tools are organized into five categories based on their primary function:

### 2.1 Analysis Tools

Read-only tools that examine content without modifying it.

| Tool | Description | Tier | Interfaces |
|------|-------------|------|------------|
| AI Detection (Lite) | Heuristic-based AI pattern detection | Free | All |
| AI Detection (GPTZero) | Premium AI detection with sentence-level analysis | Pro | All |
| Quantum Reading | POVM measurement, density matrix analysis | Free | narrative-studio |
| Language Detection | Identify source language | Free | All |
| Curator Analysis | Clarity, depth, coherence scoring | Free | post-social |

### 2.2 Transformation Tools

Tools that modify content and produce a new version.

| Tool | Description | Tier | Interfaces |
|------|-------------|------|------------|
| Humanizer | Remove AI patterns, improve naturalness | Free | All |
| Translation | Translate to 40+ languages | Free | All |
| Persona | Transform to different voice/perspective | Free | All |
| Style | Apply different writing patterns | Free | All |
| Namespace | Shift conceptual framework/setting | Free | All |
| Allegorical Projection | 5-stage deep transformation | Premium | All |

### 2.3 Extraction Tools

Tools that create reusable assets from content.

| Tool | Description | Tier | Interfaces |
|------|-------------|------|------------|
| Extract Persona | Create persona definition from passage | Pro | All |
| Extract Style | Create style definition from passage | Pro | All |
| Voice Discovery | Cluster writing samples to find voices | Pro | narrative-studio |

### 2.4 Generation Tools

Tools that create new content from parameters.

| Tool | Description | Tier | Interfaces |
|------|-------------|------|------------|
| Story Generation | Generate narrative from attributes | Premium | narrative-studio |
| Maieutic Dialogue | Socratic questioning session | Free | narrative-studio |

### 2.5 Publishing Tools

Tools specific to node/narrative publishing workflow.

| Tool | Description | Tier | Interfaces |
|------|-------------|------|------------|
| Pre-Publish Review | Safety and quality checks | Free | post-social |
| Tag Suggestions | Auto-generate content tags | Free | post-social |
| Chapter Publishing | Convert content to narrative chapters | Free | post-social |
| Synthesis | Combine comments into new version | Free | post-social |
| Round-Trip Analysis | Semantic drift check via back-translation | Free | All |

---

## 3. Architecture Overview

### 3.1 Package Structure

```
workers/shared/studio-tools/
├── src/
│   ├── index.ts                    # Public exports
│   ├── types/
│   │   ├── tools.ts                # Core type definitions
│   │   ├── parameters.ts           # Parameter type definitions
│   │   └── results.ts              # Result type definitions
│   ├── registry/
│   │   ├── tool-registry.ts        # Tool registration and lookup
│   │   ├── category-registry.ts    # Category definitions
│   │   └── tools/                   # Individual tool definitions
│   │       ├── ai-detection.ts
│   │       ├── humanizer.ts
│   │       ├── translation.ts
│   │       ├── persona.ts
│   │       ├── style.ts
│   │       ├── namespace.ts
│   │       ├── allegorical.ts
│   │       ├── extraction.ts
│   │       ├── round-trip.ts
│   │       ├── quantum-reading.ts
│   │       ├── maieutic.ts
│   │       ├── story-generation.ts
│   │       └── publishing/
│   │           ├── pre-publish.ts
│   │           ├── tag-suggestions.ts
│   │           ├── chapter-publish.ts
│   │           └── synthesis.ts
│   ├── services/
│   │   ├── tool-executor.ts        # Execute tools with error handling
│   │   ├── npe-api-client.ts       # npe-api HTTP client
│   │   ├── post-social-client.ts   # post-social-api HTTP client
│   │   └── result-handler.ts       # Process and format results
│   ├── components/
│   │   ├── core/                   # Framework-agnostic core logic
│   │   │   ├── tool-palette.logic.ts
│   │   │   ├── tool-drawer.logic.ts
│   │   │   └── result-preview.logic.ts
│   │   ├── solid/                  # Solid.js implementations
│   │   │   ├── ToolPalette.tsx
│   │   │   ├── ToolCard.tsx
│   │   │   ├── ToolDrawer.tsx
│   │   │   ├── ResultPreview.tsx
│   │   │   ├── ParameterInput.tsx
│   │   │   └── index.ts
│   │   └── react/                  # React implementations (future)
│   │       └── index.ts
│   └── utils/
│       ├── parameter-validation.ts
│       ├── result-formatting.ts
│       └── tier-checking.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 3.2 Dependency Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERFACES                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ narrative-studio│  │ post-social-ui  │  │  future-ui      │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                 │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              @humanizer/studio-tools                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         ││
│  │  │  Registry   │  │  Services   │  │  Components │         ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                │                                 │
│           ┌────────────────────┼────────────────────┐           │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    npe-api      │  │ post-social-api │  │  local services │ │
│  │ (transforms)    │  │  (publishing)   │  │ (ollama, etc)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Flow

```
User Action
    │
    ▼
┌─────────────────┐
│  ToolPalette    │  User selects category, clicks tool
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ToolDrawer     │  User configures parameters
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ToolExecutor   │  Validates, calls API, handles errors
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ResultHandler  │  Formats result, creates preview
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ResultPreview  │  Shows comparison, offers actions
└────────┬────────┘
         │
         ▼
User Action (Apply, Copy, Chain, Discard)
```

---

## 4. Tool Registry Specification

### 4.1 ToolDefinition Interface

```typescript
interface ToolDefinition {
  // Identity
  id: string;                          // Unique identifier (kebab-case)
  name: string;                        // Display name
  description: string;                 // Short description for UI
  longDescription?: string;            // Detailed description for help

  // Classification
  category: ToolCategory;              // One of the 5 categories
  tier: UserTier;                      // Required subscription tier
  availableIn: InterfaceId[];          // Which interfaces support this tool

  // UI
  icon: string;                        // Emoji or icon identifier
  color?: string;                      // Accent color for tool card

  // Parameters
  parameters: ParameterDefinition[];   // Ordered list of parameters

  // Behavior
  inputType: 'text' | 'selection' | 'none';  // What input is required
  outputType: 'text' | 'analysis' | 'asset' | 'session';
  supportsStreaming?: boolean;         // Can stream results

  // Execution
  endpoint: string;                    // API endpoint path
  apiTarget: 'npe' | 'post-social' | 'local';  // Which backend

  // Optional hooks
  validateInput?: (input: string) => ValidationResult;
  formatResult?: (raw: any) => ToolResult;
  getDefaultParameters?: (context: ToolContext) => Record<string, any>;
}

type ToolCategory = 'analysis' | 'transformation' | 'extraction' | 'generation' | 'publishing';
type UserTier = 'free' | 'pro' | 'premium' | 'admin';
type InterfaceId = 'narrative-studio' | 'post-social' | 'all';
```

### 4.2 ParameterDefinition Interface

```typescript
interface ParameterDefinition {
  name: string;                        // Parameter key
  label: string;                       // Display label
  type: ParameterType;                 // Input type
  required?: boolean;                  // Is this required?
  default?: any;                       // Default value

  // Type-specific options
  options?: ParameterOption[];         // For 'select' type
  min?: number;                        // For 'number' type
  max?: number;                        // For 'number' type
  step?: number;                       // For 'slider' type
  placeholder?: string;                // For 'text' type

  // Dynamic options
  optionsFrom?: string;                // API endpoint to fetch options
  dependsOn?: string;                  // Show only when another param has value

  // Help
  description?: string;                // Tooltip text
  helpUrl?: string;                    // Link to documentation
}

type ParameterType =
  | 'text'           // Free text input
  | 'textarea'       // Multi-line text
  | 'number'         // Numeric input
  | 'slider'         // Range slider
  | 'boolean'        // Checkbox/toggle
  | 'select'         // Dropdown single select
  | 'multi-select'   // Dropdown multi select
  | 'persona'        // Persona picker (fetches from API)
  | 'style'          // Style picker (fetches from API)
  | 'language'       // Language picker
  | 'node'           // Node picker (post-social only)
  ;

interface ParameterOption {
  value: string;
  label: string;
  description?: string;
  tier?: UserTier;     // Option only available at this tier
}
```

### 4.3 ToolResult Interface

```typescript
interface ToolResult {
  success: boolean;
  toolId: string;

  // Timing
  startedAt: number;
  completedAt: number;
  durationMs: number;

  // For transformation tools
  originalText?: string;
  transformedText?: string;

  // For analysis tools
  analysis?: {
    verdict?: string;
    confidence?: number;
    scores?: Record<string, number>;
    highlights?: Highlight[];
    details?: any;
  };

  // For extraction tools
  extractedAsset?: {
    type: 'persona' | 'style';
    name: string;
    definition: any;
    saved?: boolean;
    assetId?: string;
  };

  // For generation tools
  generatedContent?: string;

  // For session-based tools (maieutic)
  session?: {
    sessionId: string;
    state: any;
    isComplete: boolean;
  };

  // Metadata
  tokensUsed?: number;
  model?: string;
  cached?: boolean;

  // Errors
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface Highlight {
  start: number;
  end: number;
  type: string;
  label?: string;
  score?: number;
}
```

### 4.4 Example Tool Registration

```typescript
// registry/tools/humanizer.ts
import { ToolDefinition } from '../../types/tools';

export const humanizerTool: ToolDefinition = {
  id: 'humanizer',
  name: 'Humanizer',
  description: 'Remove AI patterns and improve naturalness',
  longDescription: `
    The Humanizer tool analyzes text for common AI-generated patterns
    and rewrites it to sound more natural and human-written. Choose
    intensity based on how much you want the text modified.
  `,

  category: 'transformation',
  tier: 'free',
  availableIn: ['all'],

  icon: '🎭',
  color: '#10b981',

  parameters: [
    {
      name: 'intensity',
      label: 'Intensity',
      type: 'select',
      required: true,
      default: 'moderate',
      options: [
        { value: 'light', label: 'Light', description: 'Minimal changes, preserve most structure' },
        { value: 'moderate', label: 'Moderate', description: 'Balanced rewriting' },
        { value: 'aggressive', label: 'Aggressive', description: 'Heavy rewriting for maximum naturalness' },
      ],
    },
    {
      name: 'enableLLMPolish',
      label: 'LLM Polish',
      type: 'boolean',
      default: true,
      description: 'Use AI to refine the final output',
    },
    {
      name: 'voiceSamples',
      label: 'Voice Samples',
      type: 'textarea',
      required: false,
      placeholder: 'Paste examples of your writing style...',
      description: 'Optional: provide samples to match your voice',
    },
  ],

  inputType: 'text',
  outputType: 'text',
  supportsStreaming: false,

  endpoint: '/transformations/computer-humanizer',
  apiTarget: 'npe',

  validateInput: (input) => {
    if (input.length < 50) {
      return { valid: false, error: 'Text must be at least 50 characters' };
    }
    if (input.length > 10000) {
      return { valid: false, error: 'Text must be under 10,000 characters' };
    }
    return { valid: true };
  },

  formatResult: (raw) => ({
    success: true,
    toolId: 'humanizer',
    transformedText: raw.humanizedText,
    analysis: {
      scores: {
        baseline: raw.baseline,
        final: raw.final,
        improvement: raw.improvement,
      },
    },
    tokensUsed: raw.tokensUsed,
  }),
};
```

---

## 5. UI Component Library

### 5.1 Component Hierarchy

```
ToolPalette
├── CategoryTabs
│   └── CategoryTab (one per category)
├── ToolGrid
│   └── ToolCard (one per tool in category)
└── ToolDrawer (slides in when tool selected)
    ├── ToolHeader
    ├── ParameterList
    │   └── ParameterInput (one per parameter)
    ├── ExecuteButton
    └── ResultPreview (after execution)
        ├── ComparisonView (for transformations)
        ├── AnalysisView (for analysis tools)
        ├── AssetPreview (for extractions)
        └── ActionBar
            ├── ApplyButton
            ├── CopyButton
            ├── ChainButton
            └── DiscardButton
```

### 5.2 ToolPalette Component

The main container that orchestrates tool selection and execution.

**Props:**
```typescript
interface ToolPaletteProps {
  // Content to transform
  content: string;

  // Available interfaces filter
  interfaceId: InterfaceId;

  // User tier for filtering tools
  userTier: UserTier;

  // Callbacks
  onApplyResult: (result: ToolResult) => void;
  onChainTool: (result: ToolResult, nextToolId: string) => void;

  // Optional customization
  defaultCategory?: ToolCategory;
  hiddenTools?: string[];
  additionalTools?: ToolDefinition[];  // Interface-specific tools

  // Styling
  className?: string;
}
```

**Behavior:**
1. Shows category tabs at top
2. Shows tool grid for selected category
3. Filters tools by `interfaceId` and `userTier`
4. Opens ToolDrawer when tool clicked
5. Manages execution state
6. Passes results to parent via callbacks

### 5.3 ToolCard Component

A clickable card representing a single tool.

**Props:**
```typescript
interface ToolCardProps {
  tool: ToolDefinition;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;  // e.g., "Requires Pro subscription"
  onClick: () => void;
}
```

**States:**
- Default: Clickable, shows icon + name
- Hover: Shows description tooltip
- Selected: Highlighted, drawer open
- Disabled: Grayed out, shows lock icon for tier-locked

### 5.4 ToolDrawer Component

Slide-out panel for configuring and executing a tool.

**Props:**
```typescript
interface ToolDrawerProps {
  tool: ToolDefinition;
  content: string;

  // Parameter state
  parameters: Record<string, any>;
  onParameterChange: (name: string, value: any) => void;

  // Execution
  onExecute: () => void;
  isExecuting: boolean;

  // Result
  result: ToolResult | null;

  // Actions
  onApply: () => void;
  onCopy: () => void;
  onChain: (nextToolId: string) => void;
  onDiscard: () => void;
  onClose: () => void;
}
```

**Sections:**
1. **Header**: Tool name, description, close button
2. **Parameters**: Dynamic form based on tool.parameters
3. **Execute Button**: With loading state
4. **Result Area**: Shows after execution completes

### 5.5 ParameterInput Component

Renders the appropriate input for a parameter type.

**Props:**
```typescript
interface ParameterInputProps {
  parameter: ParameterDefinition;
  value: any;
  onChange: (value: any) => void;
  disabled: boolean;
  error?: string;
}
```

**Renders based on `parameter.type`:**
- `text` → `<input type="text">`
- `textarea` → `<textarea>`
- `number` → `<input type="number">`
- `slider` → `<input type="range">`
- `boolean` → `<input type="checkbox">` or toggle
- `select` → `<select>` or custom dropdown
- `persona` → PersonaPicker (fetches from API)
- `style` → StylePicker (fetches from API)
- `language` → LanguagePicker (static list)

### 5.6 ResultPreview Component

Shows tool execution results with available actions.

**Props:**
```typescript
interface ResultPreviewProps {
  result: ToolResult;
  originalContent: string;

  // View mode for transformations
  viewMode: 'side-by-side' | 'unified' | 'diff';
  onViewModeChange: (mode: string) => void;

  // Actions
  actions: ResultAction[];
  onAction: (action: ResultAction) => void;
}

type ResultAction = 'apply' | 'copy' | 'chain' | 'discard' | 'save-asset';
```

**Views based on `result.outputType`:**
- `text` → Side-by-side or diff comparison
- `analysis` → Scores, charts, highlighted text
- `asset` → Asset preview with save option
- `session` → Conversational UI

---

## 6. API Contracts

### 6.1 npe-api Endpoints

All transformation and analysis tools call npe-api at:
- Production: `https://npe-api.tem-527.workers.dev`
- Local: `http://localhost:8787`

**Authentication:**
```
Authorization: Bearer <jwt-token>
```

**Standard Request Format:**
```typescript
interface TransformRequest {
  text: string;
  [parameterName: string]: any;
}
```

**Standard Response Format:**
```typescript
interface TransformResponse {
  // Varies by endpoint, but typically includes:
  transformedText?: string;  // For transformations
  analysis?: any;            // For analysis tools

  // Metadata
  processingTime?: number;
  tokensUsed?: number;
  model?: string;
}
```

**Error Response:**
```typescript
interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}
```

### 6.2 post-social-api Endpoints

Publishing tools call post-social-api at:
- Production: `https://post-social-api.tem-527.workers.dev`
- Local: `http://localhost:8788`

**Key Endpoints:**
```
POST /api/curator/analyze         - Content analysis
POST /api/curator/suggest-tags    - Tag suggestions
POST /api/nodes/:id/publish-chapters - Chapter publishing
POST /api/synthesis/create        - Create synthesis
```

### 6.3 Service Client Interface

```typescript
interface ToolApiClient {
  // Execute a tool
  execute(
    toolId: string,
    input: string,
    parameters: Record<string, any>,
    options?: ExecuteOptions
  ): Promise<ToolResult>;

  // Fetch dynamic options (personas, styles, etc.)
  getOptions(
    optionType: 'personas' | 'styles' | 'languages' | 'nodes',
    filter?: Record<string, any>
  ): Promise<ParameterOption[]>;

  // For session-based tools
  startSession(toolId: string, input: string): Promise<SessionState>;
  continueSession(sessionId: string, response: string): Promise<SessionState>;
  endSession(sessionId: string): Promise<void>;
}

interface ExecuteOptions {
  timeout?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}
```

---

## 7. State Management

### 7.1 Tool State Shape

Each interface maintains tool state with this shape:

```typescript
interface ToolState {
  // Current selection
  selectedCategory: ToolCategory | null;
  selectedToolId: string | null;

  // Parameter values (persisted per tool)
  parameterValues: Record<string, Record<string, any>>;
  // e.g., { 'humanizer': { intensity: 'moderate', enableLLMPolish: true } }

  // Execution state
  isExecuting: boolean;
  currentResult: ToolResult | null;
  resultHistory: ToolResult[];

  // Error state
  error: string | null;
}
```

### 7.2 Actions

```typescript
type ToolAction =
  | { type: 'SELECT_CATEGORY'; category: ToolCategory }
  | { type: 'SELECT_TOOL'; toolId: string }
  | { type: 'SET_PARAMETER'; toolId: string; name: string; value: any }
  | { type: 'EXECUTE_START' }
  | { type: 'EXECUTE_SUCCESS'; result: ToolResult }
  | { type: 'EXECUTE_ERROR'; error: string }
  | { type: 'CLEAR_RESULT' }
  | { type: 'APPLY_RESULT' }
  | { type: 'CLOSE_DRAWER' }
  ;
```

### 7.3 Persistence

Parameter values should persist across sessions:

```typescript
// Save to localStorage
const STORAGE_KEY = 'humanizer:tool-parameters';

function persistParameters(params: Record<string, Record<string, any>>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
}

function loadParameters(): Record<string, Record<string, any>> {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}
```

---

## 8. Interface Integration

### 8.1 narrative-studio Integration

**Location**: Right panel (currently ToolsPanel)

**Changes Required:**
1. Replace `ToolsPanel.tsx` with `ToolPalette`
2. Wire `onApplyResult` to create new buffer in session
3. Add local-only tools (Quantum Reading, Voice Discovery)
4. Fetch auth token from local auth state

**Content Source:**
- Active buffer content from session context
- User can select "transform original" vs "transform active"

**Result Handling:**
- Creates new buffer in session: `buf-{n+1}-{toolId}`
- User can switch between buffers in workspace

### 8.2 post-social-ui Integration

**Location**: Right panel (currently TransformPanel + CuratorPanel)

**Changes Required:**
1. Replace `TransformPanel.tsx` with `ToolPalette`
2. Keep `CuratorPanel` for publishing-specific features
3. Add tab to switch between Tools and Curator
4. Wire `onApplyResult` to update editor content

**Content Source:**
- Editor content from EditorPanel
- Selected narrative content (read-only mode)

**Result Handling:**
- In editor mode: Replace editor content
- In read mode: Offer to create new working text

### 8.3 Future Interface Integration

Any new interface should:

1. **Import the package:**
   ```typescript
   import { ToolPalette, toolRegistry } from '@humanizer/studio-tools';
   ```

2. **Provide required context:**
   ```typescript
   <ToolPalette
     content={currentContent}
     interfaceId="new-interface-id"
     userTier={user.tier}
     onApplyResult={handleApply}
   />
   ```

3. **Register interface-specific tools (if any):**
   ```typescript
   import { registerTool } from '@humanizer/studio-tools';

   registerTool({
     id: 'interface-specific-tool',
     availableIn: ['new-interface-id'],
     // ... rest of definition
   });
   ```

4. **Handle auth token:**
   ```typescript
   import { setAuthToken } from '@humanizer/studio-tools';

   // On login
   setAuthToken(token);
   ```

---

## 9. Adding New Tools

### 9.1 Checklist

To add a new tool:

- [ ] Define tool in `registry/tools/{tool-name}.ts`
- [ ] Export from `registry/tools/index.ts`
- [ ] Add to `TOOL_REGISTRY` in `registry/tool-registry.ts`
- [ ] Implement API endpoint in npe-api or post-social-api
- [ ] Add tests for parameter validation
- [ ] Update this documentation

### 9.2 Tool Definition Template

```typescript
// registry/tools/{tool-name}.ts
import { ToolDefinition } from '../../types/tools';

export const myNewTool: ToolDefinition = {
  id: 'my-new-tool',
  name: 'My New Tool',
  description: 'Brief description of what it does',

  category: 'transformation',  // Choose appropriate category
  tier: 'free',                // Or 'pro', 'premium'
  availableIn: ['all'],        // Or specific interfaces

  icon: '🔧',

  parameters: [
    // Define parameters...
  ],

  inputType: 'text',
  outputType: 'text',

  endpoint: '/transformations/my-new-tool',
  apiTarget: 'npe',

  validateInput: (input) => {
    // Validate input text
    return { valid: true };
  },

  formatResult: (raw) => {
    // Format API response into ToolResult
    return {
      success: true,
      toolId: 'my-new-tool',
      transformedText: raw.result,
    };
  },
};
```

### 9.3 Parameter Types Reference

| Type | Use Case | UI Component |
|------|----------|--------------|
| `text` | Short text input | Input field |
| `textarea` | Long text input | Textarea |
| `number` | Numeric value | Number input |
| `slider` | Range selection | Range slider |
| `boolean` | Yes/no toggle | Checkbox/toggle |
| `select` | Single choice | Dropdown |
| `multi-select` | Multiple choices | Multi-select |
| `persona` | Persona selection | Persona picker |
| `style` | Style selection | Style picker |
| `language` | Language selection | Language picker |
| `node` | Node selection | Node picker |

---

## 10. Adding New Interfaces

### 10.1 Requirements

A new interface must:

1. **Have a unique `interfaceId`** - Register in `types/tools.ts`
2. **Provide content** - Text content to transform
3. **Handle results** - Apply, save, or display results
4. **Manage auth** - Provide JWT token for API calls

### 10.2 Integration Steps

1. **Add interface to type definitions:**
   ```typescript
   // types/tools.ts
   type InterfaceId = 'narrative-studio' | 'post-social' | 'new-interface' | 'all';
   ```

2. **Update tool availability:**
   ```typescript
   // For each tool that should be available
   availableIn: ['narrative-studio', 'post-social', 'new-interface'],
   // Or use 'all' for universal tools
   ```

3. **Implement the palette:**
   ```typescript
   import { ToolPalette } from '@humanizer/studio-tools/solid';
   // or
   import { ToolPalette } from '@humanizer/studio-tools/react';

   function MyInterface() {
     return (
       <ToolPalette
         content={content}
         interfaceId="new-interface"
         userTier={userTier}
         onApplyResult={handleApply}
       />
     );
   }
   ```

4. **Register interface-specific tools (optional):**
   ```typescript
   import { registerTool } from '@humanizer/studio-tools';

   // On app initialization
   registerTool(myInterfaceSpecificTool);
   ```

---

## 11. Security & Permissions

### 11.1 Tier Enforcement

Tools are filtered client-side by tier, but **enforcement happens server-side**.

**Client-side (UX):**
- Tools unavailable at user's tier show as disabled
- "Upgrade to Pro" message explains requirement
- Links to pricing page

**Server-side (security):**
- API validates JWT claims include required tier
- Returns 403 if tier insufficient
- Never trusts client-reported tier

### 11.2 Input Validation

All tools validate input before API call:

```typescript
// Client-side validation (UX)
const validation = tool.validateInput(input);
if (!validation.valid) {
  showError(validation.error);
  return;
}

// Server-side validation (security)
// API validates again, returns 400 on invalid input
```

### 11.3 Rate Limiting

npe-api implements rate limiting per tier:

| Tier | Requests/min | Tokens/day |
|------|--------------|------------|
| Free | 10 | 10,000 |
| Pro | 60 | 100,000 |
| Premium | 120 | Unlimited |

Client should handle 429 responses gracefully.

---

## Appendix: Tool Reference

### A.1 Analysis Tools

#### AI Detection (Lite)
- **ID**: `ai-detection-lite`
- **Endpoint**: `POST /ai-detection/lite`
- **Parameters**: `useLLMJudge` (boolean)
- **Output**: Verdict, confidence, highlights

#### AI Detection (GPTZero)
- **ID**: `ai-detection-gptzero`
- **Endpoint**: `POST /ai-detection/detect`
- **Parameters**: None
- **Output**: Verdict, confidence, sentence-level breakdown
- **Tier**: Pro

#### Quantum Reading
- **ID**: `quantum-reading`
- **Endpoint**: `POST /quantum-analysis/start`, `POST /quantum-analysis/:id/step`
- **Parameters**: None (session-based)
- **Output**: POVM measurements, density matrix evolution
- **Interface**: narrative-studio only

### A.2 Transformation Tools

#### Humanizer
- **ID**: `humanizer`
- **Endpoint**: `POST /transformations/computer-humanizer`
- **Parameters**: `intensity`, `enableLLMPolish`, `voiceSamples`
- **Output**: Transformed text, improvement scores

#### Translation
- **ID**: `translation`
- **Endpoint**: `POST /transformations/translate`
- **Parameters**: `targetLanguage`, `sourceLanguage` (optional)
- **Output**: Translated text, detected language

#### Persona
- **ID**: `persona`
- **Endpoint**: `POST /transformations/persona`
- **Parameters**: `persona` (ID or free text), `preserveLength`
- **Output**: Transformed text

#### Style
- **ID**: `style`
- **Endpoint**: `POST /transformations/style`
- **Parameters**: `style` (ID), `preserveLength`
- **Output**: Transformed text

#### Namespace
- **ID**: `namespace`
- **Endpoint**: `POST /transformations/namespace`
- **Parameters**: `namespace` (ID), `preserveLength`
- **Output**: Transformed text

#### Allegorical Projection
- **ID**: `allegorical`
- **Endpoint**: `POST /transformations/allegorical`
- **Parameters**: `persona`, `namespace`, `style`, `length_preference`
- **Output**: 5-stage transformation with reflection
- **Tier**: Premium

### A.3 Extraction Tools

#### Extract Persona
- **ID**: `extract-persona`
- **Endpoint**: `POST /transformations/extract-persona`
- **Parameters**: `bookTitle`, `author`, `chapter`, `customName`
- **Output**: Persona definition
- **Tier**: Pro

#### Extract Style
- **ID**: `extract-style`
- **Endpoint**: `POST /transformations/extract-style`
- **Parameters**: `bookTitle`, `author`, `chapter`, `customName`
- **Output**: Style definition
- **Tier**: Pro

### A.4 Generation Tools

#### Story Generation
- **ID**: `story-generation`
- **Endpoint**: `POST /story-generation/generate`
- **Parameters**: `persona`, `namespace`, `style`, `length`, `seed`
- **Output**: Generated narrative
- **Tier**: Premium
- **Interface**: narrative-studio only

#### Maieutic Dialogue
- **ID**: `maieutic`
- **Endpoint**: `POST /transformations/maieutic/start`, `/respond`
- **Parameters**: `goal` (optional)
- **Output**: Session with questions and insights
- **Interface**: narrative-studio only

### A.5 Publishing Tools

#### Pre-Publish Review
- **ID**: `pre-publish-review`
- **Endpoint**: `POST /api/curator/analyze`
- **Parameters**: `nodeId`
- **Output**: Quality scores, issues, suggestions
- **Interface**: post-social only

#### Tag Suggestions
- **ID**: `tag-suggestions`
- **Endpoint**: `POST /api/curator/suggest-tags`
- **Parameters**: None
- **Output**: Suggested tags with confidence
- **Interface**: post-social only

#### Round-Trip Analysis
- **ID**: `round-trip`
- **Endpoint**: `POST /transformations/round-trip`
- **Parameters**: `intermediate_language`
- **Output**: Forward/backward translations, semantic drift analysis

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-02 | Claude | Initial specification |

---

*End of Document*
