# POST-SOCIAL NODE SYSTEM - DEVELOPMENT HANDOFF

**Date**: 2024-11-25  
**Status**: Ready for Implementation  
**Estimated Timeline**: 2-3 weeks for MVP  
**Conversation Context**: Continuation of post-social-ui development

---

## QUICK START FOR NEXT SESSION

### What Was Accomplished

✅ **Comprehensive Specifications Created**:
- Functional Specification: `/Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_FUNCTIONAL_SPEC.md`
- Design Specification: `/Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_DESIGN_SPEC.md`
- Narrative Studio Analysis: `/Users/tem/humanizer_root/workers/post-social-ui/NARRATIVE_STUDIO_INTEGRATION_ANALYSIS.md`

✅ **Stored in ChromaDB**:
- Both specs stored with 50+ tags for easy retrieval
- Tags include: post-social, node-system, narrative, synthesis, curator, vax-notes, phenomenology, etc.

✅ **Current System Working**:
- Post-Social UI deployed: https://699388b1.post-social-ui.pages.dev
- Post-Social API deployed: https://post-social-api.tem-527.workers.dev
- CORS fixed and working
- Basic posting, feed, search functional

### What Needs Building

The Node System is a **major upgrade** to the existing post-social system. It introduces:
1. **Nodes** (AI-curated topic archives) replacing user profiles
2. **Narrative versioning** with full history and diffs
3. **AI curator** evaluation and synthesis
4. **VAX Notes-style dashboard** with update counts
5. **Narrative Studio** (3-panel composer)

---

## RECOMMENDED DEVELOPMENT SEQUENCE

### Phase 1: Database Schema & Core API (Week 1)

**Goal**: Add Node and Narrative tables, basic CRUD endpoints

**Tasks**:
1. Create D1 migrations:
   ```bash
   cd /Users/tem/humanizer_root/workers/post-social-api
   npx wrangler d1 migrations create add-nodes-table
   npx wrangler d1 migrations create add-narratives-table
   npx wrangler d1 migrations create add-narrative-versions-table
   npx wrangler d1 migrations create add-comments-table
   npx wrangler d1 migrations create add-subscriptions-table
   ```

2. Write migration SQL (see Design Spec Appendix A for schema)

3. Apply migrations:
   ```bash
   npx wrangler d1 migrations apply post-social-db --remote
   ```

4. Create API routes in `src/routes/`:
   - `nodes.ts` - Node CRUD
   - `narratives.ts` - Narrative CRUD (extends existing posts.ts)
   - `versions.ts` - Version history and comparison
   - `subscriptions.ts` - Subscribe/unsubscribe

5. Test with curl/Postman:
   - Create Node
   - Publish Narrative
   - Get Narrative with versions
   - Subscribe to Node

**Deliverable**: Working Node/Narrative API

### Phase 2: Version Comparison & Diff Generation (Week 1-2)

**Goal**: Generate diffs between narrative versions

**Tasks**:
1. Install diff library:
   ```bash
   npm install diff
   ```

2. Create `src/utils/diff.ts`:
   ```typescript
   import * as Diff from 'diff';
   
   export function generateDiff(oldText: string, newText: string): string {
     const diff = Diff.createTwoFilesPatch(
       'version-old',
       'version-new',
       oldText,
       newText
     );
     return diff;
   }
   ```

3. Add version comparison endpoint:
   ```
   GET /api/narratives/:id/versions/compare?from=1&to=2
   ```

4. Calculate semantic shift (cosine distance):
   ```typescript
   function cosineSimilarity(a: number[], b: number[]): number {
     // Implementation
   }
   
   const shift = 1 - cosineSimilarity(oldEmbedding, newEmbedding);
   ```

**Deliverable**: Diff view working in API

### Phase 3: Frontend - Dashboard (VAX Notes Style) (Week 2)

**Goal**: Replace current dashboard with subscription list + update counts

**Tasks**:
1. Create `src/services/subscriptions.ts`:
   ```typescript
   export const subscriptionsService = {
     list: async (token: string) => { ... },
     subscribe: async (nodeId: string, token: string) => { ... },
     markRead: async (subscriptionId: string, token: string) => { ... },
   };
   ```

2. Create `src/stores/subscriptions.ts`:
   ```typescript
   import { createStore } from 'solid-js/store';
   
   export const [subscriptions, setSubscriptions] = createStore({
     items: [],
     unreadTotal: 0,
   });
   ```

