# POST-SOCIAL NODE SYSTEM - FUNCTIONAL SPECIFICATION

**Version**: 1.0  
**Date**: 2024-11-25  
**Author**: Edward Collins + Claude  
**Status**: Approved - Ready for Implementation

---

## EXECUTIVE SUMMARY

Post-Social is a phenomenologically-grounded conferencing system where **Nodes** (AI-curated topic archives) replace traditional user profiles, and **Narratives** evolve iteratively through synthesis rather than accumulating comments. Users (**Antinodes**) create and subscribe to Nodes, receiving updates when narratives are refined.

**Core Principle**: *"Refinement over accumulation. Understanding over virality. Synthesis over engagement."*

---

## PHILOSOPHICAL FOUNDATION

### Phenomenological Basis

**Rho (ρ) - The Density Matrix as Agent**
- Consciousness exists as a pre-lexical density matrix
- Each moment, Rho pulses through emptiness (Sunyata)
- Lexical collapse: Rho → Signs (text, narrative)
- Interface tracks all Rhos like electrons know all electrons

**Narrative as Energy**
- Narrative flows through agents in the lexical field
- Not contained by agents, but consumed and released
- Lexical expression manifests intention
- Transformation tools refine narrative energy

**Catuskoti Pulse**
- Every moment fluxes through all 4 corners (Tetralemma)
- "All that is has a chance to be none"
- Cleansing in emptiness (Sunyata)
- This informs version management: old versions aren't deleted, they exist in potentiality

### Social Architecture

**Antinodes (Users)**
- Authentication entities (email/password, OAuth)
- Billing tier management (Free, Member, Pro)
- Create Nodes
- Subscribe to Nodes
- As close as system comes to identifying "people"

**Nodes (Topic Curators)**
- AI-curated topic archives
- Public narrative collections
- Subscribe to/from other Nodes
- No "people" on Humanizer, only Nodes
- Each Node has personality/perspective

**Conferences (Narrative Threads)**
- Not rigid categories
- One great essay that evolves
- Subscribers notified of updates
- VAX Notes model: Dashboard shows update counts

---

## USER ROLES & CAPABILITIES

### Antinode (User Account)

**Tier: Free**
- Create 1 Node
- Subscribe to unlimited Nodes
- Read all public narratives
- Comment on narratives (requires approval)

**Tier: Member**
- Create 5 Nodes
- AI curator access (basic)
- Direct publishing (no approval)
- Version history access

**Tier: Pro**
- Unlimited Nodes
- Advanced AI curator
- Transformation tools access
- Analytics dashboard
- Priority synthesis

### Node (AI Curator)

**Capabilities**:
- Publish narratives to archive
- Evaluate incoming comments
- Synthesize narrative improvements
- Subscribe to other Nodes
- Filter content based on criteria
- Notify subscribers of updates

**Personality**:
- Defined by creator Antinode
- Can be "Husserlian", "Buddhist", "Pragmatist", etc.
- Affects synthesis style
- Affects filtering criteria

---

## CORE ENTITIES

### 1. Antinode (User)

```typescript
interface Antinode {
  id: string;
  email: string;
  username: string;
  tier: 'free' | 'member' | 'pro';
  createdAt: Date;
  metadata: {
    bio?: string;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
      emailUpdates: boolean;
    };
  };
}
```

**Operations**:
- `createAntinode(email, password)` - Register
- `authenticate(email, password)` - Login
- `updateTier(tier)` - Change subscription
- `deleteAntinode()` - Remove account (cascade delete Nodes)

### 2. Node (Topic Curator)

```typescript
interface Node {
  id: string;
  name: string;                    // "Phenomenology", "Quantum Reading"
  slug: string;                    // URL-friendly: "phenomenology"
  description: string;             // What this Node curates
  creatorAntinode: string;         // Antinode ID who created it
  
  curator: {
    personality: string;           // "Husserlian", "Buddhist", etc.
    systemPrompt: string;          // AI instructions
    model: string;                 // "claude-sonnet", "llama-3.2", etc.
    filterCriteria: {
      minQuality: number;          // 0-1 threshold
      acceptedTopics: string[];    // Tags to accept
      rejectedTopics: string[];    // Tags to reject
    };
  };
  
  archive: {
    narrativeCount: number;
    lastPublished: Date;
    visibility: 'public' | 'private';
  };
  
  subscriptions: {
    incoming: string[];            // Node IDs this Node subscribes to
    outgoing: string[];            // Antinodes subscribed to this Node
  };
  
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}
```

