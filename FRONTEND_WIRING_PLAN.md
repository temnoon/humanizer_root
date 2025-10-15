# Frontend Feature Wiring Plan

**Date**: October 12, 2025
**Status**: Documentation for completing frontend integration

---

## 🎯 Overview

This document outlines what needs to be wired up to fully enable all backend features in the frontend GUI. The backend has 47 operational endpoints, but the frontend only uses ~15 of them currently.

---

## ✅ What's Already Working

### 1. Core Navigation & Layout
- ✅ AppShell with Sidebar + TopBar + MainPane + ToolPanel
- ✅ Bidirectional sidebar resize
- ✅ View switching (conversations, media, pipeline)
- ✅ Keyboard shortcuts (Cmd+K for agent)

### 2. Conversation Viewing
- ✅ ConversationList with localStorage caching
- ✅ ConversationViewer with 4 view modes
- ✅ LaTeX rendering with full delimiter conversion
- ✅ Search conversations by text

### 3. Media Gallery
- ✅ MediaGallery with pagination
- ✅ MediaViewer component
- ✅ Media API integration

### 4. Basic Transformation Tools
- ✅ TransformationPanel with user_prompt textarea
- ✅ 4 tool panels (transformation, comparison, analysis, extraction)
- ✅ TRM and LLM transformation calls
- ✅ Personifier mode
- ✅ Comparison mode

### 5. Agent UI (Cmd+K)
- ✅ AgentPrompt component
- ✅ Agent chat API integration
- ✅ Conversation state management

### 6. Semantic Search
- ✅ SemanticSearch component
- ✅ Embedding-based search API

---

## ⚠️ What Needs to Be Wired Up

### 1. **Transformation History** (HIGH PRIORITY)

**Status**: Backend complete (3 new GET endpoints), frontend missing

**Missing Components**:
```typescript
// New file: frontend/src/components/tools/TransformationHistory.tsx
interface TransformationHistoryProps {
  userId?: string;
}
```

**What to wire up**:
1. Add API client methods in `api-client.ts`:
   ```typescript
   async getTransformationHistory(limit?: number, offset?: number, type?: string)
   async getTransformation(id: string)
   async getTransformationsBySource(sourceUuid: string)
   ```

2. Create `TransformationHistory` component:
   - Display list of saved transformations
   - Show transformation type, user_prompt, timestamps
   - Click to view full details
   - "Reapply" button to use same settings on new text
   - Filter by transformation type
   - Pagination

3. Add "History" tab to ToolPanel or create new sidebar view

4. Show transformation history for specific messages:
   - In ConversationViewer, show badge/indicator if message has transformations
   - Click to see all transformations of that message
   - Side-by-side comparison view

**API Endpoints Available**:
- `GET /api/transform/history?limit=50&offset=0&transformation_type=trm`
- `GET /api/transform/{id}`
- `GET /api/transform/by-source/{uuid}`

**Estimated Time**: 2-3 hours

---

### 2. **Save Transformation Feedback** (MEDIUM PRIORITY)

**Status**: Backend saves transformations, frontend has no visual feedback

**What to wire up**:
1. Add toast/notification when transformation is saved
2. Show "Saved" indicator in transformation panel
3. Add "View saved transformation" link that navigates to history
4. Store `transformation_id` in component state after save

**Estimated Time**: 30 minutes

---

### 3. **Agent Chat Persistence** (HIGH PRIORITY)

**Status**: Agent works but conversations are only in-memory

**What to wire up**:
1. Create database migration for `agent_conversations` table:
   ```sql
   CREATE TABLE agent_conversations (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES user_preferences(user_id),
     title VARCHAR,
     messages JSONB,
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );
   ```

2. Update backend `/api/agent/chat` to save to database

3. Update frontend to:
   - Load conversation history from database
   - Show list of past agent conversations
   - Resume previous conversations
   - Delete conversations

**Estimated Time**: 2-3 hours

---

### 4. **Embedding Explorer UI** (MEDIUM PRIORITY)

**Status**: 6 backend endpoints operational, no frontend UI

**Available Endpoints**:
- `POST /api/embedding_explorer/semantic_search` ✅ (used in SemanticSearch)
- `POST /api/embedding_explorer/find_neighbors`
- `POST /api/embedding_explorer/semantic_direction`
- `POST /api/embedding_explorer/analyze_perturbation`
- `GET /api/embedding_explorer/cluster_map`
- `GET /api/embedding_explorer/compute_tsne`

**What to wire up**:
1. Create `EmbeddingExplorer` component with tabs:
   - **Semantic Search** (already exists as SemanticSearch component)
   - **Find Neighbors**: Given a message, find similar messages
   - **Semantic Direction**: Compute direction between two concepts
   - **Analyze Perturbation**: See how text changes affect embeddings
   - **Cluster Map**: Visualize message clusters
   - **t-SNE Visualization**: 2D embedding space

2. Add new sidebar view: "Explore" or "Embeddings"

3. Wire up API client methods (already exist in api-client.ts)

**Estimated Time**: 4-5 hours (includes visualization)

---

