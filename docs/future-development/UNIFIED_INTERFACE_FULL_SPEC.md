# Humanizer Unified Interface - Design Specification

**Date**: November 14, 2025
**Version**: 1.0 (Initial Proposal)
**Status**: 🎯 Ready for Review & Refinement

---

## Executive Summary

**Goal**: Create a unified interface that combines the best of humanizer.com and Workbench into a single, streamlined knowledge work platform with an integrated Agentic User Interface (AUI).

**Key Innovations**:
1. ✨ **Adaptive Layout**: 3-column on desktop, intuitive mobile design
2. 🤖 **Agentic Chat**: Bottom-anchored LLM assistant with UI tutoring
3. 🔄 **Automatic Theming**: System-aware with manual override
4. 🎯 **Integrated Workflow**: Chat ↔ Canvas ↔ Tools ↔ Archive

---

## 1. Design Requirements (From User)

### 1.1 Theme & Mode Switching
> "I'd like the humanizer.com design with full page automatic mode switching (with manual icon switching available)"

**Requirements**:
- ✅ Automatic light/dark mode based on system preferences
- ✅ Manual toggle available (sun/moon icon)
- ✅ humanizer.com visual style (CSS variables, gradient branding)
- ✅ Smooth transitions between modes

**Implementation**:
```typescript
// System preference detection
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark' : 'light';

// Manual override persists in localStorage
const userTheme = localStorage.getItem('theme-manual');
const activeTheme = userTheme || systemTheme;

// Auto-update when system changes (unless manual override within 1hr)
```

---

### 1.2 Responsive Layout Philosophy
> "I want the workbench style three-column on desktop-width screens, but ergonomic and intuitive mobile screens"

**Desktop (≥1024px)**:
```
┌─────────────────────────────────────────────────┐
│ Header: Logo | Nav Tabs | User | Theme | Help  │
├───────┬─────────────────────────┬───────────────┤
│       │                         │               │
│ Arch- │       Canvas            │  Active Tool  │
│ ive   │    (Shared Text)        │    Config     │
│  or   │                         │               │
│ Hist- │                         │   Results     │
│ ory   │                         │               │
│       │                         │               │
└───────┴─────────────────────────┴───────────────┘
│            Agentic Chat (Collapsible)           │
└─────────────────────────────────────────────────┘
```

**Tablet (768px - 1023px)**:
```
┌─────────────────────────────────────────────────┐
│ Header (Compact)                                │
├─────────────────────────┬───────────────────────┤
│                         │                       │
│       Canvas            │     Active Tool       │
│    (Main Focus)         │   (Config + Results)  │
│                         │                       │
└─────────────────────────┴───────────────────────┘
│        Agentic Chat (Collapsible)               │
└─────────────────────────────────────────────────┘

[Archive/History accessible via slide-in panel]
```

**Mobile (<768px)** - **NEW INTUITIVE DESIGN**:
```
┌─────────────────────────────────────┐
│ Header: [☰ Menu] Logo [🔧 Tools]   │
├─────────────────────────────────────┤
│                                     │
│          Canvas                     │
│      (Full Width)                   │
│                                     │
│                                     │
└─────────────────────────────────────┘
│  Agentic Chat (Always Visible)     │
│  [💬 Ask me anything...]            │
└─────────────────────────────────────┘
```

**Key Changes from Current Workbench Mobile**:
- ❌ **Remove**: Bottom-right FAB (cryptic blue button)
- ❌ **Remove**: Asymmetric access (hamburger left, FAB right)
- ✅ **Add**: Symmetric dual-button header (☰ Menu | 🔧 Tools)
- ✅ **Add**: Always-visible chat bar at bottom
- ✅ **Add**: Chat can open archive/tools via natural language

**Example Mobile Interactions**:
- User: "Show me my archive" → Chat opens Archive panel
- User: "I want to transform this text" → Chat opens Tools panel
- User: "How do I use Allegorical?" → Chat highlights relevant UI + explains

---

### 1.3 Agentic User Interface (AUI)
> "I want a not-yet-designed agent chat at the bottom... an LLM Chat that can do general-purpose chatting about content anywhere on the screen"

**Core Capabilities**:
1. 🤖 **General Chat**: Answer questions about content, features, workflows
2. 🎓 **UI Tutoring**: Highlight and explain interface features
3. 🔗 **Content Integration**: Access canvas, archives, transformations
4. 🔑 **BYOK (Bring Your Own Key)**: User API keys for custom LLMs
5. 💬 **Transformation Input**: Chat output → Canvas or Tool input

**Visual Design** (Bottom Panel):

**Collapsed State** (Default):
```
┌─────────────────────────────────────────────────┐
│ 💬 Ask me anything... [Powered by Claude]  [↑] │
└─────────────────────────────────────────────────┘
```

