# Conversation Viewer Implementation Plan

## Current Status
- ✅ Images working
- ✅ Sidebar resize fixed
- ⚠️ ConversationList shows generic titles ("Conversation abc123...")
- ❌ No ConversationViewer component yet
- ❌ No transformation triggers

## What User Wants

### 1. Conversation List (Sidebar)
**Show real titles**: "Introducing Narrative Scope", "Hilbert space evaluation", etc.
- Currently: "Conversation 68aa3588..."
- Needed: Fetch actual conversation records from database

### 2. Conversation Viewer (Main Pane)
**When clicking conversation**:
- Load full conversation into main pane
- Render messages with rich text (markdown, LaTeX, etc.)
- Hide empty messages by default
- Show user/assistant/tool messages
- Add "Edit" button on each message → creates transformation

### 3. Transformations
- Any content can be transformed
- User chooses transformation type
- Saved as variation linked to original

---

## Implementation Steps

### Step 1: Add List Conversations Endpoint
**File**: `humanizer/api/chatgpt.py`

```python
@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    page: int = 1,
    page_size: int = 50,
    session: AsyncSession = Depends(get_session),
):
    """List all conversations with metadata."""
    offset = (page - 1) * page_size

    # Get conversations with message count
    stmt = (
        select(ChatGPTConversation)
        .order_by(ChatGPTConversation.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    conversations = result.scalars().all()

    # Get total count
    count_stmt = select(func.count()).select_from(ChatGPTConversation)
    total = await session.scalar(count_stmt)

    return ConversationListResponse(
        conversations=[...],
        total=total,
        page=page,
        page_size=page_size,
    )
```

### Step 2: Update API Client
**File**: `frontend/src/lib/api-client.ts`

```typescript
async listConversations(page: number = 1, pageSize: number = 50) {
  return this.request<{
    conversations: ConversationListItem[];
    total: number;
    page: number;
    page_size: number;
  }>(`/chatgpt/conversations?page=${page}&page_size=${pageSize}`);
}
```

### Step 3: Update ConversationList Component
**File**: `frontend/src/components/conversations/ConversationList.tsx`

```typescript
const loadConversations = async () => {
  // Replace search with direct list
  const result = await api.listConversations(1, 1000);
  setConversations(result.conversations);

  // Each conversation now has real title!
};
```

### Step 4: Create ConversationViewer Component
**File**: `frontend/src/components/conversations/ConversationViewer.tsx`

```typescript
export default function ConversationViewer({ conversationId }: Props) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  const loadConversation = async () => {
    // Get conversation metadata
    const conv = await api.getConversation(conversationId);
    setConversation(conv);

    // Render with markdown
    const rendered = await api.renderConversation(conversationId, {
      include_media: true,
      filter_empty_messages: true,
    });

    // Parse into message objects
    setMessages(parseRenderedMessages(rendered.markdown));
  };

  return (
    <div className="conversation-viewer">
      <div className="conversation-header">
        <h1>{conversation.title}</h1>
        <div className="metadata">
          {conversation.message_count} messages
          • {new Date(conversation.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="messages">
        {messages.map(msg => (
          <MessageCard key={msg.id} message={msg} onEdit={handleEdit} />
        ))}
      </div>
    </div>
  );
}
```

### Step 5: Create MessageCard Component
**File**: `frontend/src/components/conversations/MessageCard.tsx`

```typescript
export default function MessageCard({ message, onEdit }: Props) {
  return (
    <div className={`message-card ${message.role}`}>
      <div className="message-header">
        <span className="role-icon">
          {message.role === 'user' ? '👤' :
           message.role === 'assistant' ? '🤖' : '🔧'}
        </span>
        <span className="role-label">{message.role}</span>
        <span className="timestamp">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>

      <div className="message-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>

        {message.images?.map(img => (
          <img key={img.file_id} src={api.getMediaFile(img.file_id)} />
        ))}
      </div>

      <div className="message-actions">
        <button onClick={() => onEdit(message)}>
          ✏️ Edit (Create Transformation)
        </button>
        <button>💾 Save</button>
        <button>🔗 Link</button>
      </div>
    </div>
  );
}
```

### Step 6: Wire Up Selection State
**File**: `frontend/src/App.tsx` or create context

```typescript
const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

// Pass to ConversationList
<ConversationList
  onSelect={setSelectedConversation}
  selected={selectedConversation}
/>

// Pass to MainPane
<MainPane
  currentView={currentView}
  selectedConversation={selectedConversation}
/>
```

