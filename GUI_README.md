# Humanizer GUI - Quick Start

**Single-Page HTML Interface for ChatGPT Archive Management**

---

## 🚀 How to Use

### Step 1: Start the API Server

```bash
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000
```

Wait for:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### Step 2: Open the GUI

Simply open `humanizer_gui.html` in your browser:

```bash
# Option 1: Double-click the file
open humanizer_gui.html

# Option 2: Open in specific browser
open -a "Google Chrome" humanizer_gui.html
```

That's it! No build system, no npm, no dependencies.

---

## ✨ Features

### 📊 Dashboard Tab
- **Live Statistics**: Total conversations, messages, media files
- **Archive Information**: Which archives are loaded, date ranges
- **Top Conversations**: Visual bar chart of longest conversations
- **Connection Status**: Real-time API connection indicator

### 🔍 Search Tab
- **Full-Text Search**: Search all messages across all conversations
- **Filters**: Author role (user/assistant/system), result limit
- **Click to View**: Click any result to open conversation details
- **Render**: View full conversation with markdown formatting
- **Export**: Download conversation as HTML file

### 📁 Import Tab
- **Archive Import**: Import new ChatGPT archive folders
- **Progress Tracking**: Real-time progress bar during import
- **Force Reimport**: Option to update existing conversations
- **Statistics**: View import results (conversations, messages, media)

### 🎨 Gallery Tab
- **Custom GPT Selection**: Choose which custom GPTs to include
- **Format Options**: Markdown or HTML output
- **Preview**: See what the gallery will look like
- **Note**: Currently uses demo mode - requires backend endpoint

---

## 🎯 Quick Tasks

### Task 1: View Statistics
1. Open GUI → Dashboard tab (default)
2. Stats load automatically
3. Click "🔄 Refresh" to update

### Task 2: Search Conversations
1. Click "🔍 Search" tab
2. Enter query: `"quantum consciousness"`
3. (Optional) Set filters: Author role, Limit
4. Click "🔍 Search"
5. Click any result to view full conversation

### Task 3: Render a Conversation
1. Search for a conversation
2. Click on a result
3. In the modal, click "📄 Render"
4. View rendered markdown with formatting

### Task 4: Export Conversation as HTML
1. Open a conversation (via search)
2. Click "💾 Export HTML"
3. HTML file downloads automatically
4. Open in browser to view offline

### Task 5: Import New Archive
1. Click "📁 Import" tab
2. Archive Path: `/Users/tem/Chat9`
3. Archive Name: `Chat9`
4. (Optional) Check "Force reimport"
5. Click "📁 Import Archive"
6. Watch progress bar
7. View results when complete

### Task 6: Generate Gallery (Demo)
1. Click "🎨 Gallery" tab
2. Select custom GPTs to include
3. Choose output format
4. Click "🎨 Generate Gallery"
5. Preview appears below

---

## 🔧 Technical Details

### Architecture
```
humanizer_gui.html (Frontend)
    ↓ HTTP Requests
localhost:8000 (FastAPI Backend)
    ↓ SQLAlchemy
PostgreSQL Database
```

### API Endpoints Used

| Feature | Endpoint | Method |
|---------|----------|--------|
| Statistics | `/chatgpt/stats` | GET |
| Search | `/chatgpt/search` | POST |
| Get Conversation | `/chatgpt/conversation/{uuid}` | GET |
| Render | `/chatgpt/conversation/{uuid}/render` | POST |
| Export | `/chatgpt/conversation/{uuid}/export` | POST |
| Import | `/chatgpt/ingest` | POST |

### Technologies
- **HTML5** - Structure
- **Tailwind CSS** (CDN) - Styling
- **Vanilla JavaScript** - Interactivity
- **Fetch API** - HTTP requests

**Zero dependencies** - Just open in browser!

---

## 🎨 Customization

### Change Colors
Edit the Tailwind classes in `humanizer_gui.html`:

```html
<!-- Purple theme (default) -->
<button class="bg-purple-600 hover:bg-purple-700">

<!-- Change to blue theme -->
<button class="bg-blue-600 hover:bg-blue-700">

<!-- Change to green theme -->
<button class="bg-green-600 hover:bg-green-700">
```

### Change API URL
If API is not on `localhost:8000`, edit line 270:

```javascript
const API_BASE = 'http://localhost:8000';
// Change to:
const API_BASE = 'http://your-server.com:8000';
```

### Add Dark/Light Mode Toggle
Currently dark mode only. To add light mode:

1. Add toggle button to header
2. Create CSS class for light theme
3. Toggle `bg-gray-900` ↔ `bg-white` on body

---

## ⚠️ Known Limitations

### 1. Gallery Generation
**Status**: Demo mode only

**Why**: Requires new API endpoint `/galleries/generate`

**Workaround**: Use Python script:
```bash
poetry run python create_combined_image_gallery.py
```

### 2. Real-Time Progress
**Import progress bar**: Simulated (doesn't reflect actual progress)

**Why**: API endpoint doesn't support streaming responses

**Future**: Add WebSocket support for real-time updates

### 3. Large Conversations
**Rendering very long conversations** (1000+ messages) may be slow

**Workaround**: Use pagination:
```javascript
// In renderConversation(), add:
pagination: true,
messages_per_page: 50
```

### 4. CORS Issues
If you see CORS errors, add to `humanizer/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🚀 Next Steps: Full React App

This prototype proves the concept. For production, consider:

### Full Stack
```
Frontend: React + TypeScript + Vite
Components: Shadcn/ui or Material-UI
State: Zustand or Redux
Backend: FastAPI (already built!)
Database: PostgreSQL (already set up!)
```

### Features to Add
- [ ] User authentication (login/logout)
- [ ] Quantum reading interface (TRM visualization)
- [ ] POVM measurements (interactive tetralemma)
- [ ] Real-time updates (WebSocket)
- [ ] Drag-and-drop archive import
- [ ] Image gallery with lightbox
- [ ] Custom query builder (visual SQL)
- [ ] Export to PDF with custom templates
- [ ] Conversation sharing (generate links)
- [ ] Mobile-responsive design
- [ ] Keyboard shortcuts
- [ ] Search history
- [ ] Bookmarks/favorites

### Timeline
- **Prototype** (current): 1 day ✅
- **Core React App**: 2-3 weeks
- **Advanced Features**: 2-3 weeks
- **Polish & Deploy**: 1-2 weeks

**Total**: 6-8 weeks for production-ready GUI

---

## 📝 Feedback

As you use the GUI, note:
- What operations are most common?
- What's confusing or slow?
- What shortcuts would help?
- What visualizations would clarify the data?

This informs the full React app design.

---

## 🐛 Troubleshooting

### "Cannot connect to API"
**Fix**: Make sure API server is running:
```bash
poetry run uvicorn humanizer.main:app --reload --port 8000
```

### "Search failed"
**Check**: Are there conversations in the database?
```bash
poetry run python get_stats.py
```

### "Import stuck at 0%"
**Issue**: Import endpoint takes time for large archives

**Fix**: Check terminal running the API server for progress logs

### "Images not showing in rendered conversations"
**Issue**: Image paths are absolute file paths

**Future**: Serve images via API endpoint `/chatgpt/media/{file_id}`

---

## 📚 Resources

- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Architecture**: `AUI_DATA_RETRIEVAL_GUIDE.md`
- **Project Guide**: `CLAUDE.md`
- **Gallery Script**: `create_combined_image_gallery.py`

---

**Built in one session. Zero dependencies. Just works.** 🚀
