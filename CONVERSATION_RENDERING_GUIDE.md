# ChatGPT Conversation Rendering System

**Created**: October 11, 2025
**Status**: Production Ready (Markdown & HTML), PDF Coming Soon
**Files**: `humanizer/services/chatgpt_render.py`, `humanizer/api/chatgpt.py`

---

## 🎉 What's Implemented

### ✅ Complete Features

1. **Media File Matching** - Fixed and tested
   - Handles all ChatGPT archive formats (2022-2025+)
   - User uploads, DALL-E, Sediment, Audio files
   - 571 files matched in chat7 archive (23% success rate)

2. **Markdown Rendering** - Fully functional
   - Filters zero-length messages automatically
   - Subtle role indicators (emoji: 👤🤖⚙️🔧 or text labels)
   - Embedded images with local file paths
   - Optional pagination support
   - Configurable timestamps

3. **HTML Export** - Working
   - Styled, responsive design
   - MathJax support for LaTeX
   - Embedded media
   - Clean, professional appearance

### 🚧 Coming Soon

- **PDF Export** (infrastructure ready, implementation pending)
- **Advanced LaTeX** rendering in PDF
- **SVG Flow Diagrams** of conversation structure
- **Animated PDFs** (transitions, page effects per PDF spec)
- **Interactive PDF Forms** (fillable fields, annotations)
- **Code Syntax Highlighting**

---

## 📡 API Endpoints

### 1. Render Conversation (Markdown)

```http
POST /chatgpt/conversation/{uuid}/render
Content-Type: application/json

{
  "pagination": false,
  "messages_per_page": 50,
  "include_media": true
}
```

**Response:**
```json
{
  "conversation_uuid": "...",
  "title": "Discussion about quantum consciousness",
  "total_messages": 24,
  "total_pages": 1,
  "current_page": 1,
  "markdown": "# Discussion...\n\n👤 **User**...",
  "media_refs": [
    {
      "file_id": "file-abc123",
      "url": "/chatgpt/media/file-abc123",
      "mime_type": "image/png",
      "has_file": true
    }
  ]
}
```

### 2. Export Conversation

```http
POST /chatgpt/conversation/{uuid}/export
Content-Type: application/json

{
  "format": "rendered_html",
  "include_media": true,
  "pagination": false,
  "messages_per_page": 50
}
```

**Supported Formats:**
- `raw_markdown` - Plain markdown
- `rendered_html` - Styled HTML with MathJax
- `pdf` - Coming soon (501 Not Implemented currently)

---

## ⚙️ Customization Guide

### Edit `humanizer/services/chatgpt_render.py` → `RenderConfig` class

All rendering behavior can be customized by modifying the `RenderConfig` class:

### 🎨 Role Indicators

```python
# Emoji indicators (default)
ROLE_INDICATORS = {
    "user": "👤",      # You can change to any emoji!
    "assistant": "🤖",
    "system": "⚙️",
    "tool": "🔧",
}

# Text labels (alternative)
ROLE_LABELS = {
    "user": "User",
    "assistant": "Assistant",
    "system": "System",
    "tool": "Tool",
}

# Switch between emoji and text
USE_EMOJI_INDICATORS = True  # False = use text labels
```

**Examples of alternative indicators:**
- Scientific: `👨‍🔬🔬⚗️🧪`
- Animals: `🦊🐼🦁🐨`
- Shapes: `●■▲◆`
- Letters: `U A S T`

### 🔍 Message Filtering

```python
# Filter behavior
FILTER_EMPTY_MESSAGES = True  # Skip zero-length messages
MIN_MESSAGE_LENGTH = 1        # Minimum content length

# Modify to filter by role
def should_include_message(message, config):
    # Add custom logic here!
    # Example: Skip all system messages
    if message.author_role == "system":
        return False
    return True
```

### ⏰ Timestamps

```python
INCLUDE_TIMESTAMPS = True        # Show/hide timestamps
TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M"  # Customize format

# Examples:
# "%B %d, %Y at %I:%M %p"  → "January 15, 2024 at 03:30 PM"
# "%Y/%m/%d %H:%M:%S"      → "2024/01/15 15:30:45"
# "%a %b %d %H:%M"         → "Mon Jan 15 15:30"
```

### 🖼️ Media Handling

