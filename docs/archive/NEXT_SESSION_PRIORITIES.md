# Next Session Priorities

**Date:** October 11, 2025, 10:50 PM
**Status:** Ready for next session
**Context:** ~163k tokens used

---

## 🚨 HIGH PRIORITY - Must Fix First

### 1. LaTeX Delimiter Support - CRITICAL BUG
**Issue:** HTML export not rendering `\[...\]` and `\(...\)` LaTeX delimiters (only supports `$...$`)

**Location:** `humanizer/services/chatgpt_render.py` line 520-523

**Current (BROKEN):**
```python
MathJax = {
    tex: {inlineMath: [['$', '$'], ['\\\\(', '\\\\)']]},
    svg: {fontCache: 'global'}
};
```

**Fix Required:**
```python
MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],      // Inline: $...$ or \(...\)
        displayMath: [['$$', '$$'], ['\\[', '\\]']]    // Display: $$...$$ or \[...\]
    },
    svg: {fontCache: 'global'}
};
```

**Why:**
- LLMs use `\[...\]` and `\(...\)` to avoid markdown conflicts with `$`
- Most LaTeX in ChatGPT archives uses backslash-bracket notation
- Current config only recognizes `$` delimiters

**Test:**
1. Find conversation with LaTeX using `\[` notation
2. Export to HTML
3. Verify math renders properly

---

### 2. Add MathJax + Mermaid to GUI
**Issue:** GUI (`humanizer_gui.html`) doesn't have libraries for rendering LaTeX/charts

**Location:** `humanizer_gui.html` - add to `<head>` section

**Add:**
```html
<!-- MathJax for LaTeX -->
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
<script>
MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
    },
    svg: {fontCache: 'global'}
};
</script>

<!-- Mermaid for charts -->
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>
mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',  // Match GUI theme
    securityLevel: 'loose'
});
</script>

<!-- Marked.js for markdown rendering -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

**Update renderConversation() function:**
```javascript
// After setting innerHTML
if (window.MathJax) {
    MathJax.typesetPromise();
}
if (window.mermaid) {
    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
}
```

---

### 3. Pagination Controls in GUI
**Issue:** No Previous/Next buttons for paginated conversations

**Add to conversation viewer modal:**
```html
<div class="pagination-controls">
    <button id="prev-page" class="px-3 py-1 bg-gray-700 rounded">← Previous</button>
    <span>Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
    <button id="next-page" class="px-3 py-1 bg-gray-700 rounded">Next →</button>
</div>
```

**JavaScript:**
```javascript
let currentPage = 1;
let totalPages = 1;

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        renderConversation(currentConversationUuid, currentPage - 1);
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < totalPages) {
        renderConversation(currentConversationUuid, currentPage + 1);
    }
});
```

---

## 📋 MEDIUM PRIORITY

### 4. PDF Export Implementation
**Status:** Infrastructure ready, needs implementation

**Use:** `weasyprint` library
```bash
poetry add weasyprint
```

**Implementation:** `humanizer/services/chatgpt_render.py`
```python
async def export_conversation_pdf(
    session: AsyncSession,
    conversation_uuid: UUID,
    request: ChatGPTExportRequest
) -> bytes:
    """Export conversation as PDF."""
    from weasyprint import HTML, CSS

    # Get HTML first
    html_content = await export_conversation_html(
        session, conversation_uuid, request
    )

    # Convert to PDF
    pdf_bytes = HTML(string=html_content).write_pdf(
        stylesheets=[CSS(string=_get_pdf_css())]
    )

    return pdf_bytes
