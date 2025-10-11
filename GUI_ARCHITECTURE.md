# Humanizer GUI - Advanced Pane Architecture

**Created**: 2025-10-11
**Status**: Design Phase
**Goal**: Zed-inspired multi-pane interface with AUI integration

---

## 🎯 Vision

A sophisticated interface that combines:
- **Sidebar navigation** (icon-based view switching, collapsible)
- **Hierarchical lists** (conversations, readings, media, etc.)
- **Multi-mode main pane** (cards, rendered, markdown edit)
- **AUI visual tutorials** (floating prompts with keystroke/mouse demos)
- **Rich media rendering** (images with full metadata)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Top App Bar                                              │
│  [Logo] [View Mode] [Search] [AUI Prompt] [Settings]     │
├────┬─────────────────────────────────────────────────────┤
│    │  Main Pane                                           │
│ S  │  ┌───────────────────────────────────────────────┐  │
│ i  │  │ Toolbar: [Render] [Edit MD] [Export] [Share] │  │
│ d  │  ├───────────────────────────────────────────────┤  │
│ e  │  │ Content Area (dynamic):                       │  │
│ b  │  │  - Metadata Card                              │  │
│ a  │  │  - Message Cards (default)                    │  │
│ r  │  │  - Rendered HTML View                         │  │
│    │  │  - Markdown Editor                            │  │
│ I  │  │  - Image Gallery                              │  │
│ c  │  └───────────────────────────────────────────────┘  │
│ o  │                                                       │
│ n  │  ┌───────────────────────────────────────────────┐  │
│ s  │  │ AUI Tutorial Overlay (when active)            │  │
│    │  │  - Floating prompt window                     │  │
│    │  │  - Visual feedback arrows/highlights          │  │
│    │  │  - Keyboard shortcut display                  │  │
│    │  └───────────────────────────────────────────────┘  │
└────┴─────────────────────────────────────────────────────┘
```

---

## 📋 Component Breakdown

### 1. Sidebar System

**Sidebar Icons** (left edge, vertical):
```
┌─────┐
│ 💬  │ ← Conversations (ChatGPT archive)
│ 📖  │ ← Readings (TRM quantum readings)
│ 🖼️  │ ← Media (images, videos)
│ 🎯  │ ← POVMs (measurement packs)
│ 📊  │ ← Stats (usage, AUI insights)
│ ⚙️  │ ← Settings
│ 🤖  │ ← AUI Assistant
└─────┘
```

**Sidebar Content** (hierarchical lists):

**Conversations View:**
```
ChatGPT Archives
├── chat7 (1,659 conversations)
│   ├── 2024
│   │   ├── October
│   │   │   ├── Metaphysics of Dirac Equation (7 msgs)
│   │   │   ├── GAT Framework Discussion (42 msgs)
│   │   │   └── ...
│   │   ├── September
│   │   └── ...
│   └── 2023
└── chat6 (pending import)
```

**Readings View:**
```
Quantum Readings
├── Active Sessions (3)
│   ├── session-abc123 (step 5/10)
│   └── ...
├── Completed (47)
│   ├── By Date
│   └── By Text Source
└── POVM Results
    ├── Tetralemma readings (23)
    └── Tone analysis (15)