**Expanded State** (Click to expand):
```
┌─────────────────────────────────────────────────┐
│ Agentic Chat                    [Models ▾] [─] │
├─────────────────────────────────────────────────┤
│ 🤖 Hi! I can help you with:                    │
│    • Understanding your content                 │
│    • Using transformation tools                 │
│    • Finding items in your archive              │
│    • Optimizing your workflow                   │
├─────────────────────────────────────────────────┤
│ User: How do I make this text sound less AI?   │
│ Agent: I can help! I see you have text in the  │
│        canvas. Let me highlight the Computer    │
│        Humanizer tool... [🖥️ Highlighted]      │
│        Click "Humanize Text" to reduce AI       │
│        detection signals.                       │
│ User: Great, do that for me                     │
│ Agent: ✅ Running Computer Humanizer...         │
│        [Progress bar]                           │
│        Done! Results in right panel. Would you  │
│        like me to explain the improvements?     │
├─────────────────────────────────────────────────┤
│ [Type a message...] [📎 Attach] [🎤] [Send]    │
└─────────────────────────────────────────────────┘
```

**Features**:
- ✅ Collapsible (click to expand/collapse)
- ✅ Draggable height (resize vertically)
- ✅ Model selector (Claude, GPT-4, User's API keys)
- ✅ Context-aware (sees canvas, active tool, archive)
- ✅ Action execution (can trigger transformations)
- ✅ UI highlighting (tutorial mode)

---

## 2. Navigation Design

### 2.1 Top Navigation Bar (Desktop)

**Adopting humanizer.com style with workbench tools**:

```
┌────────────────────────────────────────────────────────────────┐
│ humanizer.com | [🖥️ Computer] [🌟 Allegorical] [🔍 AI Detection] │
│                                                                │
│               [demo@humanizer.com] [☀️/🌙] [❓ Help] [Logout] │
└────────────────────────────────────────────────────────────────┘
```

**Breakdown**:
- **Left**: Brand logo (gradient, clickable → home)
- **Center**: Tool tabs (horizontal, active = purple bg)
- **Right**: User menu (email, theme toggle, help, logout)

**Active Tool Indication**:
```css
.tool-tab {
  background: transparent;
  color: var(--text-secondary);
}

.tool-tab.active {
  background: var(--accent-purple);
  color: white;
  border-radius: 6px;
}
```

---

### 2.2 Mobile Navigation (NEW DESIGN)

**Header** (Symmetric dual-button):
```
┌─────────────────────────────────────┐
│ [☰]  humanizer.com          [🔧]   │
└─────────────────────────────────────┘
```

**Left Button (☰ Menu)**:
- Opens slide-in panel from left
- **Contents**:
  - 🗄️ Archive (encrypted conversations)
  - 📚 History (past transformations)
  - 🎭 Voice Manager
  - ⚙️ Settings
  - 👤 Account (user@email.com)
  - 🌙/☀️ Theme toggle
  - ❓ Help
  - 🚪 Logout

**Right Button (🔧 Tools)**:
- Opens slide-in panel from right
- **Contents**:
  - 🖥️ Computer Humanizer
  - 🌟 Allegorical
  - 🔍 AI Detection
  - *(Active tool shown with highlight)*

**Panels**:
- Slide in with smooth animation (300ms)
- Overlay darkens background (50% opacity)
- Swipe or tap outside to close
- **Symmetric**: Both panels same width (80% screen)

**Chat Bar** (Always visible at bottom):
```
┌─────────────────────────────────────┐
│ 💬 Ask me anything...          [↑] │
└─────────────────────────────────────┘
```

---

## 3. Layout Specifications

### 3.1 Desktop Grid (≥1024px)

```css
.workbench-grid {
  display: grid;
  grid-template-columns: 300px 1fr 380px;
  grid-template-rows: 1fr auto;
  gap: 16px;
  padding: 16px;
  height: calc(100vh - 60px); /* 60px = header */
}

.left-panel {
  grid-column: 1;
  grid-row: 1;
  /* Archive or History */
}

.center-panel {
  grid-column: 2;
  grid-row: 1;
  /* Canvas (shared text) */
}

.right-panel {
  grid-column: 3;
  grid-row: 1;
  /* Active tool config + results */
}

.bottom-panel {
  grid-column: 1 / -1; /* Span all columns */
  grid-row: 2;
  /* Agentic Chat (collapsible) */
}
```

**Measurements**:
- Left: 300px (Archive/History)
- Center: Flexible (Canvas - primary focus)
- Right: 380px (Tool panel)
- Bottom: 60px collapsed, 300-600px expanded (resizable)

---

### 3.2 Tablet Grid (768px - 1023px)

```css
.workbench-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  grid-template-rows: 1fr auto;
  gap: 12px;
  padding: 12px;
}

/* Left panel hidden, accessible via slide-in */
.center-panel {
  grid-column: 1;
  grid-row: 1;
}

.right-panel {
  grid-column: 2;
  grid-row: 1;
}

.bottom-panel {
  grid-column: 1 / -1;
  grid-row: 2;
}
```

---

### 3.3 Mobile Layout (<768px)

```css
.workbench-grid {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.mobile-header {
  height: 56px;
  flex-shrink: 0;
}

.center-panel {
  flex: 1;
  overflow-y: auto;
}

.bottom-panel {
  flex-shrink: 0;
  height: 60px; /* Collapsed */
}

.bottom-panel.expanded {
  height: 50vh; /* Expanded to half screen */
}
```

**No sliding panels for Canvas** - Canvas always visible (primary focus)
**Sliding panels for**: Archive/History (left) and Tools (right)

---

## 4. Agentic Chat - Technical Architecture

### 4.1 Chat Component Structure

```typescript
interface AgenticChatProps {
  // Access to application state
  canvasText: string;
  activeToolId: string | null;
  archiveItems: EncryptedConversation[];
  transformationHistory: Transformation[];

  // Callbacks for actions
  onLoadToCanvas: (text: string) => void;
  onSelectTool: (toolId: string) => void;
  onRunTransformation: (toolId: string, params: any) => void;
  onHighlightUI: (elementId: string, message: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ChatAction[]; // Executable actions
  uiHighlights?: UIHighlight[]; // UI elements to highlight
}

interface ChatAction {
  type: 'load_canvas' | 'run_tool' | 'open_archive' | 'show_history';
  label: string; // "Load to Canvas", "Run Transformation"
  params: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface UIHighlight {
  elementId: string; // CSS selector or data-id
  message: string;
  type: 'tooltip' | 'spotlight' | 'arrow';
  duration: number; // milliseconds
}
```

---

### 4.2 Chat Backend Architecture

**Option A: Serverless (Cloudflare Workers)**
```
Client → Cloudflare Worker → User's LLM API or Claude
                           → D1 Database (chat history)
                           → R2 Storage (context snapshots)
```

**Pros**:
- ✅ No server infrastructure
- ✅ Scales automatically
- ✅ Low latency (edge compute)
- ✅ Existing stack (already on Cloudflare)

**Cons**:
- ❌ Limited WebSocket support (Durable Objects needed)
- ❌ 30-second timeout (long responses may fail)

---

**Option B: Streaming with SSE (Server-Sent Events)**
```
Client ← SSE Stream ← Cloudflare Worker → LLM API
                                        → Stream responses
```

**Pros**:
- ✅ Real-time streaming (token-by-token)
- ✅ Works with Cloudflare Workers
- ✅ Handles long responses
- ✅ No WebSocket complexity

**Cons**:
- ❌ One-way communication (client → server requires separate POST)

**Recommended**: **Option B (SSE Streaming)**

---

### 4.3 Chat Context Management

**Context Window Strategy**:
```typescript
interface ChatContext {
  // Always included
  canvasText: string | null;
  activeToolId: string | null;

  // Included on demand
  archiveSnapshot?: {
    count: number;
    recentTitles: string[];
  };

  historySnapshot?: {
    count: number;
    recentTransformations: string[];
  };

  // User-selected context
  selectedArchiveItem?: EncryptedConversation;
  selectedTransformation?: Transformation;
}

// Build system prompt
const systemPrompt = `
You are an AI assistant integrated into humanizer.com, a knowledge work platform.

Current Context:
- Canvas text: ${context.canvasText ? 'Yes (' + context.canvasText.length + ' chars)' : 'No'}
- Active tool: ${context.activeToolId || 'None'}
- Archive items: ${context.archiveSnapshot?.count || 0}

Capabilities:
1. Answer questions about the user's content
2. Explain how to use transformation tools
3. Execute transformations on request
4. Search and retrieve archive items
5. Highlight and explain UI features

When explaining UI features, use this format:
[HIGHLIGHT:element-id:message]
Example: [HIGHLIGHT:computer-humanizer-btn:Click this to reduce AI detection]

When executing actions, use this format:
[ACTION:type:params]
Example: [ACTION:run_tool:computer-humanizer]
`;
```

---

### 4.4 Chat Actions (Executable Commands)

**Action Parser**:
```typescript
function parseActions(response: string): ChatAction[] {
  const actionPattern = /\[ACTION:(\w+):([^\]]+)\]/g;
  const actions: ChatAction[] = [];

  let match;
  while (match = actionPattern.exec(response)) {
    const [_, type, paramsStr] = match;
    actions.push({
      type: type as any,
      params: parseParams(paramsStr),
      label: getActionLabel(type),
      status: 'pending'
    });
  }

  return actions;
}

// Available actions
const ACTION_HANDLERS = {
  'run_tool': async (params: { toolId: string }) => {
    // Trigger transformation
    await runTransformation(params.toolId);
  },

  'load_canvas': async (params: { text: string }) => {
    // Load text to canvas
    setCanvasText(params.text);
  },

  'open_archive': async (params: { filter?: string }) => {
    // Open archive panel with optional filter
    openArchive(params.filter);
  },

  'highlight_ui': async (params: { elementId: string, message: string }) => {
    // Highlight UI element with tooltip
    highlightElement(params.elementId, params.message);
  }
};
```

---

### 4.5 UI Tutorial System

**Highlight Component**:
```typescript
interface UIHighlightProps {
  elementId: string; // CSS selector
  message: string;
  type: 'tooltip' | 'spotlight' | 'arrow';
  onDismiss: () => void;
}

function UIHighlight({ elementId, message, type }: UIHighlightProps) {
  const targetEl = document.querySelector(elementId);
  const rect = targetEl?.getBoundingClientRect();

  if (!rect) return null;

  return (
    <>
      {/* Spotlight overlay */}
      {type === 'spotlight' && (
        <div className="fixed inset-0 bg-black/70 pointer-events-none">
          {/* SVG cutout for target element */}
          <svg className="absolute inset-0">
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - 8}
                y={rect.top - 8}
                width={rect.width + 16}
                height={rect.height + 16}
                rx="8"
                fill="black"
              />
            </mask>
            <rect
              width="100%"
              height="100%"
              fill="black"
              mask="url(#spotlight-mask)"
            />
          </svg>
        </div>
      )}

      {/* Tooltip */}
      <div
        className="absolute z-50 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg"
        style={{
          top: rect.bottom + 12,
          left: rect.left,
          maxWidth: '300px'
        }}
      >
        {message}
        <div className="absolute -top-2 left-4 w-4 h-4 bg-purple-600 rotate-45" />
      </div>
    </>
  );
}
```

**Tutorial Flow Example**:
```typescript
// User asks: "How do I humanize AI text?"
const tutorialSteps: UIHighlight[] = [
  {
    elementId: '[data-tool-id="computer-humanizer"]',
    message: 'Step 1: Click the Computer Humanizer tool',
    type: 'spotlight'
  },
  {
    elementId: '#intensity-slider',
    message: 'Step 2: Choose intensity (moderate is recommended)',
    type: 'arrow'
  },
  {
    elementId: '#humanize-button',
    message: 'Step 3: Click "Humanize Text" to process',
    type: 'spotlight'
  }
];

// Show one at a time with user interaction
```

---

## 5. BYOK (Bring Your Own Key) Feature

### 5.1 User Settings

**Settings Panel**:
```typescript
interface UserAPIKey {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  label: string; // User-friendly name
  keyPrefix: string; // First 8 chars (for identification)
  encryptedKey: string; // AES-256 encrypted
  createdAt: Date;
  lastUsed: Date | null;
}

interface ChatSettings {
  defaultModel: string;
  apiKeys: UserAPIKey[];
  maxTokens: number;
  temperature: number;
  streamResponses: boolean;
}
```

**Settings UI**:
```
┌──────────────────────────────────────────┐
│ Chat Settings                            │
├──────────────────────────────────────────┤
│ Default Model:                           │
│ [Claude 3.5 Sonnet (Humanizer) ▾]       │
│                                          │
│ Your API Keys (Pro Feature)              │
│ ┌────────────────────────────────────┐  │
│ │ OpenAI GPT-4                       │  │
│ │ Key: sk-proj-...a7f2 (8 uses)     │  │
│ │ [Edit] [Remove]                    │  │
│ └────────────────────────────────────┘  │
│ ┌────────────────────────────────────┐  │
│ │ Anthropic Claude Opus              │  │
│ │ Key: sk-ant-...x9z1 (2 uses)      │  │
│ │ [Edit] [Remove]                    │  │
│ └────────────────────────────────────┘  │
│                                          │
│ [+ Add API Key]                          │
│                                          │
│ Advanced:                                │
│ ☑ Stream responses                       │
│ Temperature: [0.7] ────────○────         │
│ Max tokens: [4000]                       │
└──────────────────────────────────────────┘
```

---

### 5.2 Key Security

**Encryption Strategy**:
```typescript
// Client-side encryption before sending to server
async function encryptAPIKey(apiKey: string, userPassword: string): Promise<string> {
  // Derive encryption key from user password
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt API key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    new TextEncoder().encode(apiKey)
  );

  // Return base64(salt + iv + encrypted)
  return btoa(
    String.fromCharCode(...salt, ...iv, ...new Uint8Array(encrypted))
  );
}

// Decrypt only when needed for API call
async function decryptAPIKey(encryptedKey: string, userPassword: string): Promise<string> {
  // Reverse process
  // ...
}
```

**Storage**:
```sql
-- D1 Database
CREATE TABLE user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  encrypted_key TEXT NOT NULL, -- AES-256 encrypted
  key_prefix TEXT NOT NULL, -- First 8 chars for UI
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Usage**:
```typescript
// When user selects custom model
const selectedKey = userKeys.find(k => k.id === selectedKeyId);
const decryptedKey = await decryptAPIKey(selectedKey.encryptedKey, userPassword);

// Make API call with user's key
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: {
    'Authorization': `Bearer ${decryptedKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
});
```

---

## 6. Chat ↔ Transformations Integration

### 6.1 Use Cases

**1. Chat Output → Canvas**
```
User: "Write me an introduction about quantum computing"
Agent: [Generates 200 word intro]
       [ACTION:load_canvas:Generated text]
       ✅ Loaded to canvas. Would you like to transform it?
```

**2. Chat → Run Transformation**
```
User: "Make this text less AI-sounding"
Agent: [Detects canvas has text]
       [ACTION:run_tool:computer-humanizer]
       🖥️ Running Computer Humanizer...
       ✅ Done! AI confidence dropped from 78% → 32%
```

**3. Archive Search → Canvas**
```
User: "Find my conversation about narrative phenomenology"
Agent: [Searches archive]
       Found 3 conversations:
       1. "Husserl's Phenomenology" (Nov 10)
       2. "Narrative Identity Theory" (Nov 8)
       3. "First-Person Perspective" (Nov 5)

       [Load #1] [Load #2] [Load #3]
```

**4. Transformation Chaining**
```
User: "Detect AI, then humanize if needed"
Agent: [ACTION:run_tool:ai-detection]
       📊 AI Detection: 85% confidence (HIGH)

       This text is likely AI-generated. Running humanizer...
       [ACTION:run_tool:computer-humanizer]

       ✅ Humanized! New AI confidence: 28%
       Would you like me to check it again?
```

---

### 6.2 Chat Context Window Management

**Problem**: LLM context limits (typically 4k-128k tokens)

**Solution**: Selective context inclusion
```typescript
interface ChatContextStrategy {
  // Always included (small)
  systemPrompt: string; // ~500 tokens
  userQuery: string; // ~50-200 tokens

  // Conditionally included
  canvasText?: string; // Up to 2000 tokens (truncate if longer)
  archiveSummary?: string; // Top 5 recent items
  historyRecent?: string; // Last 3 transformations

  // Retrieved on-demand (RAG style)
  relevantDocs?: string[]; // Search archive/history
}

function buildContext(query: string, strategy: ChatContextStrategy): string {
  let context = strategy.systemPrompt + '\n\n';

  // Add canvas if referenced
  if (query.includes('this text') || query.includes('canvas')) {
    context += `Canvas text:\n${truncate(strategy.canvasText, 2000)}\n\n`;
  }

  // Add archive if searching
  if (query.includes('find') || query.includes('search')) {
    context += `Archive summary:\n${strategy.archiveSummary}\n\n`;
  }

  // Add user query
  context += `User: ${query}`;

  return context;
}
```

---

### 6.3 Transformation Result Analysis

**After transformation completes, chat can analyze**:
```typescript
// Computer Humanizer completes
onTransformationComplete((result: HumanizationResult) => {
  // Auto-generate analysis message
  const analysisMessage = {
    role: 'assistant',
    content: `
✅ Transformation complete!

**Results**:
- AI Confidence: ${result.baseline.detection.confidence}% → ${result.final.detection.confidence}%
- Improvement: -${result.improvement.aiConfidenceDrop} points
- Burstiness: +${result.improvement.burstinessIncrease} points
- Tell-words removed: ${result.improvement.tellWordsRemoved}

**My Analysis**:
${analyzeImprovement(result)}

**Next Steps**:
- [Copy to Clipboard] [Run Again] [Try Allegorical] [Ask Questions]
    `
  };

  addChatMessage(analysisMessage);
});

function analyzeImprovement(result: HumanizationResult): string {
  const drop = result.improvement.aiConfidenceDrop;

  if (drop >= 50) {
    return "Excellent! This text now reads much more naturally. The AI detection score dropped significantly.";
  } else if (drop >= 30) {
    return "Good improvement. The text is more natural, though you might want to try aggressive mode for better results.";
  } else if (drop >= 10) {
    return "Modest improvement. The text was already fairly natural, or you might need a stronger transformation.";
  } else {
    return "Minimal change. This text might already be human-written, or the AI patterns are deeply embedded.";
  }
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: Unified layout with automatic theming

**Tasks**:
1. ✅ Create new `humanizer-unified` directory
2. ✅ Set up Vite + React + Tailwind + TypeScript
3. ✅ Implement responsive grid layout (desktop/tablet/mobile)
4. ✅ Port humanizer.com theme system (CSS variables)
5. ✅ Implement automatic light/dark mode switching
6. ✅ Create symmetric mobile navigation (☰ Menu | 🔧 Tools)
7. ✅ Test on multiple screen sizes

**Deliverable**: Working layout with no tools yet

---

### Phase 2: Tool Integration (Week 3-4)
**Goal**: Port working tools from workbench

**Tasks**:
1. ✅ Port CanvasContext (shared text state)
2. ✅ Port Computer Humanizer tool
3. ✅ Port Allegorical Transformation tool
4. ✅ Port AI Detection tool
5. ✅ Implement tool registry + routing
6. ✅ Create unified tool panel (right column)
7. ✅ Test transformations end-to-end

**Deliverable**: 3 working tools in new layout

---

### Phase 3: Archive & History (Week 5-6)
**Goal**: Left panel content

**Tasks**:
1. ✅ Port Archive browser (encrypted conversations)
2. ✅ Port Transformation History
3. ✅ Implement Archive ↔ Canvas interaction
4. ✅ Implement History → Tool loading
5. ✅ Create toggle between Archive/History views
6. ✅ Test archive upload and decryption

**Deliverable**: Full left panel functionality

---

### Phase 4: Agentic Chat - Basic (Week 7-8)
**Goal**: Bottom chat panel with basic capabilities

**Tasks**:
1. ✅ Create collapsible bottom panel UI
2. ✅ Implement chat message display (bubbles)
3. ✅ Connect to Claude API (Humanizer's key)
4. ✅ Implement SSE streaming for responses
5. ✅ Add context awareness (canvas, active tool)
6. ✅ Basic action parsing ([ACTION:...])
7. ✅ Implement simple actions (load_canvas, run_tool)

**Deliverable**: Working chat that can answer questions and execute basic actions

---

### Phase 5: UI Tutoring System (Week 9-10)
**Goal**: Chat can highlight and explain UI

**Tasks**:
1. ✅ Create UIHighlight component (spotlight/tooltip/arrow)
2. ✅ Implement [HIGHLIGHT:...] parsing
3. ✅ Add data-id attributes to all UI elements
4. ✅ Create tutorial flow system (multi-step highlights)
5. ✅ Write tutorial prompts (system prompt additions)
6. ✅ Test with common user questions

**Deliverable**: Chat can teach users how to use the interface

---

### Phase 6: BYOK (Bring Your Own Key) (Week 11-12)
**Goal**: Users can add their own LLM API keys

**Tasks**:
1. ✅ Create Settings panel UI
2. ✅ Implement client-side key encryption
3. ✅ Create API key management (add/edit/remove)
4. ✅ Add D1 database table for encrypted keys
5. ✅ Implement model selector dropdown
6. ✅ Add usage tracking (last used, count)
7. ✅ Create pricing tier check (Pro feature)

**Deliverable**: Pro users can use their own API keys

---

### Phase 7: Advanced Integrations (Week 13-14)
**Goal**: Deep chat ↔ transformation integration

**Tasks**:
1. ✅ Implement transformation chaining via chat
2. ✅ Add archive search via chat
3. ✅ Implement automatic result analysis
4. ✅ Create chat memory (RAG for conversation history)
5. ✅ Add file upload to chat (analyze documents)
6. ✅ Implement "Export conversation" feature

**Deliverable**: Fully integrated agentic experience

---

### Phase 8: Polish & Launch (Week 15-16)
**Goal**: Production-ready unified interface

**Tasks**:
1. ✅ Comprehensive testing (all features)
2. ✅ Mobile UX refinement
3. ✅ Performance optimization (code splitting, lazy loading)
4. ✅ Error handling and edge cases
5. ✅ User documentation (help panel, tutorials)
6. ✅ Analytics integration
7. ✅ Beta user testing and feedback
8. ✅ Production deployment

**Deliverable**: Launch Humanizer Unified v1.0

---

## 8. Technical Challenges & Solutions

### Challenge 1: Chat Context Limits
**Problem**: LLMs have limited context windows (4k-128k tokens)

**Solutions**:
- ✅ Selective context inclusion (only what's needed)
- ✅ Text truncation for long canvas content
- ✅ RAG (Retrieval Augmented Generation) for archive search
- ✅ Conversation summarization for long chats

---

### Challenge 2: Real-time Streaming
**Problem**: Cloudflare Workers have 30s timeout

**Solutions**:
- ✅ Use SSE (Server-Sent Events) for streaming
- ✅ Chunk responses to avoid timeout
- ✅ Implement reconnection logic if stream breaks
- ✅ Show "still thinking..." indicator for long responses

---

### Challenge 3: API Key Security
**Problem**: Storing user API keys safely

**Solutions**:
- ✅ Client-side encryption (never send plaintext)
- ✅ Derive key from user password (PBKDF2)
- ✅ Store only encrypted keys in database
- ✅ Decrypt only when needed for API call
- ✅ Never log or cache decrypted keys

---

### Challenge 4: Mobile Chat UX
**Problem**: Limited screen space for chat + canvas + tools

**Solutions**:
- ✅ Collapsible chat (default collapsed)
- ✅ Chat can trigger panels (no manual opening needed)
- ✅ Swipe down to collapse chat
- ✅ Minimize when transformation running (focus on results)

---

### Challenge 5: Tutorial Highlighting
**Problem**: Overlays can block interaction

**Solutions**:
- ✅ Use SVG masks for spotlights (cutout allows clicking)
- ✅ Tooltips position dynamically (avoid covering target)
- ✅ "Next" button to advance tutorial steps
- ✅ "Skip tutorial" option always visible

---

## 9. Database Schema Updates

### New Tables for Chat

```sql
-- Chat conversations (persistent)
CREATE TABLE chat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT, -- Auto-generated from first message
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Chat messages
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Optional metadata
  token_count INTEGER,
  model_used TEXT,
  cost_usd REAL,

  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
);

-- Chat actions (for analytics)
CREATE TABLE chat_actions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'load_canvas' | 'run_tool' | etc.
  params TEXT, -- JSON
  status TEXT NOT NULL, -- 'pending' | 'completed' | 'failed'
  executed_at TIMESTAMP,

  FOREIGN KEY (message_id) REFERENCES chat_messages(id)
);

