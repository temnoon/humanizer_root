# NARRATIVE STUDIO → POST-SOCIAL INTEGRATION ANALYSIS

**Date**: 2024-11-25  
**Purpose**: Plan integration of Narrative Studio's superior UI/UX patterns into Post-Social framework  
**Original Location**: `/Users/tem/humanizer_root/narrative-studio`

---

## EXECUTIVE SUMMARY

### What Narrative Studio Does Well ✅
1. **Screen Real Estate Management**: Efficient use of space with resizable side panels
2. **Split-Pane Architecture**: Side-by-side comparison (original vs transformed)
3. **Buffer System**: Session history persistence for undo/redo and recovery
4. **Markdown + LaTeX**: Rich content rendering with react-markdown + KaTeX
5. **Theme System**: Elegant light/dark theming with CSS variables
6. **Responsive Design**: Mobile-first with panel collapse
7. **Archive Integration**: Direct access to local conversation archives

### Current Weaknesses ⚠️
1. **Brittleness**: Adding features breaks existing patterns
2. **Inconsistent Tool Interfaces**: Each transformation tool has different UX
3. **Buffer Complexity**: Not well-documented, hard to extend
4. **Mixed Concerns**: Archive, tools, and workspace tightly coupled
5. **No Component Library**: UI elements reinvented per component
6. **State Management**: Multiple contexts, unclear data flow

### Edward's Vision 🎯
**Local-First Hybrid Architecture**:
- **Web App** (post-social.humanizer.com): Lightweight, read posts, basic posting
- **Local App** (Electron/Tauri + Narrative Studio UI): Full experience with:
  - Personal archive access
  - Local LLMs (Ollama) OR Cloudflare Workers AI
  - Rich post/comment composition
  - AI curator real-time collaboration
  - Offline-first with sync

---

## ARCHITECTURE DEEP DIVE

### Tech Stack

**Frontend**
- React 19 + TypeScript
- Vite 7 (build tool)
- Tailwind CSS 4 (with CSS variables)
- react-markdown + remark/rehype plugins
- KaTeX (LaTeX math)
- highlight.js (code syntax)

**Backend** (archive-server.js)
- Express 5
- CORS configured for development + production
- File system access to `/Users/tem/openai-export-parser`
- Multiple archive support with runtime switching
- ZIP upload for conversation imports
- Conversation parsing services