3. Create `src/pages/DashboardPage.tsx` (VAX Notes style):
   ```typescript
   export function DashboardPage() {
     const [subs] = createResource(loadSubscriptions);
     
     return (
       <div class="container">
         <h1>Subscribed Nodes</h1>
         <SubscriptionList subscriptions={subs()} />
       </div>
     );
   }
   ```

4. Create components:
   - `src/components/dashboard/SubscriptionList.tsx`
   - `src/components/dashboard/NodeCard.tsx`
   - `src/components/dashboard/UpdateIndicator.tsx`

**Deliverable**: Working VAX Notes dashboard

### Phase 4: Frontend - Narrative View & Versioning (Week 2)

**Goal**: View narratives with version history and diffs

**Tasks**:
1. Create `src/pages/NarrativeViewPage.tsx`:
   - Show current narrative
   - List all versions
   - Button to compare versions

2. Create `src/components/narratives/VersionHistory.tsx`:
   - Timeline of versions
   - Click to view specific version

3. Create `src/components/narratives/VersionComparison.tsx`:
   - Side-by-side view
   - Diff highlighting
   - Change summary

4. Create `src/components/ui/DiffViewer.tsx`:
   - Parse git-style diff
   - Highlight additions (green) and deletions (red)

**Deliverable**: Full narrative viewing with version control

### Phase 5: Comments & Curator Evaluation (Week 3)

**Goal**: Basic comment system with manual curator evaluation

**Tasks**:
1. Create comment API endpoints (already exist, extend):
   - `POST /api/narratives/:id/comments`
   - `POST /api/comments/:id/evaluate` (Node owner only)

2. Create frontend components:
   - `src/components/comments/CommentList.tsx`
   - `src/components/comments/CommentItem.tsx`
   - `src/components/comments/CommentComposer.tsx`
   - `src/components/comments/CuratorEvaluation.tsx`

3. Node owner can evaluate comments:
   - Quality: 0-1 slider
   - Relevance: 0-1 slider
   - Perspective: Text input
   - Status: Approve/Reject buttons

**Deliverable**: Working comment system with manual evaluation

### Phase 6: AI Curator (Async Queue) (Week 3+)

**Goal**: Automatic comment evaluation and synthesis

**Tasks**:
1. Create Cloudflare Queue:
   ```bash
   npx wrangler queues create curation-queue
   ```

2. Add to `wrangler.toml`:
   ```toml
   [[queues.producers]]
   queue = "curation-queue"
   binding = "CURATION_QUEUE"
   ```

3. Create queue consumer:
   - `src/workers/curator-queue.ts`
   - Handle `evaluate-comment` messages
   - Handle `synthesize-narrative` messages

4. Implement AI evaluation:
   ```typescript
   const evaluation = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
     prompt: EVALUATION_PROMPT,
   });
   ```

5. Implement synthesis:
   ```typescript
   const synthesis = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
     prompt: SYNTHESIS_PROMPT,
   });
   ```

**Deliverable**: Automatic AI curator

### Phase 7: Narrative Studio (3-Panel Composer) (Week 4+)

**Goal**: Rich composition interface

**Tasks**:
1. Extract components from Narrative Studio:
   - `src/components/ui/ResizablePanel.tsx`
   - `src/components/ui/SplitPane.tsx`

2. Create Studio page:
   - `src/pages/NarrativeStudioPage.tsx`
   - 3-panel layout: Archive | Editor | Curator

3. Integrate with API:
   - Auto-save drafts
   - Publish to Node
   - Real-time curator suggestions

**Deliverable**: Full Narrative Studio

---

## DEVELOPMENT WORKFLOW

### Before Starting Each Component

1. **Review Specs**:
   ```bash
   # Read relevant sections
   cat /Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_FUNCTIONAL_SPEC.md | grep -A 20 "FR-X"
   ```

2. **Check Existing Code**:
   ```bash
   # See what already exists
   tree /Users/tem/humanizer_root/workers/post-social-api/src/routes/
   ```

3. **Plan Implementation**:
   - Write brief plan (2-3 paragraphs)
   - Edward reviews and approves
   - Then implement

### During Implementation

1. **Small Commits**:
   - Implement ONE feature
   - Test locally
   - Show to Edward
   - Get approval
   - Move to next