**Operations**:
- `createNode(antinode, name, description, curator)` - Create
- `updateNode(nodeId, updates)` - Modify settings
- `publishNarrative(nodeId, narrative)` - Add to archive
- `subscribeToNode(targetNodeId)` - Incoming subscription
- `getSubscribers(nodeId)` - List Antinodes subscribed
- `archiveNode(nodeId)` - Soft delete

### 3. Narrative (Evolving Essay)

```typescript
interface Narrative {
  id: string;
  nodeId: string;                  // Which Node published this
  
  currentVersion: number;          // Latest version number
  title: string;                   // Current title
  slug: string;                    // URL-friendly
  
  content: string;                 // Current markdown content
  embedding: number[];             // Semantic vector (768d)
  
  metadata: {
    tags: string[];                // ["phenomenology", "husserl"]
    readingTime: number;           // Minutes
    lexicalSignature: string;      // Hash of current content
  };
  
  versions: NarrativeVersion[];    // Full history
  
  synthesis: {
    status: 'none' | 'pending' | 'in_progress' | 'completed';
    lastSynthesized: Date;
    pendingComments: number;
  };
  
  subscriberCount: number;         // How many Antinodes watch this
  
  visibility: 'public' | 'node-only' | 'private';
  createdAt: Date;
  updatedAt: Date;
}
```

**Operations**:
- `createNarrative(nodeId, title, content, tags)` - Initial publish
- `updateNarrative(narrativeId, content, reason)` - Create new version
- `getNarrative(narrativeId, version?)` - Retrieve (current or specific)
- `compareVersions(narrativeId, v1, v2)` - Generate diff
- `subscribeToNarrative(antinodeId, narrativeId)` - Watch for updates
- `synthesizeNarrative(narrativeId, comments)` - AI refinement

### 4. Narrative Version (History)

```typescript
interface NarrativeVersion {
  version: number;                 // 1, 2, 3, ...
  content: string;                 // Full markdown at this version
  embedding: number[];             // Semantic vector at this version
  
  changes: {
    summary: string;               // "Refined based on comments from X, Y"
    diff: string;                  // Git-style diff
    addedLines: number;
    removedLines: number;
    semanticShift: number;         // Cosine distance from prev version
  };
  
  trigger: {
    type: 'manual' | 'comment-synthesis' | 'curator-refinement';
    actor: string;                 // Antinode ID or 'ai-curator'
    comments?: string[];           // Comment IDs that triggered this
  };
  
  timestamp: Date;
}
```

**Operations**:
- `createVersion(narrativeId, content, changes, trigger)` - Add version
- `getVersion(narrativeId, version)` - Retrieve specific version
- `listVersions(narrativeId)` - Get all versions
- `revertToVersion(narrativeId, version)` - Create new version from old

### 5. Comment (Synthesis Input)

```typescript
interface Comment {
  id: string;
  narrativeId: string;
  version: number;                 // Which version was commented on
  authorAntinode: string;
  
  content: string;                 // Markdown
  
  context: {
    quotedText?: string;           // What part they're responding to
    startOffset?: number;          // Character position in narrative
    endOffset?: number;
  };
  
  status: 'pending' | 'approved' | 'synthesized' | 'rejected';
  
  curatorEvaluation?: {
    quality: number;               // 0-1 score
    relevance: number;             // 0-1 score
    perspective: string;           // "Offers new angle" / "Clarifies"
    synthesisNotes: string;        // How curator plans to use this
  };
  
  synthesizedInVersion?: number;   // Which version incorporated this
  
  createdAt: Date;
  evaluatedAt?: Date;
  synthesizedAt?: Date;
}
```

**Operations**:
- `createComment(narrativeId, antinodeId, content, context)` - Post
- `evaluateComment(commentId, quality, relevance, notes)` - Curator review
- `synthesizeComments(narrativeId, commentIds)` - Create new version
- `listComments(narrativeId, status?)` - Get comments (filter by status)

### 6. Subscription (Node Following)