```

**Media View:**
```
Media Library (811 items)
├── By Type
│   ├── Images (811)
│   ├── Audio (0)
│   └── Video (0)
├── By Archive
│   ├── chat7 (811)
│   └── ...
├── Orphaned (177)
└── DALL-E Generated (234)
```

**Behavior:**
- Click icon → Show/switch sidebar content
- Click again → Collapse sidebar (more screen space)
- Drag divider → Resize sidebar width
- Keyboard: `Cmd+B` toggle, `Cmd+1-7` switch views

---

### 2. Main Pane Views

**Mode: Cards (Default)**

Shows conversation as sequential cards:

```
┌─────────────────────────────────────────────────────────┐
│ Metadata Card                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 Metaphysics of Dirac Equation                    │ │
│ │ 📅 Created: 2024-09-29 10:53                        │ │
│ │ 💬 Messages: 7 | 🖼️ Media: 0                        │ │
│ │ 🏷️ Archive: chat7 | Custom GPT: None               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ Message Card 1                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 User [10:53]                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ In the developing vocabulary of GAT, please...  │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ Message Card 2                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🤖 Assistant [10:54]                                │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ To present a formal metaphysical paper...       │ │ │
│ │ │                                                  │ │ │
│ │ │ The Dirac equation can be written as:           │ │ │
│ │ │ \[ (i \gamma^\mu \partial_\mu - e A^\mu...\]   │ │ │
│ │ │                                                  │ │ │
│ │ │ [Show More] [Copy] [Quote]                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Mode: Rendered HTML**

Full conversation as styled HTML document:
- MathJax-rendered equations
- Mermaid diagrams
- Embedded images
- Responsive typography
- Printable layout

**Mode: Markdown Editor**

Editable markdown with live preview:
```
┌──────────────────────┬──────────────────────┐
│ Markdown Source      │ Live Preview         │
│                      │                      │
│ # Conversation       │ [Rendered preview]   │
│                      │                      │
│ User: ...            │                      │
│ Assistant: ...       │                      │
└──────────────────────┴──────────────────────┘
```

---

### 3. Image Rendering System

**Image Card** (in message flow):

```
┌─────────────────────────────────────────────────────────┐
│ 🖼️ Image                                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                      │ │
│ │        [Rendered Image - 400px width]               │ │
│ │                                                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ℹ️ Metadata (toggle to show):                            │
│   • File ID: file-Tn32zbiHvk4rPzMoGZ6KdprE              │
│   • Filename: Screenshot 2024-09-29 at 1.48.47 PM.png   │
│   • Title: Dirac Equation Diagram                        │
│   • Description: Screenshot showing the Dirac equation   │
│   • Size: 26,139 bytes (702×192 px)                      │
│   • Archive: chat7                                        │
│                                                           │
│   [View Full Size] [Download] [Copy ID]                  │
└─────────────────────────────────────────────────────────┘
```

**File ID Resolution:**
- Search local archive paths first
- Fall back to API endpoints
- Cache loaded images (IndexedDB)
- Lazy load on scroll (performance)

**Missing Image Handling:**
```
┌─────────────────────────────────────────────────────────┐
│ 🖼️ Image (unavailable)                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                      │ │
│ │   ⚠️ Image not found                                │ │
│ │   file-Tn32zbiHvk4rPzMoGZ6KdprE                     │ │
│ │                                                      │ │
│ │   [Reimport Archive] [Search Media Library]         │ │
│ │                                                      │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

### 4. AUI Integration

**Floating Prompt** (bottom-right, dismissible):

```
┌─────────────────────────────────────────────────────────┐
│                                                      [x] │
│  🤖 Ask AUI Anything                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ How do I export this conversation as PDF?       │   │
│  └─────────────────────────────────────────────────┘   │
│                                             [Ask] [🎤]  │
└─────────────────────────────────────────────────────────┘
```

**Visual Tutorial Mode** (when AUI responds):

```
┌─────────────────────────────────────────────────────────┐
│  🤖 Here's how to export as PDF:                        │
│                                                          │
│  Step 1: Open the conversation                          │
│  ┌────┐                                                 │
│  │ 1. │ Click conversation in sidebar  ← 👆 [animated] │
│  └────┘                                                 │
│                                                          │
│  Step 2: Click Export button                            │
│  ┌────┐                                                 │
│  │ 2. │ Click [Export] in toolbar      ← 👆 [animated] │
│  └────┘                                                 │
│                                                          │
│  Step 3: Choose PDF format                              │
│  ┌────┐                                                 │
│  │ 3. │ Select "PDF" from dropdown     ← 👆 [animated] │
│  └────┘                                                 │
│                                                          │
│  Keyboard shortcut: Cmd+Shift+E                         │
│                                                          │
│  [Try It Now] [Show Me Again] [Done]                    │
└─────────────────────────────────────────────────────────┘
```

**Visual Feedback Elements:**
- **Highlight** target elements (glowing border)
- **Animated arrows** pointing to actions
- **Keyboard overlay** showing pressed keys
- **Mouse pointer** showing click locations
- **Step counter** (1/5, 2/5, etc.)

---

## 🎨 Design System

### Colors (Dark Theme)

```javascript
const colors = {
  // Base
  bg: {
    primary: '#0a0e14',      // Main background
    secondary: '#15191f',    // Sidebar/cards
    tertiary: '#1f2937',     // Elevated elements
  },

  // Text
  text: {
    primary: '#f3f4f6',      // Main text
    secondary: '#9ca3af',    // Muted text
    tertiary: '#6b7280',     // Disabled
  },

  // Accents
  accent: {
    purple: '#a78bfa',       // Primary actions
    blue: '#60a5fa',         // Links
    green: '#34d399',        // Success
    yellow: '#fbbf24',       // Warning
    red: '#f87171',          // Error
  },

  // Role colors (message cards)
  role: {
    user: '#4CAF50',         // User messages
    assistant: '#2196F3',    // Assistant messages
    system: '#FF9800',       // System messages
    tool: '#9C27B0',         // Tool calls
  }
};
```

### Typography

```css
font-family:
  -apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, 'Inter', sans-serif;

/* Sizes */
--text-xs: 0.75rem;    /* 12px - metadata */
--text-sm: 0.875rem;   /* 14px - secondary */
--text-base: 1rem;     /* 16px - body */
--text-lg: 1.125rem;   /* 18px - headings */
--text-xl: 1.25rem;    /* 20px - titles */
--text-2xl: 1.5rem;    /* 24px - page titles */
```

### Spacing

```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
```

---

## 🔧 Technical Stack

### Frontend

**Core:**
- React 18+ (hooks, suspense, concurrent features)
- TypeScript (strict mode)
- Vite (fast dev server, HMR)

**State Management:**
- Zustand (lightweight, simple)
- TanStack Query (server state, caching)

**UI Components:**
- Radix UI (accessible primitives)
- Framer Motion (animations)
- TailwindCSS (utility-first styling)

**Code/Math Rendering:**
- MathJax 3 (LaTeX equations)
- Mermaid (diagrams)
- Prism.js (syntax highlighting)

**Media:**
- React Image (lazy loading, fallbacks)
- IndexedDB (offline caching)

### Backend Integration

```typescript
// API client with AUI tracking
import { HumanizerAPI } from '@/lib/api-client';

const api = new HumanizerAPI({
  baseURL: 'http://localhost:8000',
  trackUsage: true,  // Auto-track with AUI
});

// Usage
const conversations = await api.chatgpt.list();
const rendered = await api.chatgpt.render(uuid, { include_media: true });
const recommendations = await api.aui.getRecommendations('viewing');
```

---

## 📊 Data Flow

### Loading a Conversation

```
User clicks conversation in sidebar
  ↓
[1] Fetch conversation metadata
  ↓
[2] Track usage with AUI (view_conversation)
  ↓
[3] Render metadata card
  ↓
[4] Fetch messages (paginated)
  ↓
[5] Render message cards (virtualized)
  ↓
[6] Lazy load images as they scroll into view
  ↓
[7] AUI learns viewing pattern
```

### Switching Modes

```
User clicks [Render] button
  ↓
[1] Track usage (render_html_mode)
  ↓
[2] Check cache for rendered HTML
  ↓
[3] If not cached, fetch from API
  ↓
[4] Display in iframe or shadow DOM
  ↓
[5] Initialize MathJax/Mermaid
  ↓
[6] Cache result (IndexedDB)
```

---

## 🎹 Keyboard Shortcuts

### Global
- `Cmd+B` - Toggle sidebar
- `Cmd+K` - Focus search
- `Cmd+/` - Show keyboard shortcuts
- `Cmd+,` - Open settings

### Navigation
- `Cmd+1-7` - Switch sidebar view
- `Cmd+[` - Previous conversation
- `Cmd+]` - Next conversation
- `Arrow keys` - Navigate lists

### Actions
- `Cmd+R` - Toggle render mode
- `Cmd+E` - Toggle edit mode
- `Cmd+Shift+E` - Export conversation
- `Cmd+I` - Show image metadata
- `Cmd+Shift+C` - Copy conversation URL

### AUI
- `Cmd+J` - Open AUI prompt
- `Escape` - Close AUI overlay
- `Cmd+Shift+T` - Toggle tutorial mode

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up React + Vite + TypeScript project
- [ ] Create base layout (top bar, sidebar, main pane)
- [ ] Implement sidebar icon navigation
- [ ] Build conversation list component
- [ ] Connect to existing API endpoints

### Phase 2: Core Features (Week 2)
- [ ] Implement card view for messages
- [ ] Add toolbar with mode toggles
- [ ] Create rendered HTML view
- [ ] Implement markdown editor
- [ ] Add image rendering with file ID resolution

### Phase 3: Advanced Features (Week 3)
- [ ] Build hierarchical lists for all data types
- [ ] Implement search functionality
- [ ] Add pagination and virtualization
- [ ] Create image metadata display
- [ ] Implement caching (IndexedDB)

### Phase 4: AUI Integration (Week 4)
- [ ] Design floating prompt UI
- [ ] Connect to AUI API endpoints
- [ ] Build visual feedback system
- [ ] Implement tutorial mode
- [ ] Add keyboard/mouse tracking

### Phase 5: Polish (Week 5)
- [ ] Add animations and transitions
- [ ] Implement keyboard shortcuts
- [ ] Create onboarding flow
- [ ] Write user documentation
- [ ] Performance optimization

---

## 📝 Example Component Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx           # Main layout container
│   │   ├── TopBar.tsx             # Top app bar
│   │   ├── Sidebar.tsx            # Sidebar container
│   │   ├── SidebarIcon.tsx        # Individual icon
│   │   └── MainPane.tsx           # Content area
│   │
│   ├── conversations/
│   │   ├── ConversationList.tsx   # Hierarchical list
│   │   ├── ConversationCard.tsx   # Metadata card
│   │   ├── MessageCard.tsx        # Individual message
│   │   └── ConversationToolbar.tsx # Mode toggles
│   │
│   ├── views/
│   │   ├── CardView.tsx           # Default cards view
│   │   ├── RenderedView.tsx       # HTML render
│   │   ├── MarkdownEditor.tsx     # MD editor
│   │   └── ImageGallery.tsx       # Media view
│   │
│   ├── media/
│   │   ├── ImageCard.tsx          # Image with metadata
│   │   ├── ImageMetadata.tsx      # Metadata display
│   │   └── MediaLibrary.tsx       # Full media view
│   │
│   └── aui/
│       ├── AUIPrompt.tsx          # Floating prompt
│       ├── TutorialOverlay.tsx    # Visual tutorial
│       ├── VisualFeedback.tsx     # Arrows/highlights
│       └── KeyboardShortcuts.tsx  # Shortcut display
│
├── hooks/
│   ├── useConversations.ts        # Conversation data
│   ├── useMessages.ts             # Message data
│   ├── useMedia.ts                # Media handling
│   ├── useAUI.ts                  # AUI integration
│   └── useKeyboard.ts             # Keyboard shortcuts
│
├── lib/
│   ├── api-client.ts              # API wrapper
│   ├── cache.ts                   # IndexedDB cache
│   ├── file-resolver.ts           # File ID → path
│   └── markdown.ts                # MD processing
│
└── stores/
    ├── ui-store.ts                # UI state (sidebar, mode)
    ├── conversation-store.ts      # Current conversation
    └── aui-store.ts               # AUI state
```

---

## 🎯 Success Criteria

**Usability:**
- [ ] Can navigate entire archive using only keyboard
- [ ] Sidebar responds in <50ms
- [ ] Images load progressively (not all at once)
- [ ] AUI provides helpful, contextual suggestions

**Performance:**
- [ ] List renders 1000+ items smoothly (virtualization)
- [ ] Images cached offline (available without API)
- [ ] UI responds <100ms to all interactions
- [ ] Conversation renders in <500ms

**Accessibility:**
- [ ] Full keyboard navigation
- [ ] Screen reader compatible
- [ ] WCAG 2.1 AA compliant
- [ ] Focus management (no focus traps)

---

## 🔮 Future Enhancements

**Advanced Features:**
- Multiple conversation tabs (like browser)
- Split view (compare two conversations)
- Global search across all archives
- Tagging and collections
- Collaborative annotations

**AI Features:**
- Semantic search (vector similarity)
- Quantum reading on demand (TRM integration)
- Conversation clustering (similar topics)
- Auto-summarization
- Sentiment analysis

**Export Options:**
- PDF with custom templates
- EPUB for e-readers
- LaTeX for academic papers
- JSON for data analysis
- Static website generator

---

This architecture provides a solid foundation for a sophisticated, AUI-enhanced GUI that grows with the Humanizer system. The modular design allows incremental development while maintaining coherence.