### Step 7: Add Transformation Modal
**File**: `frontend/src/components/transformations/TransformationModal.tsx`

```typescript
export default function TransformationModal({ message, onClose, onSave }: Props) {
  const [editedContent, setEditedContent] = useState(message.content);
  const [transformationType, setTransformationType] = useState('edit');

  const handleSave = async () => {
    // Create transformation record
    const transformation = await api.createTransformation({
      source_message_id: message.id,
      transformation_type: transformationType,
      new_content: editedContent,
    });

    onSave(transformation);
  };

  return (
    <div className="modal">
      <h2>Create Transformation</h2>

      <select value={transformationType} onChange={e => setTransformationType(e.target.value)}>
        <option value="edit">Edit Message</option>
        <option value="expand">Expand</option>
        <option value="summarize">Summarize</option>
        <option value="reframe">Reframe</option>
      </select>

      <textarea
        value={editedContent}
        onChange={e => setEditedContent(e.target.value)}
        rows={10}
      />

      <div className="actions">
        <button onClick={handleSave}>💾 Save Transformation</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
```

---

## Database Schema for Transformations

```sql
-- Already exists if following TRM architecture
CREATE TABLE transformations (
    id UUID PRIMARY KEY,
    source_message_id UUID REFERENCES chatgpt_messages(uuid),
    transformation_type VARCHAR(50),  -- 'edit', 'expand', 'summarize', etc.
    original_content TEXT,
    transformed_content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),  -- User ID
    custom_metadata JSONB
);
```

---

## API Endpoints Needed

### Already Exist:
- ✅ `GET /chatgpt/conversation/{uuid}` - Get conversation metadata
- ✅ `POST /chatgpt/conversation/{uuid}/render` - Render conversation
- ✅ `GET /chatgpt/stats` - Get archive stats

### Need to Add:
- ❌ `GET /chatgpt/conversations` - List all conversations with titles
- ❌ `POST /transformations` - Create transformation
- ❌ `GET /transformations/{id}` - Get transformation details
- ❌ `GET /message/{id}/transformations` - Get all transformations for a message

---

## File Structure

```
frontend/src/
├── components/
│   ├── conversations/
│   │   ├── ConversationList.tsx        [UPDATE - use real API]
│   │   ├── ConversationViewer.tsx      [NEW - main pane viewer]
│   │   └── MessageCard.tsx             [NEW - individual message]
│   ├── transformations/
│   │   ├── TransformationModal.tsx     [NEW - edit/transform UI]
│   │   └── TransformationList.tsx      [NEW - show variations]
│   └── layout/
│       └── MainPane.tsx                [UPDATE - add ConversationViewer]
└── lib/
    └── api-client.ts                   [UPDATE - add new endpoints]
```

---

## Priority Order

### Phase 1: Conversation Viewing (TODAY)
1. ✅ Add `GET /chatgpt/conversations` endpoint
2. ✅ Update ConversationList to fetch real titles
3. ✅ Create ConversationViewer component
4. ✅ Wire up conversation selection
5. ✅ Render messages with markdown

### Phase 2: Transformations (NEXT)
6. Add TransformationModal component
7. Add "Edit" buttons to messages
8. Create transformation API endpoints
9. Save transformations to database
10. Show transformation history

### Phase 3: AUI Integration (LATER)
11. Add conversation search/filter
12. AUI recommendations for relevant conversations
13. Semantic similarity search
14. Quantum reading on conversations

---

## Next Session Start Here

```bash
# 1. Add list conversations endpoint
# Edit: humanizer/api/chatgpt.py
# Add: @router.get("/conversations")

# 2. Update frontend API client
# Edit: frontend/src/lib/api-client.ts
# Add: async listConversations()

# 3. Update ConversationList
# Edit: frontend/src/components/conversations/ConversationList.tsx
# Replace search with listConversations()

# 4. Create ConversationViewer
# New file: frontend/src/components/conversations/ConversationViewer.tsx

# 5. Test
open http://localhost:3001
# Click conversation in sidebar
# Should show full conversation in main pane with real title
```

---

## User's Exact Requirements

✅ **Conversation titles** - Show actual titles (not "Conversation abc123...")
✅ **Click to view** - Load into main pane
✅ **Rich text rendering** - Markdown, LaTeX, images
✅ **Hide empty messages** - By default
✅ **Edit buttons** - Create transformations
✅ **Transformation selection** - Choose type before editing

All of this is achievable with the existing backend API + new list endpoint!
