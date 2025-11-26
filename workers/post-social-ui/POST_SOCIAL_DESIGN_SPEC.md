# POST-SOCIAL NODE SYSTEM - DESIGN SPECIFICATION

**Version**: 1.0  
**Date**: 2024-11-25  
**Author**: Edward Collins + Claude  
**Status**: Approved - Ready for Implementation  
**Companion**: POST_SOCIAL_FUNCTIONAL_SPEC.md

---

## EXECUTIVE SUMMARY

This document specifies the technical implementation of the Post-Social Node System, detailing API endpoints, database schema, component architecture, data flows, and integration patterns. It complements the Functional Specification by providing implementation-level decisions.

---

## SYSTEM ARCHITECTURE

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│          Frontend (Cloudflare Pages)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │   post-social-ui (SolidJS + TypeScript)          │  │
│  │   - Dashboard (VAX Notes style)                  │  │
│  │   - Narrative Studio (3-panel composer)          │  │
│  │   - Node browser                                 │  │
│  │   - Version comparison                           │  │
│  └──────────────┬───────────────────────────────────┘  │
└─────────────────┼───────────────────────────────────────┘
                  │ HTTPS + JWT
┌─────────────────▼───────────────────────────────────────┐
│         Backend (Cloudflare Workers)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │   post-social-api (Hono + TypeScript)            │  │
│  │   - Node CRUD                                    │  │
│  │   - Narrative versioning                         │  │
│  │   - Comment synthesis                            │  │
│  │   - Subscription management                      │  │
│  └───┬────────┬────────┬────────┬───────────────────┘  │
│      │        │        │        │                       │
│  ┌───▼──┐ ┌──▼──┐ ┌───▼───┐ ┌──▼─────────┐            │
│  │  D1  │ │ AI  │ │Vector-│ │  Queue     │            │
│  │  DB  │ │     │ │  ize  │ │ (Synthesis)│            │
│  └──────┘ └─────┘ └───────┘ └────────────┘            │
└─────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│         NPE Auth API (Existing)                         │
│         - JWT generation                                │
│         - User authentication                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Archive Server (Node.js + Express) - Port 3002        │
│  - Personal archive access                              │
│  - Conversation parsing                                 │
│  - Local file system integration                        │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**
- **Framework**: SolidJS 1.8 (reactive, performant)
- **Build Tool**: Vite 5
- **Language**: TypeScript 5.3
- **Styling**: CSS Variables + Tailwind-inspired utilities
- **Markdown**: marked + KaTeX (LaTeX)
- **Routing**: @solidjs/router
- **State**: Signals + Stores (SolidJS native)
- **HTTP Client**: Fetch API

**Backend**
- **Runtime**: Cloudflare Workers
- **Framework**: Hono 4.6 (lightweight, fast)
- **Language**: TypeScript 5.3
- **Database**: D1 (SQLite)
- **Vector DB**: Vectorize (768d embeddings)
- **AI**: Workers AI (Llama 3.2, Llama Guard)
- **Queue**: Cloudflare Queues (async synthesis)
- **Auth**: JWT (jose library)

**Infrastructure**
- **Hosting**: Cloudflare Pages (frontend), Workers (backend)
- **CDN**: Cloudflare (global edge)
- **DNS**: Cloudflare
- **Email**: Mailgun or Resend (notifications)

---

## DATABASE SCHEMA

### D1 Tables (post-social-db)