-- User API keys (encrypted)
CREATE TABLE user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 10. API Endpoints

### Chat Endpoints

```typescript
// POST /chat/message
interface SendMessageRequest {
  conversationId?: string; // Omit for new conversation
  message: string;
  context?: {
    canvasText?: string;
    activeToolId?: string;
    includeArchive?: boolean;
    includeHistory?: boolean;
  };
  modelId?: string; // User's custom model
}

interface SendMessageResponse {
  conversationId: string;
  messageId: string;
  streamUrl: string; // SSE endpoint for streaming response
}

// GET /chat/stream/:messageId
// SSE endpoint that streams response
// Events: 'token', 'action', 'highlight', 'done', 'error'

// POST /chat/action
interface ExecuteActionRequest {
  messageId: string;
  actionId: string;
}

interface ExecuteActionResponse {
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
}

// GET /chat/conversations
interface GetConversationsResponse {
  conversations: {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: Date;
  }[];
}

// DELETE /chat/conversation/:id
// Clear conversation history
```

---

## 11. Cost & Pricing Implications

### Free Tier
- ✅ Agentic chat powered by Humanizer's Claude API key
- ✅ Limited to 50 messages/day
- ✅ Access to all tools
- ❌ Cannot add own API keys

### Pro Tier ($9.99/month)
- ✅ Unlimited chat messages
- ✅ BYOK (Bring Your Own Key) - use your own LLM APIs
- ✅ Advanced features (transformation chaining, file upload)
- ✅ Priority support from chat