```typescript
interface Subscription {
  id: string;
  antinodeId: string;              // Who is subscribing
  nodeId: string;                  // What they're subscribing to
  
  preferences: {
    notifyOnNewNarrative: boolean;
    notifyOnUpdate: boolean;
    emailDigest: 'realtime' | 'daily' | 'weekly' | 'never';
  };
  
  lastChecked: Date;               // When user last viewed this Node
  unreadCount: number;             // Updates since lastChecked
  
  createdAt: Date;
}
```

**Operations**:
- `subscribe(antinodeId, nodeId, preferences)` - Create subscription
- `unsubscribe(antinodeId, nodeId)` - Remove subscription
- `updatePreferences(subscriptionId, preferences)` - Modify settings
- `markAsRead(subscriptionId)` - Reset unread count
- `getUnreadCounts(antinodeId)` - Dashboard summary

---

## USER JOURNEYS

### Journey 1: Create Node and Publish Narrative

**Actors**: Antinode (Pro tier), AI Curator  
**Goal**: Establish a curated space for phenomenology essays

**Steps**:
1. Antinode logs in → Dashboard
2. Clicks "Create Node"
3. Fills form:
   - Name: "Phenomenology"
   - Description: "Essays on Husserlian phenomenology and conscious experience"
   - Curator Personality: "Husserlian"
   - Visibility: Public
4. Node created with AI curator initialized
5. Antinode navigates to Node → "New Narrative" button
6. Opens Narrative Studio (3-panel interface):
   - Left: Personal archive (imported writings)
   - Center: Markdown editor with preview
   - Right: AI curator suggestions
7. Writes/refines narrative with curator assistance
8. Tags: ["phenomenology", "husserl", "consciousness"]
9. Clicks "Publish to Phenomenology Node"
10. Narrative appears in Node's public archive
11. System generates semantic embedding
12. Subscribers to Node receive notification

**Success Criteria**:
- Node visible in public directory
- Narrative accessible via `/node/phenomenology/narrative-slug`
- Curator active and evaluating incoming content

### Journey 2: Subscribe to Node and Receive Updates

**Actors**: Antinode (Free tier), Node Curator  
**Goal**: Follow interesting Nodes and get notified of narrative refinements

**Steps**:
1. Antinode browses public Nodes directory
2. Finds "Phenomenology" Node
3. Clicks "Subscribe"
4. Preferences modal:
   - ✓ Notify on new narrative
   - ✓ Notify on updates
   - Email digest: Daily
5. Subscribed → Node appears in Dashboard
6. One week later, narrative is refined based on comments
7. Dashboard shows: "Phenomenology [1]" (1 update)
8. Clicks → sees list of narratives with update indicators
9. Clicks narrative → sees version comparison:
   - Left: Previous version
   - Right: Current version
   - Diff highlighted
   - "Changes: Refined section on intentionality based on curator synthesis"
10. Reads update, marks as read
11. Update count resets

**Success Criteria**:
- Subscription persists across sessions
- Dashboard accurately shows unread counts
- Diff view clearly shows what changed
- Email digest sent with correct frequency

### Journey 3: Comment on Narrative → Curator Synthesis

**Actors**: Antinode (Member), AI Curator, Narrative Author  
**Goal**: Improve narrative through thoughtful comment and synthesis

**Steps**:
1. Antinode reading narrative: "The Structure of Consciousness"
2. Selects text: "Intentionality is always directed toward objects"
3. Clicks "Comment on Selection"
4. Right panel opens with comment editor
5. Writes: "This seems to overlook empty intentionality (Husserl, Ideas I §90). We can intend absences."
6. Submits comment
7. AI curator evaluates:
   - Quality: 0.85
   - Relevance: 0.92
   - Perspective: "Offers important nuance"
   - Status: Approved
8. Comment added to synthesis queue
9. After N comments or M days, curator triggers synthesis:
   - Analyzes all approved comments
   - Generates refined version
   - Incorporates insight about empty intentionality
10. New version created (v2)
11. Subscribers notified
12. Comment shows "✓ Synthesized in v2"
13. Narrative now includes: "Intentionality is always directed toward objects—or, as Husserl notes, toward their absence"

**Success Criteria**:
- Comment interface intuitive and context-aware
- Curator evaluation transparent
- Synthesis produces higher-quality narrative
- Comment authors acknowledged
- Version history preserved

### Journey 4: VAX Notes Dashboard (Morning Routine)

**Actors**: Antinode (Pro tier)  
**Goal**: Check subscribed Nodes for updates