```sql
-- Antinodes (Users)
CREATE TABLE antinodes (
  id TEXT PRIMARY KEY,                    -- UUID
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,            -- Argon2
  tier TEXT NOT NULL DEFAULT 'free',      -- 'free' | 'member' | 'pro'
  metadata JSON NOT NULL DEFAULT '{}',    -- Bio, preferences
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_antinodes_email ON antinodes(email);
CREATE INDEX idx_antinodes_username ON antinodes(username);

-- Nodes (Topic Curators)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL,                     -- Display name
  slug TEXT UNIQUE NOT NULL,              -- URL-friendly
  description TEXT,                       -- Purpose/focus
  creator_antinode_id TEXT NOT NULL,
  
  curator_config JSON NOT NULL DEFAULT '{}',  -- Personality, criteria, model
  -- Example:
  -- {
  --   "personality": "Husserlian",
  --   "systemPrompt": "You are a phenomenologist...",
  --   "model": "claude-sonnet-4",
  --   "filterCriteria": {
  --     "minQuality": 0.7,
  --     "acceptedTopics": ["phenomenology", "consciousness"],
  --     "rejectedTopics": ["politics"]
  --   }
  -- }
  
  archive_metadata JSON NOT NULL DEFAULT '{}',  -- Narrative count, last published
  subscriptions JSON NOT NULL DEFAULT '{"incoming":[],"outgoing":[]}',
  
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (creator_antinode_id) REFERENCES antinodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_nodes_creator ON nodes(creator_antinode_id);
CREATE INDEX idx_nodes_slug ON nodes(slug);
CREATE INDEX idx_nodes_status ON nodes(status);

-- Narratives (Evolving Essays)
CREATE TABLE narratives (
  id TEXT PRIMARY KEY,                    -- UUID
  node_id TEXT NOT NULL,
  
  current_version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,                     -- Unique within node
  content TEXT NOT NULL,                  -- Markdown
  
  metadata JSON NOT NULL DEFAULT '{}',
  -- Example:
  -- {
  --   "tags": ["phenomenology", "husserl"],
  --   "readingTime": 12,
  --   "lexicalSignature": "sha256-hash",
  --   "wordCount": 2400
  -- }
  
  synthesis JSON NOT NULL DEFAULT '{"status":"none","pendingComments":0}',
  -- Example:
  -- {
  --   "status": "none" | "pending" | "in_progress" | "completed",
  --   "lastSynthesized": "2024-11-25T10:00:00Z",
  --   "pendingComments": 5
  -- }
  
  subscriber_count INTEGER DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',  -- 'public' | 'node-only' | 'private'
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(node_id, slug)
);

CREATE INDEX idx_narratives_node ON narratives(node_id);
CREATE INDEX idx_narratives_slug ON narratives(node_id, slug);
CREATE INDEX idx_narratives_visibility ON narratives(visibility);
CREATE INDEX idx_narratives_updated ON narratives(updated_at DESC);

-- Narrative Versions (History)
CREATE TABLE narrative_versions (
  id TEXT PRIMARY KEY,                    -- UUID
  narrative_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  
  content TEXT NOT NULL,                  -- Full markdown at this version
  
  changes JSON NOT NULL,
  -- Example:
  -- {
  --   "summary": "Refined intentionality section based on comments",
  --   "diff": "... git-style diff ...",
  --   "addedLines": 12,
  --   "removedLines": 8,
  --   "semanticShift": 0.23
  -- }
  
  trigger JSON NOT NULL,
  -- Example:
  -- {
  --   "type": "manual" | "comment-synthesis" | "curator-refinement",
  --   "actor": "antinode-id or 'ai-curator'",
  --   "comments": ["comment-id-1", "comment-id-2"]
  -- }
  
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  UNIQUE(narrative_id, version)
);

CREATE INDEX idx_versions_narrative ON narrative_versions(narrative_id);
CREATE INDEX idx_versions_version ON narrative_versions(narrative_id, version DESC);

-- Comments (Synthesis Input)
CREATE TABLE comments (
  id TEXT PRIMARY KEY,                    -- UUID
  narrative_id TEXT NOT NULL,
  version INTEGER NOT NULL,               -- Which version was commented on
  author_antinode_id TEXT NOT NULL,
  
  content TEXT NOT NULL,                  -- Markdown
  
  context JSON,
  -- Example:
  -- {
  --   "quotedText": "Intentionality is always directed...",
  --   "startOffset": 523,
  --   "endOffset": 582
  -- }
  
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'synthesized' | 'rejected'
  
  curator_evaluation JSON,
  -- Example:
  -- {
  --   "quality": 0.85,
  --   "relevance": 0.92,
  --   "perspective": "Offers important nuance",
  --   "synthesisNotes": "Incorporate empty intentionality"
  -- }
  
  synthesized_in_version INTEGER,         -- NULL if not yet synthesized
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  evaluated_at DATETIME,
  synthesized_at DATETIME,
  
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  FOREIGN KEY (author_antinode_id) REFERENCES antinodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_comments_narrative ON comments(narrative_id);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_comments_author ON comments(author_antinode_id);

-- Subscriptions (Node Following)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,                    -- UUID
  antinode_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  
  preferences JSON NOT NULL DEFAULT '{}',
  -- Example:
  -- {
  --   "notifyOnNewNarrative": true,
  --   "notifyOnUpdate": true,
  --   "emailDigest": "daily"
  -- }
  
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  unread_count INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (antinode_id) REFERENCES antinodes(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(antinode_id, node_id)
);

CREATE INDEX idx_subscriptions_antinode ON subscriptions(antinode_id);
CREATE INDEX idx_subscriptions_node ON subscriptions(node_id);
CREATE INDEX idx_subscriptions_unread ON subscriptions(antinode_id, unread_count);
```

### Vectorize Index (post-social-posts)

**Configuration**:
- **Dimensions**: 768 (text-embedding-ada-002 compatible)
- **Metric**: Cosine similarity
- **Index Name**: `post-social-posts`