### Enterprise Tier ($49.99/month)
- ✅ Everything in Pro
- ✅ Team collaboration (shared archives)
- ✅ Custom model fine-tuning
- ✅ API access to chat

**Estimated Costs** (Humanizer-provided chat):
- Claude Haiku: ~$0.002 per message (50 msg = $0.10/day)
- 50 users × 50 msg/day = 2,500 msg/day = **$5/day** = **$150/month**
- Pro users using BYOK: $0 cost to Humanizer ✅

---

## 12. User Experience Flows

### Flow 1: New User Onboarding
```
1. User lands on humanizer.com
2. Sees landing page with tutorial
3. "Chat with me to get started!" (bottom bar pulsing)
4. User clicks chat
5. Agent: "Hi! I'm your AI assistant. I can help you..."
6. User: "What can I do here?"
7. Agent highlights tools and explains each
8. User: "I want to humanize AI text"
9. Agent: [Highlights Computer Humanizer] "Click here..."
10. User clicks → Paste text → Transform
11. Agent: "Great! Here's what improved..." [Analysis]
12. User: "How do I save this?"
13. Agent: "Click Archive to save encrypted..." [Highlight]
```

---

### Flow 2: Power User Workflow
```
1. User logs in
2. Desktop view: 3 columns visible
3. Left: Opens Archive → Selects conversation
4. Clicks "Load to Canvas"
5. Chat (bottom): "I see you loaded a conversation. Would you like me to summarize it?"
6. User: "Yes, then transform to allegory"
7. Chat: [Generates summary] [Loads to canvas]
         [ACTION:run_tool:allegorical]
8. Results appear in right panel
9. User reviews, asks chat to explain the transformation
10. Chat provides analysis with references to specific changes
11. User: "Save this to archive"
12. Chat: [ACTION:save_archive] "Saved! Title: ..."
```

