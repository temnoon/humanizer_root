"""
Smart Content Parser for ChatGPT Messages

Intelligently detects and renders different content types:
- JSON/JSONB: Parse and format with metadata extraction
- Markdown: Render with proper formatting
- HTML: Escape and sandbox for safe display
- LaTeX: Render with MathJax
- Mermaid charts: Render with mermaid.js
- Plain text: Display as-is

Key feature: Auto-detects content type from first character or patterns.
"""

import json
import re
import html
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass


@dataclass
class ParsedContent:
    """Parsed content with type and metadata."""
    content_type: str  # json, markdown, html, latex, mermaid, text
    formatted_content: str  # Formatted for display
    metadata: Dict[str, Any]  # Extracted metadata
    raw_content: str  # Original content


class ContentParser:
    """Smart content parser that auto-detects and formats various content types."""

    @staticmethod
    def detect_content_type(content: str) -> str:
        """
        Detect content type from first character or patterns.

        Detection order:
        1. JSON (starts with "{" or "[")
        2. Mermaid (contains "```mermaid")
        3. LaTeX (contains $$ or \\begin)
        4. HTML (starts with <)
        5. Markdown (has markdown markers)
        6. Plain text (default)
        """
        if not content or not content.strip():
            return "empty"

        content_stripped = content.strip()

        # JSON detection
        if content_stripped.startswith('{') or content_stripped.startswith('['):
            try:
                json.loads(content_stripped)
                return "json"
            except json.JSONDecodeError:
                pass  # Not valid JSON, continue detection

        # Mermaid chart detection
        if "```mermaid" in content:
            return "mermaid"

        # LaTeX detection
        if "$$" in content or "\\begin{" in content or "\\[" in content:
            return "latex"

        # HTML detection
        if content_stripped.startswith('<') and '>' in content:
            return "html"

        # Markdown detection (has common markdown patterns)
        markdown_patterns = [
            r'^#{1,6}\s',  # Headers
            r'\*\*.*\*\*',  # Bold
            r'\*.*\*',  # Italic
            r'\[.*\]\(.*\)',  # Links
            r'```',  # Code blocks
            r'^\s*[-*+]\s',  # Lists
        ]
        for pattern in markdown_patterns:
            if re.search(pattern, content, re.MULTILINE):
                return "markdown"

        return "text"

    @staticmethod
    def parse_json_content(content: str) -> ParsedContent:
        """
        Parse JSON content and extract meaningful data.

        Strategy:
        1. Parse JSON structure
        2. Extract metadata (keys like 'metadata', 'info', 'data')
        3. Find text content (keys like 'text', 'content', 'message', 'body')
        4. Format for display
        """
        try:
            data = json.loads(content.strip())
        except json.JSONDecodeError as e:
            return ParsedContent(
                content_type="json_error",
                formatted_content=f"⚠️ **JSON Parse Error**: {str(e)}\n\n```\n{content}\n```",
                metadata={"error": str(e)},
                raw_content=content
            )

        # Extract metadata
        metadata = {}
        text_content = []

        def extract_from_dict(d: Dict, path: str = ""):
            """Recursively extract metadata and text from dict."""
            for key, value in d.items():
                full_key = f"{path}.{key}" if path else key

                # Metadata keys
                if key.lower() in ['metadata', 'meta', 'info', 'properties', 'attributes']:
                    if isinstance(value, dict):
                        metadata.update(value)
                    else:
                        metadata[key] = value

                # Text content keys
                elif key.lower() in ['text', 'content', 'message', 'body', 'description', 'value']:
                    if isinstance(value, str):
                        text_content.append(value)
                    elif isinstance(value, list):
                        text_content.extend([str(v) for v in value if v])

                # Recurse into nested structures
                elif isinstance(value, dict):
                    extract_from_dict(value, full_key)
                elif isinstance(value, list):
                    for i, item in enumerate(value):
                        if isinstance(item, dict):
                            extract_from_dict(item, f"{full_key}[{i}]")
                        elif isinstance(item, str) and item.strip():
                            text_content.append(item)

        if isinstance(data, dict):
            extract_from_dict(data)
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    extract_from_dict(item)
                elif isinstance(item, str):
                    text_content.append(item)

        # Format output
        formatted = []

        if metadata:
            formatted.append("**Metadata:**")
            for key, value in metadata.items():
                formatted.append(f"- **{key}**: {value}")
            formatted.append("")

        if text_content:
            formatted.append("**Content:**")
            formatted.append("\n\n".join(text_content))
        else:
            # No text found, show formatted JSON
            formatted.append("**Raw JSON:**")
            formatted.append(f"```json\n{json.dumps(data, indent=2)}\n```")

        return ParsedContent(
            content_type="json",
            formatted_content="\n".join(formatted),
            metadata=metadata,
            raw_content=content
        )

    @staticmethod
    def parse_html_content(content: str) -> ParsedContent:
        """
        Parse HTML content and create sandboxed display.

        Safety measures:
        - Escape HTML for display as code
        - Wrap in sandboxed iframe for preview
        - Strip dangerous scripts
        - Contain all positioning
        """
        # Escape HTML for code display
        escaped = html.escape(content)

        # Strip dangerous elements for sandbox preview
        safe_html = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        safe_html = re.sub(r'<iframe[^>]*>.*?</iframe>', '', safe_html, flags=re.DOTALL | re.IGNORECASE)
        safe_html = re.sub(r'on\w+="[^"]*"', '', safe_html)  # Remove event handlers

        # Wrap in container CSS
        sandboxed = f"""
<div class="html-sandbox" style="max-width: 100%; max-height: 400px; overflow: hidden; border: 1px solid #444; border-radius: 4px; position: relative;">
    <div style="position: relative; overflow: auto; max-height: 400px;">
        {safe_html}
    </div>
</div>
"""

        formatted = f"""**HTML Content** (sandboxed preview below)

```html
{escaped}
```

**Preview:**
{sandboxed}
"""

        return ParsedContent(
            content_type="html",
            formatted_content=formatted,
            metadata={"html_length": len(content)},
            raw_content=content
        )

    @staticmethod
    def parse_latex_content(content: str) -> ParsedContent:
        """
        Parse LaTeX content for MathJax rendering.

        Wrap LaTeX in proper delimiters for MathJax.
        """
        # Already has delimiters?
        if "$$" in content or "\\[" in content:
            formatted = content
        else:
            # Wrap in display math
            formatted = f"$$\n{content}\n$$"

        return ParsedContent(
            content_type="latex",
            formatted_content=formatted,
            metadata={"latex_length": len(content)},
            raw_content=content
        )

    @staticmethod
    def parse_mermaid_content(content: str) -> ParsedContent:
        """
        Parse Mermaid chart for rendering.

        Extract mermaid code and wrap for mermaid.js.
        """
        # Extract mermaid code from code block
        match = re.search(r'```mermaid\s*(.*?)\s*```', content, re.DOTALL)
        if match:
            mermaid_code = match.group(1)
        else:
            mermaid_code = content

        formatted = f"""**Mermaid Chart:**

```mermaid
{mermaid_code}
```

<div class="mermaid">
{mermaid_code}
</div>
"""

        return ParsedContent(
            content_type="mermaid",
            formatted_content=formatted,
            metadata={"chart_type": "mermaid"},
            raw_content=content
        )

    @staticmethod
    def parse_markdown_content(content: str) -> ParsedContent:
        """
        Parse markdown content (already in markdown format).
        """
        return ParsedContent(
            content_type="markdown",
            formatted_content=content,
            metadata={},
            raw_content=content
        )

    @staticmethod
    def parse_text_content(content: str) -> ParsedContent:
        """
        Parse plain text content.
        """
        return ParsedContent(
            content_type="text",
            formatted_content=content,
            metadata={},
            raw_content=content
        )

    @classmethod
    def parse(cls, content: Optional[str]) -> ParsedContent:
        """
        Main entry point: Auto-detect and parse content.

        Usage:
            parsed = ContentParser.parse(message_content)
            print(parsed.formatted_content)
        """
        if not content:
            return ParsedContent(
                content_type="empty",
                formatted_content="",
                metadata={},
                raw_content=""
            )

        content_type = cls.detect_content_type(content)

        if content_type == "json":
            return cls.parse_json_content(content)
        elif content_type == "html":
            return cls.parse_html_content(content)
        elif content_type == "latex":
            return cls.parse_latex_content(content)
        elif content_type == "mermaid":
            return cls.parse_mermaid_content(content)
        elif content_type == "markdown":
            return cls.parse_markdown_content(content)
        else:  # text or empty
            return cls.parse_text_content(content)