**Stored Vectors**:
```typescript
interface VectorMetadata {
  narrativeId: string;
  version: number;
  nodeId: string;
  title: string;
  tags: string[];
  timestamp: string;
}
```

**Operations**:
- `insertVector(narrativeId, embedding, metadata)` - On publish/update
- `queryVector(embedding, topK=10)` - Semantic search
- `deleteVector(narrativeId)` - On narrative delete

---

## API DESIGN

### Base URLs

**Production**:
- Frontend: `https://post-social.humanizer.com`
- API: `https://post-social-api.tem-527.workers.dev`
- Auth: `https://npe-api.tem-527.workers.dev`

**Development**:
- Frontend: `http://localhost:5173`
- API: `http://localhost:8788`
- Auth: `http://localhost:8789`

### Authentication

**Method**: JWT Bearer Token  
**Header**: `Authorization: Bearer <token>`  
**Token Source**: NPE Auth API  
**Validation**: `jose` library (verify signature, expiration)

### Endpoints

#### Nodes

**POST /api/nodes**  
Create new Node

Request:
```json
{
  "name": "Phenomenology",
  "description": "Essays on Husserlian phenomenology",
  "curator": {
    "personality": "Husserlian",
    "systemPrompt": "You are a phenomenologist...",
    "model": "claude-sonnet-4",
    "filterCriteria": {
      "minQuality": 0.7,
      "acceptedTopics": ["phenomenology"]
    }
  },
  "visibility": "public"
}
```

Response (201):
```json
{
  "node": {
    "id": "node-123",
    "name": "Phenomenology",
    "slug": "phenomenology",
    "creatorAntinodeId": "antinode-456",
    "createdAt": "2024-11-25T10:00:00Z"
  }
}
```

**GET /api/nodes**  
List all public Nodes (or user's Nodes if authenticated)

Query Params:
- `search`: Search by name/description
- `tags`: Filter by tags (comma-separated)
- `sort`: `name` | `created` | `subscribers` (default: `subscribers`)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)