---

### Flow 3: Mobile User
```
1. User opens on phone
2. Sees Canvas (full width) + Chat bar at bottom
3. User: "I want to check if this is AI-generated"
4. Chat: [Opens Tools panel] [Highlights AI Detection]
        "Click here to detect AI content"
5. User clicks → Results show in overlay
6. User: "It's AI. Make it more human"
7. Chat: [Switches to Computer Humanizer tool]
        [Pre-fills settings] "Click Humanize"
8. User clicks → Results overlay
9. User: "Copy to clipboard"
10. Chat: [Copies] "Copied! Anything else?"
```

---

## 13. Accessibility Considerations

### Chat Interface
- ✅ Keyboard navigation (Tab, Enter, Esc)
- ✅ Screen reader support (ARIA labels)
- ✅ Focus management (chat input, messages)
- ✅ Color contrast (WCAG AA compliant)

### UI Highlights
- ✅ Non-visual indicators (sound, vibration on mobile)
- ✅ Text descriptions of highlighted elements
- ✅ Keyboard shortcuts to navigate tutorial steps

### Mobile
- ✅ Touch targets ≥44px (iOS, Android guidelines)
- ✅ Swipe gestures with fallback buttons
- ✅ Haptic feedback for important actions

---

## 14. Analytics & Metrics