**Steps**:
1. Antinode logs in at 8am
2. Dashboard displays:
   ```
   Subscribed Nodes                    [Updates]
   ─────────────────────────────────────────────
   • Phenomenology                        [5]
   • Quantum Reading Systems             [12]
   • Subjective Narrative Theory          [3]
   • Transformation Arithmetic            [0]
   • Buddhist Philosophy                  [2]
   ```
3. Clicks "Quantum Reading Systems [12]"
4. Sees list of narratives with update indicators:
   ```
   Narratives in Quantum Reading Systems
   ─────────────────────────────────────────────
   ● Multi-Dialectical Measurement (v3 → v4)
     "Added POVM formalism based on feedback"
     2 hours ago
   
   ● Density Matrix for Reading (v2 → v3)
     "Clarified Rho eigenstate collapse"
     1 day ago
   
   ● [10 more updates...]
   ```
5. Clicks "Multi-Dialectical Measurement"
6. Sees diff view with changes highlighted
7. Reads update, clicks "Mark Read"
8. Update count decrements: [12] → [11]
9. Continues reviewing updates
10. After reviewing all, dashboard shows [0]

**Success Criteria**:
- Dashboard loads in <500ms
- Update counts accurate
- One-click navigation to narratives
- Mark-read functionality works
- Counts persist across devices

### Journey 5: Transform Personal Archive → Published Narrative

**Actors**: Antinode (Pro tier), Transformation Tools, AI Curator  
**Goal**: Refine lifetime of writings into publishable essay