Response (200):
```json
{
  "nodes": [
    {
      "id": "node-123",
      "name": "Phenomenology",
      "slug": "phenomenology",
      "description": "...",
      "subscriberCount": 42,
      "narrativeCount": 12,
      "lastPublished": "2024-11-20T15:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

**GET /api/nodes/:slug**  
Get Node details

Response (200):
```json
{
  "node": {
    "id": "node-123",
    "name": "Phenomenology",
    "slug": "phenomenology",
    "description": "...",
    "creatorAntinodeId": "antinode-456",
    "curator": { ... },
    "subscriberCount": 42,
    "narrativeCount": 12,
    "narratives": [ ... ]  // Recent narratives
  }
}
```

**PUT /api/nodes/:id**  
Update Node settings (owner only)

Request:
```json
{
  "description": "Updated description",
  "curator": { ... }
}
```

**DELETE /api/nodes/:id**  
Archive Node (soft delete, owner only)

#### Narratives

**POST /api/nodes/:nodeId/narratives**  
Publish narrative to Node

Request:
```json
{
  "title": "The Structure of Consciousness",
  "content": "# Introduction\n\nConsciousness is...",
  "tags": ["phenomenology", "husserl"],
  "visibility": "public"
}
```

Response (201):
```json
{
  "narrative": {
    "id": "narrative-789",
    "nodeId": "node-123",
    "title": "The Structure of Consciousness",
    "slug": "the-structure-of-consciousness",
    "currentVersion": 1,
    "createdAt": "2024-11-25T10:00:00Z"
  }
}
```

**GET /api/nodes/:nodeSlug/narratives/:narrativeSlug**  
Get narrative (current version)

Query Params:
- `version`: Specific version number (optional)

Response (200):
```json
{
  "narrative": {
    "id": "narrative-789",
    "nodeId": "node-123",
    "title": "The Structure of Consciousness",
    "slug": "the-structure-of-consciousness",
    "content": "# Introduction...",
    "currentVersion": 3,
    "metadata": {
      "tags": ["phenomenology"],
      "readingTime": 12,
      "wordCount": 2400
    },
    "versions": [
      { "version": 1, "timestamp": "..." },
      { "version": 2, "timestamp": "..." },
      { "version": 3, "timestamp": "..." }
    ],
    "subscriberCount": 15
  }
}
```

**PUT /api/narratives/:id**  
Update narrative (creates new version)

Request:
```json
{
  "content": "# Introduction\n\nUpdated content...",
  "changeReason": "Refined intentionality section"
}
```

Response (200):
```json
{
  "narrative": {
    "id": "narrative-789",
    "currentVersion": 4,
    "updatedAt": "2024-11-25T11:00:00Z"
  }
}
```

**GET /api/narratives/:id/versions**  
List all versions

Response (200):
```json
{
  "versions": [
    {
      "version": 1,
      "timestamp": "2024-11-20T10:00:00Z",
      "changes": { ... },
      "trigger": { ... }
    },
    { ... }
  ]
}
```

**GET /api/narratives/:id/versions/compare**  
Compare two versions

Query Params:
- `from`: Version number
- `to`: Version number

Response (200):
```json
{
  "from": {
    "version": 2,
    "content": "..."
  },
  "to": {
    "version": 3,
    "content": "..."
  },
  "diff": "... git-style diff ...",
  "changes": {
    "addedLines": 12,
    "removedLines": 8,
    "semanticShift": 0.23
  }
}
```

#### Comments

**POST /api/narratives/:id/comments**  
Post comment

Request:
```json
{
  "content": "This section could clarify...",
  "context": {
    "quotedText": "Intentionality is always...",
    "startOffset": 523,
    "endOffset": 582
  }
}
```

Response (201):
```json
{
  "comment": {
    "id": "comment-111",
    "narrativeId": "narrative-789",
    "version": 3,
    "authorAntinodeId": "antinode-456",
    "status": "pending",
    "createdAt": "2024-11-25T12:00:00Z"
  }
}
```

**GET /api/narratives/:id/comments**  
List comments

Query Params:
- `status`: Filter by status (optional)
- `version`: Filter by version (optional)

Response (200):
```json
{
  "comments": [
    {
      "id": "comment-111",
      "content": "...",
      "author": {
        "id": "antinode-456",
        "username": "philosopher"
      },
      "status": "approved",
      "curatorEvaluation": { ... }
    }
  ]
}
```

**POST /api/comments/:id/evaluate**  
Curator evaluates comment (Node owner only)

Request:
```json
{
  "quality": 0.85,
  "relevance": 0.92,
  "perspective": "Offers important nuance",
  "synthesisNotes": "Incorporate empty intentionality",
  "status": "approved"
}
```

**POST /api/narratives/:id/synthesize**  
Trigger synthesis (Node owner only)

Request:
```json
{
  "commentIds": ["comment-111", "comment-222"]
}
```

Response (202 Accepted):
```json
{
  "synthesisJobId": "job-333",
  "status": "queued",
  "message": "Synthesis job queued. Check back in ~60s."
}
```

#### Subscriptions

**POST /api/subscriptions**  
Subscribe to Node

Request:
```json
{
  "nodeId": "node-123",
  "preferences": {
    "notifyOnNewNarrative": true,
    "notifyOnUpdate": true,
    "emailDigest": "daily"
  }
}
```

Response (201):
```json
{
  "subscription": {
    "id": "sub-444",
    "nodeId": "node-123",
    "unreadCount": 0
  }
}
```

**GET /api/subscriptions**  
List user's subscriptions (with unread counts)

Response (200):
```json
{
  "subscriptions": [
    {
      "id": "sub-444",
      "node": {
        "id": "node-123",
        "name": "Phenomenology",
        "slug": "phenomenology"
      },
      "unreadCount": 5,
      "lastChecked": "2024-11-24T10:00:00Z"
    }
  ]
}
```

**PUT /api/subscriptions/:id/mark-read**  
Mark Node as read

Response (200):
```json
{
  "subscription": {
    "id": "sub-444",
    "unreadCount": 0,
    "lastChecked": "2024-11-25T12:00:00Z"
  }
}
```

**DELETE /api/subscriptions/:id**  
Unsubscribe from Node

#### Search

**GET /api/search/narratives**  
Semantic search across all public narratives

Query Params:
- `q`: Search query
- `tags`: Filter by tags (comma-separated)
- `nodeId`: Filter by Node (optional)
- `limit`: Results (default: 10, max: 50)

Response (200):
```json
{
  "results": [
    {
      "narrative": { ... },
      "score": 0.87,  // Cosine similarity
      "highlights": ["...relevant excerpt..."]
    }
  ]
}
```

---

## COMPONENT ARCHITECTURE (Frontend)

### Directory Structure

```
src/
├── components/
│   ├── dashboard/
│   │   ├── DashboardPage.tsx         # VAX Notes style dashboard
│   │   ├── SubscriptionList.tsx     # List of subscribed Nodes
│   │   ├── NodeCard.tsx             # Single Node with unread count
│   │   └── UpdateIndicator.tsx      # Badge showing update count
│   │
│   ├── nodes/
│   │   ├── NodeBrowser.tsx          # Public Node directory
│   │   ├── NodeDetailPage.tsx       # Single Node view
│   │   ├── NodeForm.tsx             # Create/edit Node
│   │   ├── CuratorConfig.tsx        # Configure AI curator
│   │   └── NodeArchive.tsx          # Node's narrative list
│   │
│   ├── narratives/
│   │   ├── NarrativeView.tsx        # Single narrative display
│   │   ├── NarrativeStudio.tsx      # 3-panel composer
│   │   ├── VersionHistory.tsx       # List all versions
│   │   ├── VersionComparison.tsx    # Diff view (v1 vs v2)
│   │   └── NarrativeMetadata.tsx    # Tags, reading time, etc.
│   │
│   ├── comments/
│   │   ├── CommentList.tsx          # All comments on narrative
│   │   ├── CommentItem.tsx          # Single comment display
│   │   ├── CommentComposer.tsx      # Write comment
│   │   └── CuratorEvaluation.tsx    # Show curator's assessment
│   │
│   ├── studio/
│   │   ├── StudioLayout.tsx         # 3-panel container
│   │   ├── ArchivePanel.tsx         # Left: Personal/Node archive
│   │   ├── EditorPanel.tsx          # Center: Markdown editor
│   │   ├── CuratorPanel.tsx         # Right: AI suggestions
│   │   ├── SplitPane.tsx            # Split-pane editor (draft|preview)
│   │   └── BufferManager.tsx        # Auto-save, undo/redo
│   │
│   ├── ui/
│   │   ├── ResizablePanel.tsx       # Generic resizable panel
│   │   ├── MarkdownRenderer.tsx     # Markdown + LaTeX
│   │   ├── MarkdownEditor.tsx       # Textarea with toolbar
│   │   ├── DiffViewer.tsx           # Git-style diff display
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   └── Spinner.tsx
│   │
│   └── layout/
│       ├── TopBar.tsx               # Header with nav
│       ├── UserMenu.tsx             # Dropdown (settings, logout)
│       └── ThemeToggle.tsx          # Light/dark switch
│
├── stores/
│   ├── auth.ts                      # Auth state (existing)
│   ├── subscriptions.ts             # Subscription state + unread counts
│   ├── narrative.ts                 # Current narrative state
│   └── studio.ts                    # Studio buffer state
│
├── services/
│   ├── api.ts                       # HTTP client (existing)
│   ├── nodes.ts                     # Node API calls
│   ├── narratives.ts                # Narrative API calls
│   ├── comments.ts                  # Comment API calls
│   ├── subscriptions.ts             # Subscription API calls
│   └── synthesis.ts                 # Synthesis API calls
│
├── utils/
│   ├── markdown.ts                  # Markdown rendering (existing)
│   ├── diff.ts                      # Generate diffs
│   ├── date.ts                      # Date formatting
│   └── slug.ts                      # Generate URL slugs
│
└── types/
    ├── api.ts                       # API request/response types
    ├── models.ts                    # Domain models
    └── ui.ts                        # UI component types