**Current API Integration**
- NPE API (https://npe-api.tem-527.workers.dev)
- Authentication via JWT
- Transformation endpoints:
  - `/transformations/computer-humanizer`
  - `/transformations/allegorical`
  - `/transformations/ai-detection`

### Component Architecture

```
narrative-studio/
├── src/
│   ├── contexts/               # React Contexts for global state
│   │   ├── AuthContext.tsx     # JWT auth, user info
│   │   ├── ThemeContext.tsx    # Light/dark theme
│   │   ├── TextSizeContext.tsx # Font size scaling
│   │   ├── SessionContext.tsx  # Buffer management ⚠️ COMPLEX
│   │   └── ProviderContext.tsx # LLM provider selection
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx   # JWT login UI
│   │   ├── layout/
│   │   │   ├── TopBar.tsx      # Header with user menu
│   │   │   └── PanelToggle.tsx # Show/hide panel buttons
│   │   ├── archive/            # Archive browsing
│   │   │   ├── ArchiveList.tsx
│   │   │   ├── ConversationCard.tsx
│   │   │   └── TagFilter.tsx
│   │   ├── panels/
│   │   │   ├── ArchivePanel.tsx    # Left sidebar (archive browser)
│   │   │   └── ToolsPanel.tsx      # Right sidebar (transformation tools)
│   │   ├── workspace/
│   │   │   ├── MainWorkspace.tsx   # Center pane with split/tabs
│   │   │   ├── BufferView.tsx      # Individual buffer display
│   │   │   └── SplitView.tsx       # Side-by-side comparison
│   │   ├── markdown/
│   │   │   ├── MarkdownRenderer.tsx # react-markdown wrapper
│   │   │   └── MarkdownEditor.tsx   # Textarea with preview
│   │   └── ui/                 # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Select.tsx
│   │       └── Tooltip.tsx
│   │
│   ├── services/
│   │   ├── transformationService.ts # Transformation API calls
│   │   └── parser/                  # Conversation parsing
│   │       ├── ConversationParser.ts
│   │       └── IncrementalImporter.ts
│   │
│   ├── utils/
│   │   ├── api.ts              # API client with auth
│   │   └── markdown.ts         # Markdown utilities
│   │
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   │
│   ├── data/
│   │   └── sampleNarratives.ts # Demo content
│   │
│   ├── config/
│   │   ├── buffer-constants.ts # Buffer source types
│   │   ├── view-modes.ts       # View mode definitions
│   │   └── tool-names.ts       # Transformation tool names
│   │
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles + CSS variables
│
├── archive-server.js           # Express backend (port 3002)
├── package.json
├── vite.config.ts
└── wrangler.toml               # Cloudflare Pages config
```

---

## KEY SYSTEMS TO UNDERSTAND

### 1. Buffer System (SessionContext)

**Purpose**: Track editing history, enable undo/redo, persist sessions

**Concept**:
- Each "narrative view" is a **buffer** (like Emacs buffers)
- Buffers have:
  - `id`: unique identifier
  - `content`: markdown text
  - `source`: where it came from (NARRATIVE_STUDIO_SOURCE, ARCHIVE_SOURCE, etc.)
  - `viewMode`: 'rendered' | 'edit' | 'split'
  - `metadata`: timestamps, source info
  - `transformHistory`: applied transformations

**Session Structure**:
```typescript
interface Session {
  id: string;
  buffers: Buffer[];
  activeBufferId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Operations**:
- `createOriginalBuffer(content, source)` - Create new buffer
- `createTransformationBuffer(originalId, transformedContent, config)` - Create derived buffer
- `getActiveBuffer()` - Get current buffer
- `switchBuffer(id)` - Change active buffer
- `updateBuffer(id, updates)` - Modify buffer
- `updateViewMode(id, mode)` - Change view mode

**Storage**: localStorage as `narrative-studio-session`

**Problem**: Complex, hard to extend, couples editing with transformation history

### 2. Panel System (Resizable Sidebars)

**Architecture**:
```
┌────────────────────────────────────────────┐
│ TopBar (user menu, theme toggle)          │
├──────┬────────────────────────────┬────────┤
│      │                            │        │
│ Left │       MainWorkspace        │ Right  │
│Panel │     (buffers/split view)   │ Panel  │
│      │                            │        │
│Archiv│                            │ Tools  │
│  e   │                            │        │
│      │                            │        │
└──────┴────────────────────────────┴────────┘
```

**Features**:
- **Resizable**: Drag divider to resize (min: 200px, max: 600px)
- **Collapsible**: Toggle buttons hide/show panels
- **Responsive**: Auto-collapse on mobile (<768px)
- **Persistent**: Widths saved to localStorage

**State**:
- `archivePanelOpen`: boolean
- `toolsPanelOpen`: boolean
- `archivePanelWidth`: number (px)
- `toolsPanelWidth`: number (px)
- `isResizing`: 'archive' | 'tools' | null

**Implementation**: Mouse event handlers for drag, CSS calc() for layout

### 3. Workspace Modes

**Single Mode**: One buffer view (original OR transformed)
**Comparison Mode**: Split pane (original | transformed side-by-side)

**View Modes per Buffer**:
- `rendered`: Show rendered markdown/LaTeX
- `edit`: Show markdown source in textarea
- `split`: Show rendered + source side-by-side

**View Preference**:
- `split`: Horizontal split panes (desktop)
- `tabs`: Tabbed interface (mobile)

### 4. Transformation Flow

**User Journey**:
1. User selects text (or entire narrative)
2. Opens ToolsPanel (right sidebar)
3. Selects transformation type (computer-humanizer, allegorical, etc.)
4. Configures parameters (intensity, persona, style)
5. Clicks "Transform"
6. API call to transformation endpoint
7. Result appears in new buffer
8. Workspace switches to comparison mode (original | transformed)
9. User can accept, reject, or iterate

**API Call**:
```typescript
const result = await runTransform(
  text,
  {
    type: 'computer-humanizer',
    parameters: { intensity: 'moderate', useLLM: false }
  }
);
```

**Result Structure**:
```typescript
interface TransformResult {
  transformedText: string;
  originalText: string;
  config: TransformConfig;
  metadata: {
    timestamp: Date;
    duration: number;
    model?: string;
  };
}
```

### 5. Archive Integration

**Local Archive Structure**:
```
/Users/tem/openai-export-parser/
├── output_v13_final/           # Default archive
│   ├── conversations/
│   │   ├── 001_conv_id.json    # Parsed conversation
│   │   ├── 002_conv_id.json
│   │   └── ...
│   ├── index.json              # Archive metadata
│   └── tags.json               # Tag index
└── output_v14_new/             # Alternative archive
```

**Archive Server Endpoints** (port 3002):
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation by ID
- `GET /api/conversations/search?q=query` - Search conversations
- `GET /api/tags` - Get all tags with counts
- `POST /api/upload` - Upload ZIP archive
- `POST /api/switch-archive` - Switch active archive
- `GET /api/current-archive` - Get current archive name

**Frontend Integration**:
- ArchivePanel fetches and displays conversations
- Clicking conversation loads into buffer
- Tag filtering updates conversation list
- Archive switching persists to `~/.humanizer/archive-config.json`

---

## INTEGRATION STRATEGY

### Phase 1: Extract Core UI Patterns

**Goal**: Create reusable component library from Narrative Studio patterns

**Tasks**:
1. **Panel System**
   - Extract ResizablePanel component
   - Extract PanelToggle logic
   - Make generic (not tied to archive/tools)
   
2. **Split Workspace**
   - Extract SplitPane component
   - Support horizontal/vertical splits
   - Support 2-way and 3-way splits
   
3. **Buffer Management**
   - Simplify SessionContext
   - Separate concerns: editing vs transformation tracking
   - Document API clearly
   
4. **Markdown Rendering**
   - Extract MarkdownRenderer as shared component
   - Ensure LaTeX (KaTeX) works
   - Add code syntax highlighting
   
5. **Theme System**
   - Extract ThemeContext
   - Ensure CSS variables work in both apps
   - Unify color palettes

**Deliverable**: `/workers/shared/ui-components/` library

### Phase 2: Create Post-Social Writing Interface

**Goal**: Build post composer using Narrative Studio patterns

**Features**:
- Resizable panels: Archive (left) | Composer (center) | AI Curator (right)
- Split view: Draft | Preview side-by-side
- Buffer system: Auto-save drafts, track edits
- Rich markdown editing with LaTeX support
- AI curator chat in right panel (real-time)

**Components**:
```
PostComposer/
├── PostComposerPanel.tsx       # Center panel
│   ├── MarkdownEditor.tsx      # Textarea with toolbar
│   ├── MarkdownPreview.tsx     # Rendered preview
│   └── MetadataEditor.tsx      # Tags, title, etc.
├── AICuratorPanel.tsx          # Right panel
│   ├── ChatInterface.tsx       # Real-time AI chat
│   └── SuggestionCard.tsx      # AI suggestions
└── ArchivePanel.tsx            # Left panel (from NS)
```

### Phase 3: Local-First Architecture

**Goal**: Enable desktop app with local archive + remote API

**Architecture**:
```
┌─────────────────────────────────────────────┐
│           Desktop App (Electron/Tauri)      │
│  ┌──────────────────────────────────────┐  │
│  │   Narrative Studio UI (React)        │  │
│  │   - Post composer                     │  │
│  │   - Archive browser                   │  │
│  │   - AI curator chat                   │  │
│  └──────────┬───────────────────────────┘  │
│             │                                │
│  ┌──────────▼────────┐   ┌──────────────┐  │
│  │  Local Archive    │   │  Local LLM   │  │
│  │  (File System)    │   │  (Ollama)    │  │
│  └───────────────────┘   └──────────────┘  │
│             │                                │
└─────────────┼────────────────────────────────┘
              │ HTTPS
              │
┌─────────────▼────────────────────────────────┐
│     Cloudflare Workers (Remote API)          │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Post-Social API │  │  Workers AI      │  │
│  │ (Posts/Comments)│  │  (Fast, Large)   │  │
│  └─────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────┘
```

**User Choice**:
- **Local LLM**: Privacy, offline, slower
- **Remote AI**: Fast, large models, requires internet

**Sync Strategy**:
- Posts created locally → queue for upload
- Comments created locally → queue for upload
- Read posts/comments → cache locally
- Conflict resolution: last-write-wins with merge option

### Phase 4: Web App Adaptation

**Goal**: Adapt desktop UI for web-only experience

**Constraints**:
- No local archive access (browser sandbox)
- No local LLM (too heavy)
- Limited localStorage (quotas)

**Adaptations**:
- Archive panel → "Your Posts" (from Post-Social API)
- Local LLM → Always use Workers AI
- Buffer persistence → Server-side drafts API

**Progressive Enhancement**:
- **Basic**: Read-only feed, simple composer (current post-social-ui)
- **Enhanced**: Rich composer with Narrative Studio UI
- **Full**: Desktop app for complete experience

---

## SPECIFIC PATTERNS TO ADOPT

### 1. Panel Layout System

**Narrative Studio Pattern** ✅
```tsx
<div className="flex h-screen">
  {archivePanelOpen && (
    <aside
      style={{ width: `${archivePanelWidth}px` }}
      className="border-r"
    >
      <ArchivePanel />
    </aside>
  )}
  
  <main className="flex-1">
    <MainWorkspace />
  </main>
  
  {toolsPanelOpen && (
    <aside
      style={{ width: `${toolsPanelWidth}px` }}
      className="border-l"
    >
      <ToolsPanel />
    </aside>
  )}
</div>
```

**Adopt for Post-Social**:
```tsx
<div className="flex h-screen">
  {archiveOpen && (
    <ResizablePanel
      side="left"
      width={archiveWidth}
      onResize={setArchiveWidth}
      minWidth={200}
      maxWidth={600}
    >
      <YourPostsPanel />
    </ResizablePanel>
  )}
  
  <main className="flex-1">
    <PostComposer />
  </main>
  
  {curatorOpen && (
    <ResizablePanel
      side="right"
      width={curatorWidth}
      onResize={setCuratorWidth}
    >
      <AICuratorPanel />
    </ResizablePanel>
  )}
</div>
```

### 2. Split-Pane Editing

**Narrative Studio Pattern** ✅
```tsx
<div className="flex h-full">
  <div className="flex-1 overflow-auto">
    <MarkdownRenderer content={buffer.content} />
  </div>
  <div className="w-px bg-border" />
  <div className="flex-1 overflow-auto">
    <MarkdownEditor
      value={buffer.content}
      onChange={handleChange}
    />
  </div>
</div>
```

**Adopt for Post-Social**:
```tsx
<SplitPane orientation="horizontal">
  <SplitPane.Pane>
    <MarkdownEditor
      value={draft}
      onChange={setDraft}
      placeholder="Write your post..."
    />
  </SplitPane.Pane>
  <SplitPane.Divider />
  <SplitPane.Pane>
    <MarkdownPreview content={draft} />
  </SplitPane.Pane>
</SplitPane>
```

### 3. Buffer-Based Editing

**Simplified Buffer Concept**:
```typescript
interface Buffer {
  id: string;
  type: 'post' | 'comment' | 'draft';
  content: string;
  metadata: {
    title?: string;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
  };
  history: BufferSnapshot[];  // Undo/redo
  isDirty: boolean;           // Has unsaved changes
}

interface BufferSnapshot {
  content: string;
  timestamp: Date;
}
```

**Operations**:
- `createBuffer(type, content)` - New buffer
- `saveBuffer(id)` - Persist to server/localStorage
- `revertBuffer(id, snapshotIndex)` - Undo
- `closeBuffer(id, confirmIfDirty)` - Close with save prompt

### 4. Theme System

**CSS Variables Approach** ✅
```css
:root {
  --bg-primary: #fafaf9;
  --bg-secondary: #f5f5f4;
  --text-primary: #1c1917;
  --accent: #7c3aed;
  --border: #e7e5e4;
}

[data-theme='dark'] {
  --bg-primary: #1c1917;
  --bg-secondary: #292524;
  --text-primary: #fafaf9;
  --accent: #a78bfa;
  --border: #44403c;
}
```

**Adopt for Post-Social**: ✅ Already using similar system!

---

## PROBLEMS TO SOLVE

### 1. Buffer System Complexity

**Current Issue**: SessionContext does too much
- Manages buffers
- Tracks transformations
- Handles view modes
- Persists to localStorage
- Couples editing with transformation history

**Solution**: Separate concerns
```
BufferContext          → Just editing state, undo/redo
TransformationContext  → Transformation history
ViewModeContext        → UI preferences (split/tabs)
PersistenceService     → Save/load from storage
```

### 2. Tool Interface Inconsistency

**Current Issue**: Each transformation tool has different UX

**Solution**: Standardize tool interface
```typescript
interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  configSchema: JSONSchema;  // Parameters
  transform: (input: string, config: any) => Promise<string>;
}
```

Then render dynamically:
```tsx
<ToolPanel tool={tool}>
  <DynamicForm schema={tool.configSchema} />
  <Button onClick={() => tool.transform(text, config)}>
    Apply
  </Button>