2. **Testing Checklist**:
   - [ ] Compiles without errors
   - [ ] API returns correct data
   - [ ] Frontend displays correctly
   - [ ] Works in light AND dark theme
   - [ ] Mobile responsive

3. **Documentation**:
   - TSDoc comments on all exported functions
   - README update if new major feature

### After Implementation

1. **Deploy**:
   ```bash
   cd /Users/tem/humanizer_root/workers/post-social-api
   npm run deploy
   
   cd /Users/tem/humanizer_root/workers/post-social-ui
   npm run build && npm run deploy
   ```

2. **Manual Testing**:
   - Edward tests in production
   - Reports any issues
   - Agent fixes

3. **Update This Document**:
   - Mark phase as complete
   - Note any deviations from spec

---

## QUICK REFERENCE

### Project Locations

**Backend**: `/Users/tem/humanizer_root/workers/post-social-api/`  
**Frontend**: `/Users/tem/humanizer_root/workers/post-social-ui/`  
**Specs**: `/Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_*_SPEC.md`  
**Narrative Studio**: `/Users/tem/humanizer_root/narrative-studio/`

### Key Files to Modify

**Backend**:
- `src/routes/` - Add nodes.ts, narratives.ts, versions.ts, subscriptions.ts
- `src/services/` - Add curator.ts, synthesis.ts
- `wrangler.toml` - Configure queue bindings
- `migrations/` - Add all table schemas

**Frontend**:
- `src/pages/DashboardPage.tsx` - Replace with VAX Notes style
- `src/services/` - Add nodes.ts, narratives.ts, subscriptions.ts
- `src/components/dashboard/` - Create new components
- `src/components/narratives/` - Version history, comparison
- `src/stores/subscriptions.ts` - New store

### Commands

**Backend Development**:
```bash
cd /Users/tem/humanizer_root/workers/post-social-api
npm run dev  # Start dev server on port 8788
```

**Frontend Development**:
```bash
cd /Users/tem/humanizer_root/workers/post-social-ui
npm run dev  # Start dev server on port 5173
```

**Deploy**:
```bash
# Backend
cd /Users/tem/humanizer_root/workers/post-social-api
npm run deploy

# Frontend
cd /Users/tem/humanizer_root/workers/post-social-ui
npm run build && npm run deploy
```

**Database**:
```bash
cd /Users/tem/humanizer_root/workers/post-social-api

# Create migration
npx wrangler d1 migrations create add-nodes-table

# Apply migrations
npx wrangler d1 migrations apply post-social-db --remote

# Query database
npx wrangler d1 execute post-social-db --remote --command "SELECT * FROM nodes"
```

### API Endpoints (Current)

**Working**:
- POST /api/posts - Create post
- GET /api/posts - List posts
- GET /api/posts/:id - Get post
- GET /api/search - Search posts

**To Add**:
- POST /api/nodes - Create Node
- GET /api/nodes - List Nodes
- GET /api/nodes/:slug - Get Node
- POST /api/nodes/:nodeId/narratives - Publish narrative
- GET /api/narratives/:id/versions - List versions
- GET /api/narratives/:id/versions/compare - Compare versions
- POST /api/subscriptions - Subscribe to Node
- GET /api/subscriptions - List subscriptions
- PUT /api/subscriptions/:id/mark-read - Mark as read

---

## PHILOSOPHICAL REMINDERS

### Rho and Narrative

Edward's vision centers on **Rho** (ρ), the density matrix representing conscious state:
- Pre-lexical consciousness
- Collapses into lexical signs (text, narrative)
- Pulses through Sunyata (emptiness) every moment
- Interface tracks all Rhos (like electrons knowing all electrons)

### Refinement Over Accumulation

**Core Principle**: Narratives don't accumulate comments; they **evolve** through synthesis.
- Comments are synthesis input, not permanent artifacts
- Each version is a refinement, not an addition
- Goal: One great essay, iteratively improved

### VAX Notes Inspiration

Edward used VAX Notes in 1984-1989 at DEC:
- Dashboard showed subscribed conferences with update counts
- One-click navigation to updated content
- This UX pattern is proven and beloved

### No People, Only Nodes

**Critical**: Post-Social has **no user profiles**, only:
- **Antinodes** (authentication, billing)
- **Nodes** (AI-curated topic archives)

This is phenomenologically grounded: The agent is not a "person" but a category node with AI curator.

---