```

### Key Components

#### DashboardPage (VAX Notes Style)

```typescript
interface DashboardPageProps {}

export function DashboardPage() {
  const [subscriptions] = createResource(loadSubscriptions);
  
  return (
    <div class="container">
      <h1>Subscribed Nodes</h1>
      
      <Show when={!subscriptions.loading}>
        <SubscriptionList subscriptions={subscriptions()} />
      </Show>
    </div>
  );
}

interface SubscriptionListProps {
  subscriptions: Subscription[];
}

function SubscriptionList(props: SubscriptionListProps) {
  return (
    <div class="subscription-list">
      <For each={props.subscriptions}>
        {(sub) => (
          <NodeCard
            node={sub.node}
            unreadCount={sub.unreadCount}
            lastChecked={sub.lastChecked}
          />
        )}
      </For>
    </div>
  );
}

interface NodeCardProps {
  node: Node;
  unreadCount: number;
  lastChecked: Date;
}

function NodeCard(props: NodeCardProps) {
  return (
    <A href={`/node/${props.node.slug}`}>
      <div class="node-card">
        <h3>{props.node.name}</h3>
        <Show when={props.unreadCount > 0}>
          <UpdateIndicator count={props.unreadCount} />
        </Show>
      </div>
    </A>
  );
}
```

#### NarrativeStudio (3-Panel Composer)

```typescript
interface NarrativeStudioProps {
  nodeId?: string;  // If publishing to specific Node
}