</ToolPanel>
```

### 3. Archive Server Coupling

**Current Issue**: archive-server.js is Node.js + filesystem specific

**Solution**: Abstract archive interface
```typescript
interface ArchiveProvider {
  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation>;
  searchConversations(query: string): Promise<Conversation[]>;
  getTags(): Promise<Tag[]>;
}

// Implementations:
class LocalArchiveProvider implements ArchiveProvider {
  // Uses fetch to archive-server.js (port 3002)
}

class RemoteArchiveProvider implements ArchiveProvider {
  // Uses fetch to post-social-api (your posts)
}

class HybridArchiveProvider implements ArchiveProvider {
  // Combines local + remote
}
```

### 4. State Management Scalability

**Current Issue**: Many contexts, unclear data flow

**Solution**: Consider Zustand or Jotai
```typescript
// Simple, clear state management
import { create } from 'zustand';

const useEditorStore = create((set) => ({
  buffers: [],
  activeBufferId: null,
  createBuffer: (content) => set((state) => ({
    buffers: [...state.buffers, newBuffer(content)]
  })),
  // ...
}));
```

---

## DEVELOPMENT PROCESS IMPROVEMENT

### Edward's Observation

> "Developing first, sees what went wrong with the development later. I see this in Claude Code (my CLI coding agent of choice) and in you in this latest build-out of post-social ... the problem is not what I am or what you are, but working out an efficient means of making clear what is to be done, have it reviewed and approved by the other, then implemented, with each step tested by the agent, then tested by the human supervisor."

### Proposed Workflow

#### Phase 1: Plan & Review
1. **Agent**: Draft architecture document (like this)
2. **Human**: Review, annotate, approve/request changes
3. **Iterate** until both parties agree

#### Phase 2: Implement Small
4. **Agent**: Implement ONE component/feature
5. **Agent**: Self-test (run build, check types)
6. **Agent**: Show diff to human
7. **Human**: Test in browser, approve/request changes
8. **Repeat** for next component

#### Phase 3: Integrate
9. **Agent**: Integrate tested components
10. **Agent**: Run full test suite
11. **Human**: End-to-end testing
12. **Agent**: Fix issues found
13. **Deploy** when both parties satisfied

### Documentation Standards

**Before Coding**:
- Architecture document (like this)
- Component API specifications
- Data flow diagrams
- Test plan

**During Coding**:
- TSDoc comments on all public APIs
- Inline comments for complex logic
- README per major feature

**After Coding**:
- Migration guide (old → new)
- Troubleshooting guide
- Performance notes

### Testing Standards

**Unit Tests**: Not required initially (move fast)
**Integration Tests**: Manual testing by human
**E2E Tests**: Critical user flows only

**Test Checklist Per Feature**:
- [ ] Compiles without errors
- [ ] No console errors in browser
- [ ] Works in light AND dark theme
- [ ] Responsive (desktop, tablet, mobile)
- [ ] Keyboard accessible
- [ ] Data persists correctly

---

## ACTIONABLE NEXT STEPS

### Option A: Extract UI Components First (Safest)
**Goal**: Create reusable library without touching existing apps

**Tasks**:
1. Create `/workers/shared/ui-components/` directory
2. Extract ResizablePanel from Narrative Studio
3. Extract SplitPane from Narrative Studio
4. Extract MarkdownRenderer from Narrative Studio
5. Extract ThemeProvider from Narrative Studio
6. Document each component with examples
7. Build Storybook or simple demo page

**Outcome**: Proven components ready for integration

### Option B: Build Post Composer in Post-Social (Faster)
**Goal**: Create rich post composer using Narrative Studio patterns

**Tasks**:
1. Create `PostComposerPage.tsx` in post-social-ui
2. Implement 3-panel layout (Archive | Composer | Curator)
3. Add split-pane editing (Draft | Preview)
4. Wire up to Post-Social API
5. Deploy and test

**Outcome**: Working composer, identify issues

### Option C: Plan Desktop App Architecture (Strategic)
**Goal**: Design local-first architecture before coding

**Tasks**:
1. Choose Electron vs Tauri
2. Design file structure
3. Plan local archive integration
4. Plan Ollama integration
5. Design sync strategy (local ↔ remote)
6. Prototype basic window with panels

**Outcome**: Clear path for full local experience

---

## RECOMMENDATION

**Start with Option A** (Extract UI Components)

**Why**:
1. **Low Risk**: Doesn't break existing apps
2. **High Value**: Components reusable everywhere
3. **Learning**: Understand patterns deeply before copying
4. **Testable**: Each component can be tested in isolation
5. **Documented**: Forces us to write clear APIs

**Then**: Option B (Post Composer) using extracted components

**Finally**: Option C (Desktop App) when patterns proven

---

## OPEN QUESTIONS FOR EDWARD

1. **Priority**: Which matters most right now?
   - Rich post composer for web?
   - Desktop app with archive access?
   - Component library for future use?

2. **Local vs Remote**: Should we build for local-first from day 1, or start web-only?

3. **Archive Integration**: Use existing archive-server.js or build new API?

4. **LLM Strategy**: 
   - Ollama only (local)?
   - Workers AI only (remote)?
   - User choice (hybrid)?

5. **Buffer System**: Keep complex SessionContext or simplify?

6. **State Management**: Continue with React Context or adopt Zustand/Jotai?

7. **Testing Strategy**: What level of testing do you want before "done"?

---

**READY FOR REVIEW AND DISCUSSION** 🎯

This document captures the Narrative Studio architecture, identifies integration opportunities, and proposes development workflows. Next step: Edward reviews, annotates, and we proceed with agreed plan.