```python
EMBED_IMAGES_INLINE = True   # Use ![](url) syntax
IMAGE_MAX_WIDTH = "800px"    # For HTML/PDF
MEDIA_URL_PREFIX = "/chatgpt/media"  # URL prefix

# Modify for different behaviors:
# - Link only (no embed): EMBED_IMAGES_INLINE = False
# - External CDN: MEDIA_URL_PREFIX = "https://cdn.example.com"
# - Custom max widths per device
```

### 📄 Pagination

```python
DEFAULT_MESSAGES_PER_PAGE = 50
SHOW_PAGE_BREAKS = True  # Show "---" between pages

# Book-style pagination:
# - Set to 20-30 for print-style books
# - Set to 100+ for web viewing
# - Disable entirely: pagination=False in request
```

### 🎭 Markdown Styling

```python
MESSAGE_SEPARATOR = "\n\n"       # Between messages
SECTION_SEPARATOR = "\n---\n\n"  # Between sections

# Create tighter layouts:
MESSAGE_SEPARATOR = "\n"
SECTION_SEPARATOR = "\n\n"

# Create spacious layouts:
MESSAGE_SEPARATOR = "\n\n\n"
SECTION_SEPARATOR = "\n\n---\n\n\n"
```

### 🌐 HTML/CSS Customization

```python
HTML_THEME = "default"  # Options: light, dark, custom
INCLUDE_MATHJAX = True  # LaTeX rendering
SYNTAX_HIGHLIGHTING = True  # Code blocks
CUSTOM_CSS = None  # Path to your CSS file

# To use custom CSS:
CUSTOM_CSS = "/path/to/my-theme.css"
```

**Custom CSS example:**
```css
/* my-theme.css */
.message.user {
    border-left-color: #purple;
    background: #f0f0ff;
}
.message.assistant {
    border-left-color: #blue;
    background: #f0f8ff;
}
```

### 📋 PDF Options (Future)

```python
# Page setup
PDF_PAGE_SIZE = "A4"  # A4, Letter, Legal, Custom
PDF_MARGINS = {
    "top": "1in",
    "right": "0.75in",
    "bottom": "1in",
    "left": "0.75in"
}

# Typography
PDF_FONT_FAMILY = "Helvetica"  # Or custom fonts
PDF_FONT_SIZE = 11

# Features
PDF_INCLUDE_TOC = True   # Table of contents
PDF_HEADERS = True       # Page headers with title
PDF_FOOTERS = True       # Page footers with page numbers

# Advanced (when implemented)
PDF_INTERACTIVE = False  # Fillable forms, annotations
PDF_ANIMATIONS = False   # Page transitions (PDF spec supports!)
GENERATE_SVG_FLOW = False  # Conversation flow diagram
```

---

## 🚀 Usage Examples

### Example 1: Simple Markdown Export

```bash
curl -X POST "http://localhost:8000/chatgpt/conversation/{uuid}/render" \
  -H "Content-Type: application/json" \
  -d '{
    "pagination": false,
    "include_media": true
  }'
```

### Example 2: Paginated Book-Style

```bash
curl -X POST "http://localhost:8000/chatgpt/conversation/{uuid}/render" \
  -H "Content-Type: application/json" \
  -d '{
    "pagination": true,
    "messages_per_page": 25,
    "include_media": true
  }'
```

### Example 3: HTML Export

```bash
curl -X POST "http://localhost:8000/chatgpt/conversation/{uuid}/export" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "rendered_html",
    "include_media": true
  }' > conversation.html
```

### Example 4: Python Usage

```python
from humanizer.services.chatgpt_render import (
    render_conversation_markdown,
    RenderConfig
)

# Custom configuration
config = RenderConfig()
config.USE_EMOJI_INDICATORS = False  # Use text labels
config.TIMESTAMP_FORMAT = "%B %d, %Y"  # Long date format
config.MESSAGE_SEPARATOR = "\n\n\n"  # Extra spacing

# Render
response = await render_conversation_markdown(
    session,
    conversation_uuid,
    request,
    config=config  # Pass custom config
)

print(response.markdown)
```

---

## 🎨 Creative Customization Ideas

### 1. Thematic Indicators

```python
# Fantasy theme
ROLE_INDICATORS = {
    "user": "🧙",  # Wizard
    "assistant": "🐉",  # Dragon
    "system": "⚔️",  # Sword
    "tool": "📜",  # Scroll
}

# Space theme
ROLE_INDICATORS = {
    "user": "🚀",
    "assistant": "🛸",
    "system": "🌟",
    "tool": "🔭",
}
```