export function NarrativeStudio(props: NarrativeStudioProps) {
  const [leftPanelOpen, setLeftPanelOpen] = createSignal(true);
  const [rightPanelOpen, setRightPanelOpen] = createSignal(true);
  const [leftWidth, setLeftWidth] = createSignal(300);
  const [rightWidth, setRightWidth] = createSignal(350);
  
  return (
    <div class="studio-layout">
      {/* Left Panel: Archive */}
      <Show when={leftPanelOpen()}>
        <ResizablePanel
          side="left"
          width={leftWidth()}
          onResize={setLeftWidth}
          minWidth={200}
          maxWidth={600}
        >
          <ArchivePanel
            source="personal"  // or "node"
            onSelect={handleSelectArchive}
          />
        </ResizablePanel>
      </Show>
      
      {/* Center Panel: Editor */}
      <main class="editor-main">
        <EditorPanel
          nodeId={props.nodeId}
          onPublish={handlePublish}
        />
      </main>
      
      {/* Right Panel: AI Curator */}
      <Show when={rightPanelOpen()}>
        <ResizablePanel
          side="right"
          width={rightWidth()}
          onResize={setRightWidth}
        >
          <CuratorPanel
            content={editorContent()}
            onSuggestion={handleSuggestion}
          />
        </ResizablePanel>
      </Show>
    </div>
  );
}
```

#### VersionComparison (Diff View)

```typescript
interface VersionComparisonProps {
  narrativeId: string;
  fromVersion: number;
  toVersion: number;
}

export function VersionComparison(props: VersionComparisonProps) {
  const [comparison] = createResource(
    () => ({ ...props }),
    loadComparison
  );
  
  return (
    <Show when={!comparison.loading}>
      <div class="version-comparison">
        <div class="comparison-header">
          <div>Version {props.fromVersion}</div>
          <div>→</div>
          <div>Version {props.toVersion}</div>
        </div>
        
        <div class="comparison-summary">
          <p>{comparison().changes.summary}</p>
          <div class="stats">
            <span class="added">+{comparison().changes.addedLines}</span>
            <span class="removed">-{comparison().changes.removedLines}</span>
          </div>
        </div>
        
        <div class="split-view">
          <div class="version-pane">
            <MarkdownRenderer content={comparison().from.content} />
          </div>
          <div class="divider" />
          <div class="version-pane">
            <MarkdownRenderer content={comparison().to.content} />
          </div>
        </div>
        
        <div class="diff-view">
          <DiffViewer diff={comparison().diff} />
        </div>
      </div>
    </Show>
  );
}
```

---

## DATA FLOWS

### Flow 1: Publish Narrative

```
User writes in Studio
  ↓
EditorPanel.handlePublish()
  ↓
narrativesService.create(nodeId, {title, content, tags})
  ↓
POST /api/nodes/:nodeId/narratives
  ↓
Worker: Create narrative record in D1
  ↓
Worker: Generate embedding (Workers AI)
  ↓
Worker: Insert vector into Vectorize
  ↓
Worker: Update node.archive_metadata
  ↓
Worker: Increment subscriptions.unread_count (for all subscribers)
  ↓
Worker: Queue notification jobs (email)
  ↓
Response 201 {narrative}
  ↓
Frontend: Navigate to /node/:slug/:narrativeSlug
```

### Flow 2: Comment & Synthesis

```
User writes comment on narrative
  ↓
CommentComposer.handleSubmit()
  ↓
commentsService.create(narrativeId, {content, context})
  ↓
POST /api/narratives/:id/comments
  ↓
Worker: Create comment record (status: pending)
  ↓
Worker: Queue curator evaluation job
  ↓
Response 201 {comment}
  ↓
Frontend: Show "Comment submitted for review"

[Async: Curator Evaluation Job]
  ↓
Queue Consumer: Load comment + narrative
  ↓
Queue Consumer: Call Workers AI (evaluate quality/relevance)
  ↓
Queue Consumer: Update comment.curator_evaluation
  ↓
Queue Consumer: Set comment.status = 'approved' or 'rejected'
  ↓
IF approved AND pendingComments >= threshold:
  Queue Synthesis Job

[Async: Synthesis Job]
  ↓
Queue Consumer: Load narrative + all approved comments
  ↓
Queue Consumer: Call Workers AI (synthesize new version)
  ↓
Queue Consumer: Create new narrative_version
  ↓
Queue Consumer: Update narrative.content
  ↓
Queue Consumer: Update narrative.current_version++
  ↓
Queue Consumer: Mark comments as synthesized
  ↓
Queue Consumer: Increment subscriptions.unread_count
  ↓
Queue Consumer: Queue notification jobs
```

### Flow 3: Dashboard Update Check

```
User loads dashboard
  ↓
DashboardPage loads subscriptions
  ↓
subscriptionsService.list()
  ↓
GET /api/subscriptions
  ↓
Worker: Query subscriptions WHERE antinode_id = user
  ↓
Worker: Join with nodes
  ↓
Worker: Return [{node, unreadCount, lastChecked}]
  ↓
Response 200 {subscriptions}
  ↓
Frontend: Render SubscriptionList
  ↓
Show each Node with [unreadCount] badge

User clicks Node
  ↓
Navigate to /node/:slug
  ↓
NodeDetailPage loads node + narratives
  ↓