### Track for Product Insights
```typescript
interface AnalyticsEvent {
  // Chat usage
  'chat:message_sent': { conversationId: string, model: string };
  'chat:action_executed': { actionType: string, success: boolean };
  'chat:tutorial_started': { toolId?: string };
  'chat:tutorial_completed': { toolId: string, steps: number };

  // Tool usage
  'tool:selected': { toolId: string, source: 'nav' | 'chat' };
  'transformation:started': { toolId: string, source: 'manual' | 'chat' };
  'transformation:completed': { toolId: string, durationMs: number };

  // Layout
  'layout:panel_opened': { panel: 'archive' | 'tools', device: string };
  'layout:mobile_mode': { screen_width: number };

  // BYOK
  'api_key:added': { provider: string };
  'api_key:used': { provider: string, model: string };
}
```

---

## 15. Future Enhancements

### Post-Launch (v1.1+)

**Voice Chat**:
- 🎤 Voice input for chat (Whisper API)
- 🔊 Voice output for responses (TTS)
- 🗣️ Hands-free mode (voice-only interaction)

**Collaborative Features**:
- 👥 Shared workspaces (team mode)
- 💬 Multi-user chat (team discussions)
- 🔗 Share transformations via link

**Advanced AI**:
- 🧠 Custom agents (user-trained on their data)
- 🔍 Semantic search across all archives
- 📊 Analytics dashboard (usage patterns, improvements)