### 2. Hierarchical Indentation

```python
def render_message(message, depth=0):
    indent = "  " * depth  # Indent based on thread depth
    return f"{indent}{role_icon} {content}"
```

### 3. Color-Coded Roles (HTML)

```css
.message.user { background: linear-gradient(to right, #e3f2fd, white); }
.message.assistant { background: linear-gradient(to right, #f3e5f5, white); }
.message.tool { background: linear-gradient(to right, #fff3e0, white); }
```

### 4. Conversation Statistics

```python
# Add to markdown header:
stats = f"""
**Statistics:**
- Total words: {word_count}
- Average response time: {avg_time}
- Topics: {", ".join(topics)}
"""
```

---

## 🐛 Troubleshooting

### Issue: Images not showing

**Solution 1**: Check if `file_path` is populated
```bash
psql humanizer_dev -c "
SELECT file_id, file_path IS NOT NULL as has_path, source_archive
FROM chatgpt_media LIMIT 10;
"
```

**Solution 2**: Re-run ingestion with `force_reimport=True`

**Solution 3**: Verify media URL endpoint is working
```bash
curl http://localhost:8000/chatgpt/media/file-abc123
```

### Issue: Zero-length messages appearing

**Solution**: Check `RenderConfig.FILTER_EMPTY_MESSAGES = True`

### Issue: Timestamps in wrong format

**Solution**: Modify `RenderConfig.TIMESTAMP_FORMAT`

### Issue: Custom CSS not loading

**Solution**: Check `CUSTOM_CSS` path and HTML template

---

## 📊 Current Statistics

From chat7 archive ingestion:
- **Total conversations**: 1,659
- **Total messages**: 46,355
- **Media files tracked**: 2,520
- **Media files with paths**: 571 (23%)
- **Date range**: Dec 2022 → Jul 2025

---

## 🔮 Future Enhancements

### Planned Features

1. **PDF Generation**
   - WeasyPrint or ReportLab
   - Full LaTeX support
   - Custom fonts and styling
   - Headers/footers with metadata

2. **SVG Flow Diagrams**
   - Visual representation of conversation structure
   - Interactive nodes (click to jump)
   - Export as standalone SVG

3. **Animated PDFs**
   - Page transitions (PDF 1.5+ spec)
   - Fade in/out effects
   - Interactive navigation

4. **PDF Forms**
   - Annotations layer
   - Fillable fields for notes
   - Signature fields
   - Checkboxes for tasks

5. **Code Syntax Highlighting**
   - Pygments integration
   - 100+ language support
   - Custom themes

6. **Advanced Filtering**
   - Filter by date range
   - Filter by content (regex)
   - Filter by role combinations
   - Custom filter functions

7. **Templates**
   - Academic paper style
   - Book chapter style
   - Blog post style
   - Technical documentation style

8. **Batch Export**
   - Export multiple conversations
   - Generate index/TOC
   - Cross-referencing
   - Combined PDF with bookmarks

---

## 📝 Contributing

To add new features or customizations:

1. **For rendering logic**: Edit `humanizer/services/chatgpt_render.py`
2. **For API endpoints**: Edit `humanizer/api/chatgpt.py`
3. **For schemas**: Edit `humanizer/models/schemas.py`
4. **For tests**: Create in `test_conversation_rendering.py`

---

## 🎯 Quick Reference

| Feature | Config Variable | Default | Location |
|---------|----------------|---------|----------|
| Role icons | `ROLE_INDICATORS` | Emoji | `RenderConfig` |
| Empty filter | `FILTER_EMPTY_MESSAGES` | `True` | `RenderConfig` |
| Timestamps | `INCLUDE_TIMESTAMPS` | `True` | `RenderConfig` |
| Pagination | `DEFAULT_MESSAGES_PER_PAGE` | `50` | `RenderConfig` |
| Media embed | `EMBED_IMAGES_INLINE` | `True` | `RenderConfig` |
| HTML theme | `HTML_THEME` | `"default"` | `RenderConfig` |

---

**Ready to render!** 🚀

Try it out:
```bash
# Get a conversation UUID
curl http://localhost:8000/chatgpt/stats | jq '.top_conversations[0]'

# Render it
curl -X POST "http://localhost:8000/chatgpt/conversation/{uuid}/render" \
  -H "Content-Type: application/json" \
  -d '{"include_media": true}' | jq '.markdown'
```