Filter narratives WHERE updated_at > lastChecked
  ↓
Show narratives with "NEW" or "UPDATED" indicators

User clicks "Mark All Read"
  ↓
subscriptionsService.markRead(subscriptionId)
  ↓
PUT /api/subscriptions/:id/mark-read
  ↓
Worker: SET unread_count = 0, last_checked = NOW()
  ↓
Response 200
  ↓
Frontend: Update local state (unreadCount = 0)
```

---

## AI INTEGRATION

### Workers AI Models

**Content Moderation**:
- Model: `@cf/meta/llama-guard-2-8b`
- Purpose: Filter harmful content
- Usage: Run on all comments, narratives before publish

**Embedding Generation**:
- Model: `@cf/baai/bge-base-en-v1.5`
- Purpose: Semantic search
- Dimensions: 768
- Usage: Generate on narrative publish/update

**Synthesis**:
- Model: `@cf/meta/llama-3.2-3b-instruct` or Claude API
- Purpose: Refine narrative based on comments
- Usage: Async queue job

**Curator Evaluation**:
- Model: `@cf/meta/llama-3.2-3b-instruct`
- Purpose: Evaluate comment quality/relevance
- Usage: Async queue job

### Synthesis Prompt Template

```typescript
const SYNTHESIS_PROMPT = `You are an AI curator for the "${node.name}" Node.
Your personality is: ${node.curator.personality}

Original narrative (v${currentVersion}):
---
${narrative.content}
---

Approved comments from community:
${comments.map(c => `- ${c.authorUsername}: ${c.content}`).join('\n')}

Task: Refine the narrative by incorporating valuable insights from comments.

Guidelines:
- Preserve the core argument and voice
- Integrate insights naturally (not as addenda)
- Improve clarity where comments identified confusion
- Maintain markdown formatting
- Keep similar length (±20%)

Output the refined narrative as markdown:`;
```

### Curator Evaluation Prompt

```typescript
const EVALUATION_PROMPT = `Evaluate this comment on a narrative about ${narrative.title}.

Node personality: ${node.curator.personality}
Filter criteria: ${JSON.stringify(node.curator.filterCriteria)}

Comment:
---
${comment.content}
---

Evaluate on:
1. Quality (0-1): Is it thoughtful, well-reasoned?
2. Relevance (0-1): Does it relate to the narrative?
3. Perspective: What does it add? (e.g. "New angle", "Clarification")

Output as JSON:
{
  "quality": 0.85,
  "relevance": 0.92,
  "perspective": "Offers important nuance",
  "synthesisNotes": "Incorporate empty intentionality concept"
}`;
```

---

## QUEUE SYSTEM

### Cloudflare Queue: `curation-queue`

**Purpose**: Async processing of curator evaluations and synthesis

**Message Format**:
```typescript
interface CurationMessage {
  type: 'evaluate-comment' | 'synthesize-narrative';
  commentId?: string;
  narrativeId?: string;
  commentIds?: string[];  // For synthesis
}
```

**Producer** (post-social-api):
```typescript
// On comment creation
await env.CURATION_QUEUE.send({
  type: 'evaluate-comment',
  commentId: comment.id,
});

// On synthesis trigger
await env.CURATION_QUEUE.send({
  type: 'synthesize-narrative',
  narrativeId: narrative.id,
  commentIds: approvedCommentIds,
});
```

**Consumer** (queue worker):
```typescript
export default {
  async queue(batch: MessageBatch<CurationMessage>, env: Env) {
    for (const message of batch.messages) {
      if (message.body.type === 'evaluate-comment') {
        await evaluateComment(message.body.commentId, env);
      } else if (message.body.type === 'synthesize-narrative') {
        await synthesizeNarrative(
          message.body.narrativeId,
          message.body.commentIds,
          env
        );
      }
      message.ack();
    }
  },
};
```

---

## ERROR HANDLING

### API Errors

**Standard Error Response**:
```json
{
  "error": "Invalid input",
  "message": "Title is required",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "title",
    "constraint": "required"
  }
}
```

**Error Codes**:
- `VALIDATION_ERROR` (400): Invalid input
- `UNAUTHORIZED` (401): Missing/invalid token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource doesn't exist
- `CONFLICT` (409): Duplicate resource
- `RATE_LIMIT` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

### Frontend Error Handling

```typescript
try {
  await narrativesService.create(nodeId, data);
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    showToast('Please fix validation errors', 'error');
  } else if (error.code === 'UNAUTHORIZED') {
    authStore.logout();
    navigate('/login');
  } else {
    showToast('Failed to create narrative', 'error');
    console.error(error);
  }
}
```

---

## TESTING STRATEGY

### Unit Tests (Optional for V1)

**Priority**: Low (rapid iteration)  
**Coverage**: Critical utilities only (diff generation, slug creation)

### Integration Tests

**Priority**: High  
**Method**: Manual testing by human  
**Checklist**:
- [ ] Create Node
- [ ] Publish narrative
- [ ] Subscribe to Node
- [ ] Post comment
- [ ] View version diff
- [ ] Mark Node as read
- [ ] Dashboard shows correct counts

### E2E Tests (Future)

**Priority**: Low for V1  
**Tools**: Playwright (when stable)

---

## DEPLOYMENT PROCESS

### Phase 1: Database Schema

```bash
# Apply migrations to D1
cd workers/post-social-api
npx wrangler d1 migrations create add-nodes-table
npx wrangler d1 migrations create add-narratives-table
npx wrangler d1 migrations create add-versions-table
npx wrangler d1 migrations create add-comments-table
npx wrangler d1 migrations create add-subscriptions-table
npx wrangler d1 migrations apply post-social-db --remote
```

### Phase 2: Backend Deployment

```bash
# Deploy post-social-api
cd workers/post-social-api
npm run deploy
```

### Phase 3: Frontend Deployment

```bash
# Build and deploy post-social-ui
cd workers/post-social-ui
npm run build
npm run deploy
```

### Phase 4: Queue Setup

```bash
# Create queue
npx wrangler queues create curation-queue