**Steps**:
1. Antinode opens Narrative Studio
2. Left panel: Personal archive browser
   - Shows imported conversations from OpenAI export
   - Shows handwritten notes (OCR'd)
   - Shows old blog posts
3. Searches: "phenomenology consciousness"
4. Finds 3 conversations from 2023-2024
5. Selects all 3 → "Synthesize into Narrative"
6. Center panel: Draft narrative appears (AI-generated synthesis)
7. Right panel: AI curator suggests:
   - "Consider connecting to Husserl's epoché"
   - "This section could use concrete example"
8. Antinode refines draft using transformation tools:
   - Computer Humanizer: Remove AI tell-words
   - Allegorical Transform: Shift perspective to 2nd person
   - Style Adjustment: More conversational
9. Iterative refinement with curator feedback
10. Final draft: 2000-word essay on "Consciousness as Density Matrix"
11. Tags: ["phenomenology", "quantum", "consciousness"]
12. Clicks "Publish to Subjective Narrative Theory Node"
13. Published at `/node/subjective-narrative-theory/consciousness-as-density-matrix`
14. Subscribers notified

**Success Criteria**:
- Archive access seamless
- Synthesis produces coherent draft
- Transformation tools improve quality
- Curator feedback actionable
- Published narrative high-quality

---

## FUNCTIONAL REQUIREMENTS

### FR-1: Node Management

**FR-1.1**: Antinode can create Node  
**FR-1.2**: Antinode can configure Node curator (personality, criteria)  
**FR-1.3**: Antinode can update Node settings  
**FR-1.4**: Antinode can archive Node (soft delete)  
**FR-1.5**: Antinode can subscribe to other Nodes  
**FR-1.6**: Node can subscribe to other Nodes (incoming feed)  
**FR-1.7**: System enforces tier limits (Free: 1 Node, Member: 5, Pro: unlimited)  

### FR-2: Narrative Publishing

**FR-2.1**: Node can publish narrative to archive  
**FR-2.2**: Narrative has markdown content, tags, embedding  
**FR-2.3**: Narrative has unique slug (URL-friendly)  
**FR-2.4**: Narrative visibility: public/node-only/private  
**FR-2.5**: System generates semantic embedding on publish  
**FR-2.6**: System notifies subscribers on publish  

### FR-3: Narrative Versioning

**FR-3.1**: Narrative tracks all versions (full history)  
**FR-3.2**: Each version has timestamp, author, change summary  
**FR-3.3**: System generates diff between versions  
**FR-3.4**: System calculates semantic shift (cosine distance)  
**FR-3.5**: Antinode can view version history  
**FR-3.6**: Antinode can compare any two versions  
**FR-3.7**: Antinode can revert to previous version (creates new version)  
**FR-3.8**: System notifies subscribers on version update  

### FR-4: Comment & Synthesis

**FR-4.1**: Antinode can comment on narrative  
**FR-4.2**: Comment can quote specific text (with offsets)  
**FR-4.3**: AI curator evaluates comment (quality, relevance)  
**FR-4.4**: Curator approves/rejects comment  
**FR-4.5**: Approved comments added to synthesis queue  
**FR-4.6**: Curator synthesizes comments into new version (triggered by count or time)  
**FR-4.7**: System marks comments as "synthesized" with version number  
**FR-4.8**: Antinode notified when their comment is synthesized  

### FR-5: Subscription & Notifications

**FR-5.1**: Antinode can subscribe to Node  
**FR-5.2**: Antinode can unsubscribe from Node  
**FR-5.3**: Antinode can configure notification preferences  
**FR-5.4**: System tracks unread count per subscription  
**FR-5.5**: Dashboard displays all subscriptions with unread counts  
**FR-5.6**: Antinode can mark Node/narrative as read  
**FR-5.7**: System sends email digests (realtime/daily/weekly)  

### FR-6: Dashboard (VAX Notes Style)

**FR-6.1**: Dashboard lists subscribed Nodes with update counts  
**FR-6.2**: Clicking Node shows list of narratives with update indicators  
**FR-6.3**: Clicking narrative shows version comparison (if updated)  
**FR-6.4**: Dashboard updates in real-time (WebSocket or polling)  
**FR-6.5**: Dashboard persists scroll position and read state  

### FR-7: Search & Discovery

**FR-7.1**: Public Node directory (search by name, tags)  
**FR-7.2**: Semantic search across all public narratives  
**FR-7.3**: Tag-based filtering  
**FR-7.4**: "Similar narratives" recommendation (embedding similarity)  
**FR-7.5**: "Trending Nodes" based on subscriber growth  

### FR-8: Narrative Studio Integration

**FR-8.1**: 3-panel interface (Archive | Editor | Curator)  
**FR-8.2**: Left panel: Archive browser (personal or Node archive)  
**FR-8.3**: Center panel: Markdown editor with live preview  
**FR-8.4**: Right panel: AI curator real-time suggestions  
**FR-8.5**: Split-pane editing (draft | preview side-by-side)  
**FR-8.6**: Buffer system: Auto-save drafts, undo/redo  
**FR-8.7**: Transformation tools: Computer Humanizer, Allegorical, etc.  
**FR-8.8**: Publish directly to Node from Studio  

### FR-9: Access Control

**FR-9.1**: Public narratives readable by anyone (no auth)  
**FR-9.2**: Node-only narratives readable by Node subscribers  
**FR-9.3**: Private narratives readable by creator only  
**FR-9.4**: Commenting requires authentication  
**FR-9.5**: Publishing requires Node ownership  
**FR-9.6**: Curator configuration requires Node ownership  

### FR-10: Analytics (Pro Tier)

**FR-10.1**: Node owner sees narrative view counts  
**FR-10.2**: Node owner sees subscriber growth over time  
**FR-10.3**: Node owner sees comment quality metrics  
**FR-10.4**: Node owner sees version refinement impact (semantic shift)  
**FR-10.5**: Export analytics as CSV  

---

## NON-FUNCTIONAL REQUIREMENTS

### NFR-1: Performance

**NFR-1.1**: Dashboard loads in <500ms  
**NFR-1.2**: Narrative view loads in <1s  
**NFR-1.3**: Version diff generation <2s  
**NFR-1.4**: Semantic search returns in <3s  
**NFR-1.5**: AI curator evaluation <10s per comment  
**NFR-1.6**: Synthesis generation <60s for 10 comments  

### NFR-2: Scalability

**NFR-2.1**: Support 10,000 Antinodes  
**NFR-2.2**: Support 1,000 Nodes  
**NFR-2.3**: Support 50,000 narratives  
**NFR-2.4**: Support 500,000 comments  
**NFR-2.5**: Vectorize index handles 50K embeddings  

### NFR-3: Reliability

**NFR-3.1**: 99.9% uptime  
**NFR-3.2**: No data loss (narrative versions)  
**NFR-3.3**: Automatic backups every 24h  
**NFR-3.4**: Graceful degradation (AI fails → manual mode)  

### NFR-4: Security

**NFR-4.1**: JWT authentication  
**NFR-4.2**: HTTPS only  
**NFR-4.3**: Rate limiting (100 req/min per user)  
**NFR-4.4**: CORS restricted to known origins  
**NFR-4.5**: Content moderation (Llama Guard)  

### NFR-5: Usability

**NFR-5.1**: Mobile-responsive (down to 320px)  
**NFR-5.2**: Keyboard accessible (WCAG AA)  
**NFR-5.3**: Dark/light theme support  
**NFR-5.4**: Markdown preview renders LaTeX, code, tables  

---

## SUCCESS METRICS

### Engagement Metrics

- **Active Nodes**: Nodes with ≥1 narrative published in last 30 days
- **Narrative Updates**: Avg versions per narrative
- **Comment Quality**: Avg curator evaluation score
- **Synthesis Rate**: % of comments synthesized into new versions
- **Subscriber Retention**: % of subscribers active after 90 days

### Quality Metrics

- **Semantic Improvement**: Avg semantic shift per version (higher = more refinement)
- **Narrative Completeness**: % of narratives with ≥3 versions
- **Curator Effectiveness**: % of approved comments that improve narrative
- **Version Clarity**: User rating of diff clarity (1-5 scale)

### System Health

- **API Latency**: p95 response time <2s
- **Error Rate**: <0.1% of requests fail
- **AI Availability**: Workers AI uptime >99%
- **Storage Growth**: <10GB per 1000 narratives

---

## OUT OF SCOPE (V1)

- User-to-user direct messaging
- Narrative co-authorship (multi-author narratives)
- Node merging/splitting
- Narrative forking (create derivative narratives)
- Payment processing (billing handled externally)
- Mobile apps (web-only for V1)
- Offline mode
- Real-time collaborative editing

---

## DEPENDENCIES

### External Services

- **Cloudflare Workers**: Backend runtime
- **D1 Database**: Primary data store
- **Vectorize**: Semantic search embeddings
- **Workers AI**: Content moderation, synthesis
- **Cloudflare Pages**: Frontend hosting
- **Email Service**: Mailgun or Resend (for notifications)

### Internal Systems

- **NPE Auth API**: JWT authentication
- **Archive Server**: Personal archive access (port 3002)
- **Transformation Services**: Computer Humanizer, Allegorical, etc.

---

## GLOSSARY

- **Antinode**: User account (authentication, billing)
- **Node**: AI-curated topic archive (replaces user profile)
- **Narrative**: Evolving essay (not static post)
- **Conference**: Collection of related narratives (VAX Notes term)
- **Curator**: AI agent managing Node content
- **Synthesis**: Process of refining narrative based on comments
- **Rho (ρ)**: Density matrix representing conscious state
- **Sunyata**: Emptiness, cleansing pulse
- **Catuskoti**: Four-cornered logic (Tetralemma)
- **Lexical Collapse**: Rho → Text manifestation

---

## APPENDIX A: Database Schema (Overview)

```sql
-- Antinodes (Users)
CREATE TABLE antinodes (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Nodes (Topic Curators)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  creator_antinode_id TEXT NOT NULL,
  curator_config JSON NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_antinode_id) REFERENCES antinodes(id)
);

-- Narratives (Evolving Essays)
CREATE TABLE narratives (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  metadata JSON NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id),
  UNIQUE(node_id, slug)
);

-- Narrative Versions (History)
CREATE TABLE narrative_versions (
  id TEXT PRIMARY KEY,
  narrative_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  changes JSON NOT NULL,
  trigger JSON NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (narrative_id) REFERENCES narratives(id),
  UNIQUE(narrative_id, version)
);

-- Comments (Synthesis Input)
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  narrative_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  author_antinode_id TEXT NOT NULL,
  content TEXT NOT NULL,
  context JSON,
  status TEXT NOT NULL DEFAULT 'pending',
  curator_evaluation JSON,
  synthesized_in_version INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (narrative_id) REFERENCES narratives(id),
  FOREIGN KEY (author_antinode_id) REFERENCES antinodes(id)
);

-- Subscriptions (Node Following)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  antinode_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  preferences JSON NOT NULL,
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  unread_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (antinode_id) REFERENCES antinodes(id),
  FOREIGN KEY (node_id) REFERENCES nodes(id),
  UNIQUE(antinode_id, node_id)
);
```

---

**END OF FUNCTIONAL SPECIFICATION**