```

---

### 5. Improve CSS for Printed/Book Appearance
**Current:** Basic web styling
**Needed:** Print-optimized CSS

**Add to `_get_html_css()`:**
```css
/* Print styles */
@media print {
    body { background: white; padding: 0; }
    .container { max-width: none; box-shadow: none; }

    .page-break { page-break-after: always; }

    header { border-bottom: 2px solid #333; }

    /* Avoid breaking inside elements */
    h1, h2, h3 { page-break-after: avoid; }
    pre, blockquote { page-break-inside: avoid; }

    /* Hide web-only elements */
    button, .no-print { display: none; }
}

/* Better typography for reading */
.conversation-content {
    font-size: 12pt;
    line-height: 1.8;
    max-width: 65ch;  /* Optimal line length */
}

.conversation-content h1 { font-size: 24pt; margin-top: 24pt; }
.conversation-content h2 { font-size: 18pt; margin-top: 18pt; }
.conversation-content h3 { font-size: 14pt; margin-top: 14pt; }

.conversation-content p { margin-bottom: 12pt; text-align: justify; }

.conversation-content code {
    font-family: 'Monaco', 'Courier New', monospace;
    background: #f5f5f5;
    padding: 2pt 4pt;
    border-radius: 3pt;
}

.conversation-content pre {
    background: #f5f5f5;
    padding: 12pt;
    border-left: 3pt solid #333;
    overflow-x: auto;
}
```

---

## 🔬 LOW PRIORITY (Future)

### 6. Semantic Exploration
- Run quantum readings on conversation clusters
- Visualize POVM measurements across archive
- Find thematic connections

### 7. Production Deployment
- Deploy API + PostgreSQL to cloud
- Add authentication
- Rate limiting
- CDN for static assets

### 8. Advanced Search
- Filter by date range
- Filter by custom GPT
- Filter by media presence
- Regex search support

### 9. Mobile Responsive GUI
- Responsive breakpoints
- Touch-friendly controls
- Mobile navigation

---

## 📊 Current State Summary

### ✅ Completed This Session
1. Archive ingestion (chat5 + Chat8) - 1,685 conversations, 47,698 messages
2. Combined image gallery - 80 images with metadata
3. Working web GUI - http://localhost:8000/gui
4. Smart content parser - JSON/HTML/LaTeX/Mermaid support
5. Fixed HTML export - Proper markdown-to-HTML conversion
6. Added Mermaid.js support
7. Created comprehensive documentation

### 🐛 Known Issues
1. **LaTeX delimiters incomplete** - Missing `\[...\]` and `\(...\)` support
2. **GUI missing libraries** - No MathJax/Mermaid loaded
3. **No pagination controls** - Can't navigate multi-page conversations
4. **PDF export not implemented** - Endpoint exists but returns NotImplemented

### 📂 Files Modified This Session
- `humanizer/services/chatgpt.py` - Fixed merge logic
- `humanizer/services/chatgpt_render.py` - Added ContentParser, fixed HTML export
- `humanizer/services/content_parser.py` - NEW (370 lines)
- `humanizer/config.py` - Added CORS support
- `humanizer/main.py` - Added /gui endpoint
- `humanizer_gui.html` - NEW (700+ lines)
- Multiple documentation files

### 📦 Dependencies Added
- `markdown` (v3.9) - For proper HTML export

---

## 🚀 Quick Start Commands (Next Session)

```bash
# Start API
poetry run uvicorn humanizer.main:app --reload --port 8000

# Open GUI
open http://localhost:8000/gui

# Check stats
curl http://localhost:8000/chatgpt/stats | python3 -m json.tool

# Generate gallery
poetry run python create_combined_image_gallery.py
```

---

## 🎯 Suggested Session Order

1. **Fix LaTeX delimiters** (5 min) - Critical for proper math rendering
2. **Add libraries to GUI** (10 min) - Enable full content rendering
3. **Test with real conversations** (10 min) - Verify JSON/LaTeX/Mermaid parsing works
4. **Add pagination controls** (20 min) - Enable navigation
5. **Implement PDF export** (30 min) - Complete export functionality
6. **Improve CSS** (20 min) - Make exports look professional

**Total:** ~1.5 hours to complete high/medium priority items

---

## 📝 Notes for Next Context

- **API running on port 8000** - May need restart
- **Database:** PostgreSQL with 1,685 conversations indexed
- **GUI works** but needs libraries for full rendering
- **Content parser working** - Auto-detects 6 content types
- **HTML export fixed** but LaTeX config incomplete
- User actively testing search/export features

---

## 🔍 Test Cases to Verify

After fixing LaTeX:
```bash
# Find conversation with LaTeX
curl -X POST http://localhost:8000/chatgpt/search \
  -H "Content-Type: application/json" \
  -d '{"query": "\\[", "limit": 5}'

# Export and check rendering
curl -X POST http://localhost:8000/chatgpt/conversation/{uuid}/export \
  -H "Content-Type: application/json" \
  -d '{"format": "rendered_html", "include_media": true}' > test.html

# Open and verify LaTeX renders
open test.html
```

---

**Session End:** 10:50 PM, October 11, 2025
**Ready for:** LaTeX fix → GUI enhancement → PDF implementation
