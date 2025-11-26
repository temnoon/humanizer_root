# Step 2: Quick Markdown Fix for Current Frontend

## Problem

Posts with markdown and LaTeX (like your Noether's Theorem post) are displaying as plain text with no formatting:
- No line breaks
- No LaTeX rendering  
- No markdown formatting

## Quick Fix

Add markdown + LaTeX rendering to the current monolithic frontend. This is temporary until the new properly-architected frontend is ready.

### Changes Needed

The current post detail page has:
```javascript
<div class="post-content">\${escapeHtml(post.content)}</div>
```

We need to:
1. Add marked.js and KaTeX CDN scripts
2. Create a `renderContent()` function
3. Use it instead of `escapeHtml()`

### Implementation

Add these script tags in the `<head>` section of `postDetailPage()`:

```html
<!-- Markdown rendering -->
<script src="https://cdn.jsdelivr.net/npm/marked@11.0.0/marked.min.js"></script>

<!-- LaTeX rendering -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
```

Add rendering function in the `<script>` section:

```javascript
function renderContent(content) {
  // First render markdown
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
  let html = marked.parse(content);
  
  // Then render LaTeX
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  renderMathInElement(temp, {
    delimiters: [
      {left: '$$', right: '$$', display: true},
      {left: '\\\\[', right: '\\\\]', display: true},
      {left: '$', right: '$', display: false},
      {left: '\\\\(', right: '\\\\)', display: false}
    ],
    throwOnError: false
  });
  
  return temp.innerHTML;
}
```

Update `displayPost()` to use `renderContent()`:

```javascript
function displayPost(post) {
  const tags = Array.isArray(post.tags) ? post.tags : (post.tags ? JSON.parse(post.tags) : []);
  
  // Render markdown and LaTeX
  const renderedContent = renderContent(post.content);
  
  document.getElementById('postDetail').innerHTML = \`
    <div class="post-detail">
      \${post.summary ? \`<div class="post-summary">"\${escapeHtml(post.summary)}\"</div>\` : ''}
      
      <div class="post-content">\${renderedContent}</div>
      
      // ... rest of the display code
    </div>
  \`;
}
```

Add markdown-specific CSS styles:

```css
/* Markdown content styling */
.post-content h1, .post-content h2, .post-content h3 {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.post-content h1 { font-size: 1.5rem; }
.post-content h2 { font-size: 1.3rem; }
.post-content h3 { font-size: 1.1rem; }

.post-content p {
  margin-bottom: 1rem;
}

.post-content ul, .post-content ol {
  margin-left: 1.5rem;
  margin-bottom: 1rem;
}

.post-content code {
  background: var(--bg-secondary);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.post-content pre {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.post-content blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1rem;
  margin-left: 0;
  color: var(--text-secondary);
  font-style: italic;
}

/* LaTeX styling */
.post-content .katex {
  font-size: 1.1em;
}

.post-content .katex-display {
  margin: 1.5rem 0;
  overflow-x: auto;
}
```

### Apply the Fix

Due to the filesystem tool limitations, I'll provide the complete edited file that you can save locally and deploy.

**Option A - Manual Edit:**
Edit `/Users/tem/humanizer_root/workers/post-social-frontend/src/index.ts` and make the above changes.

**Option B - I'll Create Complete File:**
I can create a complete corrected version of the file as `index-with-markdown.ts` that you can rename and deploy.

### Deploy

```bash
cd ~/humanizer_root/workers/post-social-frontend
npx wrangler deploy
```

### Test

1. Create a post with markdown:
```markdown
# Heading
**Bold text** and *italic*

- List item 1
- List item 2
```

2. Create a post with LaTeX:
```markdown
Euler's identity: $e^{i\pi} + 1 = 0$

Inline math $x^2$ or display:

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

3. Your Noether's Theorem post should now render properly!

## Why This Is Temporary

- Still monolithic architecture
- Still inline HTML/CSS/JS strings
- Still no component system
- Still no configuration files
- Still mixing concerns

**But** it will let you test the backend synthesis features with properly formatted content while we build the proper frontend.

## Next After This

Once markdown is working:
- Continue backend development (Phase 6: Curator Chat)
- Or continue frontend rebuild (Phase 1 component library)

Your choice on which to prioritize!