**Integrations**:
- 📧 Email integration (transform drafts)
- 📝 Google Docs add-on
- 💼 Slack bot
- 🌐 Browser extension

---

## 16. Success Metrics

### Launch Targets (Month 1)
- ✅ 80%+ user satisfaction (survey)
- ✅ 50%+ chat engagement rate (users send ≥1 message)
- ✅ 30%+ tutorial completion rate
- ✅ <5% error rate for chat actions
- ✅ <3s average response time (chat)

### Growth Targets (Month 3)
- ✅ 20% conversion to Pro (BYOK feature)
- ✅ 100+ avg messages per user per month
- ✅ 70% weekly active users
- ✅ 50%+ mobile usage

---

## 17. Open Questions for Refinement

### 1. Chat Persistence
**Question**: Should chat conversations persist across sessions?

**Options**:
- A) Yes, save all conversations (like ChatGPT)
- B) Session-only (clear on logout)
- C) User choice (opt-in persistence)

**Recommendation**: **Option A** (save all by default, with "Clear history" option)

---

### 2. Chat Model Selection
**Question**: Which models to support initially?

**Options**:
- A) Claude only (Haiku 4.5)
- B) Claude + GPT-4 (via user keys)
- C) Claude + GPT-4 + Gemini + Custom

**Recommendation**: **Option B** (Claude + GPT-4 via BYOK)