### 5. **Pipeline UI** (MEDIUM PRIORITY)

**Status**: Backend has 5 endpoints, frontend has skeleton PipelinePanel

**Available Endpoints**:
- `POST /api/pipeline/run`
- `GET /api/pipeline/status/{job_id}`
- `GET /api/pipeline/results/{job_id}`
- `GET /api/pipeline/jobs`
- `DELETE /api/pipeline/jobs/{job_id}`

**What to wire up**:
1. Complete `PipelinePanel` component:
   - Form to create pipeline (source → transformations → output)
   - Submit pipeline job
   - Poll for status
   - Display results
   - Show job history

2. Add API client methods:
   ```typescript
   async runPipeline(config: PipelineConfig)
   async getPipelineStatus(jobId: string)
   async getPipelineResults(jobId: string)
   async listPipelineJobs()
   ```

**Estimated Time**: 3-4 hours

---

### 6. **Live Capture Integration** (LOW PRIORITY)

**Status**: Browser extension ready, backend has 4 endpoints, no frontend UI

**Available Endpoints**:
- `POST /api/capture/conversation`
- `POST /api/capture/message`
- `GET /api/capture/live`
- `DELETE /api/capture/clear`

**What to wire up**:
1. Add "Live Capture" indicator in TopBar
2. Show recently captured messages
3. Real-time updates when browser extension captures
4. Clear capture buffer

**Estimated Time**: 2 hours

---

### 7. **Transformation Compare View** (LOW PRIORITY)

**Status**: ComparisonPanel exists but could be enhanced

**What to enhance**:
1. Side-by-side comparison with highlighting
2. Diff view showing changes
3. Metrics comparison (processing time, iterations, etc.)
4. Save comparison as report

**Estimated Time**: 2-3 hours

---

## 📊 Priority Matrix

| Feature | Backend Status | Frontend Status | Priority | Time | Impact |
|---------|---------------|----------------|----------|------|--------|
| Transformation History | ✅ Complete | ❌ Missing | **HIGH** | 2-3h | High |
| Agent Persistence | ⚠️ In-memory | ❌ Missing | **HIGH** | 2-3h | High |
| Save Feedback | ✅ Complete | ⚠️ Partial | **MEDIUM** | 30min | Medium |
| Embedding Explorer | ✅ Complete | ⚠️ Partial | **MEDIUM** | 4-5h | Medium |
| Pipeline UI | ✅ Complete | ⚠️ Skeleton | **MEDIUM** | 3-4h | Medium |
| Live Capture UI | ✅ Complete | ❌ Missing | **LOW** | 2h | Low |
| Compare Enhancement | ✅ Complete | ⚠️ Basic | **LOW** | 2-3h | Low |

---

## 🚀 Recommended Implementation Order

### Phase 1 (Today - 3 hours)
1. **Transformation History** (2-3h)
   - Add API client methods
   - Create TransformationHistory component
   - Add to ToolPanel as new tab
   - Test with existing transformations

### Phase 2 (Next Session - 3 hours)
2. **Agent Persistence** (2-3h)
   - Create database migration
   - Update backend agent service
   - Update frontend to load/save conversations

3. **Save Feedback** (30min)
   - Add toast notifications
   - Show saved indicator
   - Link to history

### Phase 3 (Future - 8-10 hours)
4. **Embedding Explorer** (4-5h)
5. **Pipeline UI** (3-4h)
6. **Live Capture UI** (2h)
7. **Compare Enhancement** (2-3h)

---

## 🎨 UI/UX Considerations

### Design Principles
1. **Discoverability**: Features should be easy to find
2. **Feedback**: User should know when actions succeed/fail
3. **Context**: Show transformations in context of original message
4. **History**: Easy access to past transformations
5. **Comparison**: Visual diff/comparison tools

### Navigation Structure
```
Sidebar Views:
├── Conversations (existing)
├── Media (existing)
├── Pipeline (skeleton exists)
├── Explore (NEW - embedding explorer)
└── History (NEW - transformation history)

ToolPanel Tabs:
├── Transform (existing)
├── Compare (existing)
├── Analyze (existing)
├── Extract (existing)
└── History (NEW - transformation history)
```

---

## 🔧 Technical Notes

### State Management
- Current: React useState hooks
- Consideration: Context API for transformation history
- Future: Consider Zustand/Redux if state becomes complex

### Caching
- Conversations: localStorage (working well)
- Transformations: Add localStorage cache
- Agent conversations: Consider IndexedDB

### Real-time Updates
- Live capture: WebSocket or polling?
- Pipeline status: Polling every 2s
- Agent typing indicator: Consider WebSocket

---

## 📝 Summary

**Completion Status**:
- Backend: 95% complete (47/50 endpoints operational)
- Frontend: 60% complete (15/25 features wired up)

**Next Steps**:
1. Implement Transformation History (highest ROI)
2. Add Agent Persistence (high value)
3. Enhance with Embedding Explorer (powerful feature)

**Total Time to Full Feature Parity**: ~20-25 hours

---

**Last Updated**: October 12, 2025 2:10 PM