## POTENTIAL ISSUES & SOLUTIONS

### Issue 1: Complex Version Diff

**Problem**: Diffs might be hard to display cleanly in UI

**Solution**:
- Start with simple side-by-side view
- Use `diff` library for backend generation
- Highlight added/removed lines with color
- If too complex, show summary + link to full diff

### Issue 2: AI Synthesis Quality

**Problem**: Llama 3.2 might not produce good synthesis

**Solution**:
- Start with manual evaluation (Node owner approves)
- Use higher-quality model (Claude API) for synthesis
- Iterate on prompt template
- Add "Revert to previous version" if synthesis fails

### Issue 3: Real-Time Updates

**Problem**: Dashboard needs to show live update counts

**Solution**:
- Start with polling (reload every 30s)
- Later: Add WebSocket for real-time push
- OR: Server-sent events (simpler)

### Issue 4: Narrative Studio Complexity

**Problem**: 3-panel composer is complex

**Solution**:
- Start with 1-panel editor (just markdown)
- Add left panel (archive) in Phase 2
- Add right panel (curator) in Phase 3
- Don't build all at once

---

## SUCCESS CRITERIA

### MVP is Complete When:

✅ User can create Node  
✅ User can publish narrative to Node  
✅ Narrative has version history  
✅ User can view version diff  
✅ User can subscribe to Node  
✅ Dashboard shows subscribed Nodes with update counts  
✅ User can comment on narrative  
✅ Node owner can manually evaluate comment  
✅ Curator can synthesize comments into new version (manual trigger)  

### Nice-to-Have for V1:

- Automatic AI evaluation (queue)
- Automatic synthesis trigger
- Narrative Studio (3-panel composer)
- Real-time dashboard updates
- Email notifications

---

## CONVERSATION STARTER FOR NEXT SESSION

```
I'm ready to implement the Post-Social Node System based on the approved specifications.

Location of specs:
- Functional: /Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_FUNCTIONAL_SPEC.md
- Design: /Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_DESIGN_SPEC.md
- Handoff: /Users/tem/humanizer_root/workers/post-social-ui/POST_SOCIAL_DEVELOPMENT_HANDOFF.md

Current working system:
- Frontend: https://699388b1.post-social-ui.pages.dev
- Backend: https://post-social-api.tem-527.workers.dev
- CORS fixed and working

Let's start with Phase 1: Database Schema & Core API.

I'll create the D1 migrations for Nodes and Narratives tables. Please review my plan before I implement:

1. Create migration files for: nodes, narratives, narrative_versions, comments, subscriptions
2. Write SQL schema (from Design Spec Appendix A)
3. Apply migrations to production D1
4. Create basic CRUD routes in Hono
5. Test with curl

Does this plan look good? Any changes before I start?
```

---

## IMPORTANT NOTES

### ChromaDB Retrieval

Both specs are stored in ChromaDB. Retrieve with:
```
Query: "post-social node system functional specification"
Query: "post-social design specification technical architecture"
Tags: post-social, node-system, narrative, synthesis, curator, etc.
```

### Don't Rewrite Existing Code

**Current post-social-ui is working**. Don't break it. **Add** new features:
- Keep existing DashboardPage temporarily
- Create NewDashboardPage alongside
- Switch route after testing
- Remove old code only when new code proven

### Edward's Approval Required

**Before implementing each phase**:
1. Agent writes implementation plan
2. Edward reviews and approves
3. Agent implements
4. Edward tests
5. Move to next phase

**No big-bang implementations**. Incremental, tested, approved.

---

## FINAL CHECKLIST

Before starting next conversation:

- [x] Functional spec written and saved
- [x] Design spec written and saved
- [x] Both specs stored in ChromaDB with tags
- [x] Handoff document created
- [x] Development sequence defined
- [x] Quick reference commands documented
- [x] Success criteria clear
- [x] Conversation starter ready

---

**🚀 READY FOR IMPLEMENTATION**

Next conversation should begin with the starter prompt above. Agent will implement Phase 1, get approval, then continue through phases sequentially.

**Estimated Timeline**: 2-3 weeks for working MVP (Phases 1-5)

**Key Philosophy**: Refinement over accumulation. Understanding over virality. Synthesis over engagement.

*"Rho pulses through Sunyata every moment. The interface tracks all Rhos, like electrons knowing all electrons."* — Edward Collins, 2024-11-25