---

### 3. Mobile Chat Position
**Question**: Bottom bar vs floating button?

**Options**:
- A) Always-visible bottom bar (current proposal)
- B) Floating button (like FAB, but for chat)
- C) Hybrid (bar on tablet+, FAB on phone)

**Recommendation**: **Option A** (bottom bar, most discoverable)

---

### 4. Tutorial Activation
**Question**: When to trigger tutorials?

**Options**:
- A) Automatic on first use
- B) User asks (via chat)
- C) Manual toggle in settings

**Recommendation**: **Option B** (user-initiated via chat questions)

---

### 5. Action Confirmation
**Question**: Should chat actions require confirmation?

**Example**: User: "Delete all my archives"

**Options**:
- A) Always confirm destructive actions
- B) Never confirm (trust the LLM)
- C) Confirm first time only

**Recommendation**: **Option A** (always confirm destructive actions)

---

## 18. Next Steps

### Immediate Actions
1. ✅ **Review this specification** - Provide feedback, corrections, additions
2. ✅ **Prioritize features** - Which phases are must-have vs nice-to-have?
3. ✅ **Define success criteria** - What does "done" look like for v1.0?
4. ✅ **Approve architecture** - Any changes to proposed tech stack?

### Before Development Starts
1. ✅ Create detailed wireframes (Figma/Sketch)
2. ✅ Write system prompts for chat agent
3. ✅ Define API contracts (OpenAPI/Swagger)
4. ✅ Set up project structure and tooling
5. ✅ Create development timeline with milestones

---

## 19. Conclusion

This specification outlines a comprehensive unified interface that:

1. ✅ **Combines best of both frontends**
   - humanizer.com's clear navigation + automatic theming
   - Workbench's efficient 3-column layout + modern tooling

2. ✅ **Introduces game-changing AUI**
   - Conversational interface for knowledge work
   - UI tutoring system for onboarding
   - Deep integration with transformations
   - BYOK for power users

3. ✅ **Addresses all user requirements**
   - Automatic/manual theme switching ✅
   - 3-column desktop, intuitive mobile ✅
   - Agentic chat at bottom ✅
   - Tutorial highlighting ✅
   - Chat ↔ transformations integration ✅

4. ✅ **Provides clear implementation path**
   - 8-phase roadmap (16 weeks)
   - Technical solutions for challenges
   - Database schema and API design
   - Success metrics and analytics

**Estimated Timeline**: 4 months (16 weeks)
**Estimated Cost**: $0 additional infrastructure (Cloudflare stack)
**Expected Impact**: Transforms Humanizer into a complete knowledge work platform

---

**Ready for feedback and refinement!** 🚀

---

**End of Specification**