# Add to wrangler.toml, redeploy Worker
```

### Phase 5: Vectorize Setup

```bash
# Create index (if not exists)
npx wrangler vectorize create post-social-posts --dimensions=768 --metric=cosine
```

---

## PERFORMANCE OPTIMIZATION

### Database Indexes

All critical queries have indexes:
- `idx_nodes_slug` - Fast Node lookup by slug
- `idx_narratives_node` - Fast narrative list per Node
- `idx_comments_narrative` - Fast comment load per narrative
- `idx_subscriptions_antinode` - Fast subscription list

### Caching Strategy

**CDN Cache** (Cloudflare):
- Public narratives: 5 minutes
- Node directories: 1 minute
- User-specific: No cache

**Workers Cache API**:
- Embeddings: 1 hour
- Node metadata: 5 minutes

### Pagination

All list endpoints paginated (max 100 results):
- Nodes: 20 per page
- Narratives: 20 per page
- Comments: 50 per page
- Versions: No limit (typically <50)

---

## SECURITY MEASURES

### Authentication

- JWT validation on all protected endpoints
- Token expiration: 7 days
- Refresh tokens: Not implemented (re-login required)

### Authorization

- Node CRUD: Owner only
- Narrative publish: Node owner only
- Comment post: Any authenticated user
- Comment evaluate: Node owner only
- Synthesis trigger: Node owner only

### Content Moderation

- Llama Guard on all comments
- Llama Guard on all narratives
- Reject if moderation fails

### Rate Limiting

- API: 100 requests/minute per user
- Comments: 10 per hour per user
- Narratives: 10 per day per Node

---

## MONITORING & ANALYTICS

### Metrics to Track

**System Health**:
- API response times (p50, p95, p99)
- Error rate by endpoint
- Workers AI latency
- Queue depth (curation-queue)

**Usage Metrics**:
- Daily active Antinodes
- Nodes created per day
- Narratives published per day
- Comments posted per day
- Synthesis jobs completed per day

**Quality Metrics**:
- Avg comment quality score
- Avg semantic shift per version
- Subscriber retention (30d, 90d)
- Narrative update frequency

### Logging

**Log Levels**:
- `ERROR`: System failures, AI errors
- `WARN`: Rate limits hit, moderation rejections
- `INFO`: Narrative published, synthesis completed
- `DEBUG`: Detailed request/response (dev only)

**Structured Logging**:
```typescript
console.log(JSON.stringify({
  level: 'INFO',
  message: 'Narrative published',
  narrativeId: 'narrative-789',
  nodeId: 'node-123',
  version: 1,
  timestamp: new Date().toISOString(),
}));
```

---

## APPENDIX: Migration Plan

### From Current Post-Social to Node System

**Phase 1: Additive Changes** (no breaking changes)
- Add Nodes table
- Add Narratives table (separate from posts)
- Add Versions table
- Add Subscriptions table
- Keep existing posts table

**Phase 2: Data Migration**
- Migrate posts → narratives (v1)
- Migrate users → antinodes
- Create default Node per user ("My Writings")
- Migrate follows → subscriptions

**Phase 3: Deprecation**
- Mark old endpoints as deprecated
- Add warnings to old UI
- Redirect old URLs to new

**Phase 4: Cutover**
- Remove old posts table
- Remove old UI
- Full Node system only

**Timeline**: 4-6 weeks (not immediate)

---

**END OF DESIGN SPECIFICATION**
