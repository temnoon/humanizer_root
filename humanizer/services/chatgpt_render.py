"""
ChatGPT Conversation Rendering Service

Renders ChatGPT conversations to various formats:
- Markdown (with embedded images)
- HTML (styled, with LaTeX support via MathJax)
- PDF (future: via weasyprint or reportlab)

Key Features:
- Filters zero-length messages
- Subtle role indicators (emoji, styling, formatting)
- Pagination support
- Media embedding (images with local/remote paths)
- Configurable defaults for customization

Future Enhancements:
- SVG graphics generation (conversation flow diagrams)
- Animated PDF features (transitions, interactive elements)
- PDF forms (annotations, fillable fields)
- Custom headers/footers with metadata
- LaTeX rendering in PDF
- Code syntax highlighting
- Custom themes/styling
"""

from datetime import datetime
from typing import List, Dict, Optional, Tuple
from uuid import UUID
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.chatgpt import (
    ChatGPTConversation,
    ChatGPTMessage,
    ChatGPTMedia,
)
from humanizer.models.schemas import (
    ChatGPTRenderRequest,
    ChatGPTRenderResponse,
    ChatGPTExportRequest,
    ChatGPTExportResponse,
)


# ========================================
# Configuration & Defaults
# ========================================

class RenderConfig:
    """
    Rendering configuration with customizable defaults.

    Modify these to change default behavior:
    - Role indicators (emoji, text, styling)
    - Formatting options (timestamps, metadata)
    - Media handling (embed vs link)
    - Pagination settings
    """

    # Role Indicators (subtle but clear)
    ROLE_INDICATORS = {
        "user": "👤",      # User messages
        "assistant": "🤖",  # Assistant responses
        "system": "⚙️",     # System messages
        "tool": "🔧",       # Tool outputs (code, DALL-E, etc.)
    }

    # Alternative text-based indicators (if emoji not desired)
    ROLE_LABELS = {
        "user": "User",
        "assistant": "Assistant",
        "system": "System",
        "tool": "Tool",
    }

    # Message filtering
    FILTER_EMPTY_MESSAGES = True  # Skip zero-length messages
    MIN_MESSAGE_LENGTH = 1  # Minimum content length

    # Timestamps
    INCLUDE_TIMESTAMPS = True  # Show message timestamps
    TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M"  # Customize format

    # Media handling
    EMBED_IMAGES_INLINE = True  # Use markdown image syntax
    IMAGE_MAX_WIDTH = "800px"  # For HTML/PDF export
    MEDIA_URL_PREFIX = "/chatgpt/media"  # URL prefix for media files

    # Pagination
    DEFAULT_MESSAGES_PER_PAGE = 50
    SHOW_PAGE_BREAKS = True  # Show "---" between pages

    # Markdown styling
    USE_EMOJI_INDICATORS = True  # Use emoji vs text labels
    MESSAGE_SEPARATOR = "\n\n"  # Space between messages
    SECTION_SEPARATOR = "\n---\n\n"  # Space between sections

    # HTML/PDF options (future)
    HTML_THEME = "default"  # light, dark, custom
    INCLUDE_MATHJAX = True  # For LaTeX rendering
    SYNTAX_HIGHLIGHTING = True  # For code blocks
    CUSTOM_CSS = None  # Path to custom CSS file

    # PDF options (future)
    PDF_PAGE_SIZE = "A4"  # A4, Letter, Legal
    PDF_MARGINS = {"top": "1in", "right": "0.75in", "bottom": "1in", "left": "0.75in"}
    PDF_FONT_FAMILY = "Helvetica"
    PDF_INCLUDE_TOC = True  # Table of contents
    PDF_HEADERS = True  # Show headers with title/page number
    PDF_FOOTERS = True  # Show footers with date

    # Advanced features (future)
    GENERATE_SVG_FLOW = False  # Generate conversation flow diagram
    PDF_INTERACTIVE = False  # Enable PDF forms/annotations
    PDF_ANIMATIONS = False  # Enable transitions (PDF spec supports this!)


# ========================================
# Helper Functions
# ========================================

def format_timestamp(dt: Optional[datetime], config: RenderConfig = RenderConfig()) -> str:
    """Format timestamp for display."""
    if not dt or not config.INCLUDE_TIMESTAMPS:
        return ""
    return dt.strftime(config.TIMESTAMP_FORMAT)


def get_role_indicator(role: str, config: RenderConfig = RenderConfig()) -> str:
    """Get role indicator (emoji or text label)."""
    if config.USE_EMOJI_INDICATORS:
        return config.ROLE_INDICATORS.get(role, "❓")
    return config.ROLE_LABELS.get(role, role.capitalize())


def should_include_message(message: ChatGPTMessage, config: RenderConfig = RenderConfig()) -> bool:
    """
    Determine if message should be included in render.

    Filters:
    - Zero-length messages
    - Messages with no content_text and no content_parts
    - System messages (optional)
    """
    if not config.FILTER_EMPTY_MESSAGES:
        return True

    # Check content_text length
    if message.content_text:
        if len(message.content_text.strip()) >= config.MIN_MESSAGE_LENGTH:
            return True

    # Check content_parts (JSON may have content even if text is empty)
    if message.content_parts:
        # Count non-empty parts
        non_empty_parts = [
            part for part in message.content_parts
            if isinstance(part, str) and len(part.strip()) >= config.MIN_MESSAGE_LENGTH
        ]
        if non_empty_parts:
            return True

    return False


def extract_media_from_message(message: ChatGPTMessage) -> List[str]:
    """
    Extract media file IDs referenced in message content.

    Looks for:
    - Markdown images: ![alt](file-xxx.png)
    - Protocol refs: sediment://file_xxx, file-service://file-xxx
    - content_parts with asset_pointer fields (structured DALL-E images)
    """
    import re

    media_ids = []

    # Check content_text
    if message.content_text:
        # Markdown images
        markdown_images = re.findall(r'!\[.*?\]\((file-[^)]+)\)', message.content_text)
        media_ids.extend(markdown_images)

        # Protocol references
        protocol_refs = re.findall(r'(?:sediment|file-service)://(file[_-][^\s\)"\'\]]+)', message.content_text)
        # Normalize: file_ -> file-
        normalized = [ref.replace('file_', 'file-') for ref in protocol_refs]
        media_ids.extend(normalized)

    # Check content_parts (structured JSONB field)
    if message.content_parts:
        try:
            import json
            if isinstance(message.content_parts, str):
                parts = json.loads(message.content_parts)
            else:
                parts = message.content_parts

            # content_parts is an array of content items
            if isinstance(parts, list):
                for part in parts:
                    if isinstance(part, dict):
                        # Look for asset_pointer field
                        asset_pointer = part.get('asset_pointer', '')
                        if asset_pointer:
                            # Extract file ID from protocol reference
                            protocol_refs = re.findall(r'(?:sediment|file-service)://(file[_-][^\s\)"\'\]]+)', asset_pointer)
                            normalized = [ref.replace('file_', 'file-') for ref in protocol_refs]
                            media_ids.extend(normalized)
        except (json.JSONDecodeError, TypeError, AttributeError):
            # If parsing fails, skip content_parts
            pass

    return list(set(media_ids))  # Deduplicate


# ========================================
# Markdown Rendering
# ========================================

async def render_conversation_markdown(
    session: AsyncSession,
    conversation_uuid: UUID,
    request: ChatGPTRenderRequest,
    config: RenderConfig = RenderConfig()
) -> ChatGPTRenderResponse:
    """
    Render conversation as markdown.

    Format:
    ```markdown
    # Conversation Title
    *Created: 2024-05-15 | Messages: 24*

    ---

    👤 **User** [2024-05-15 10:30]
    Can you explain quantum consciousness?

    🤖 **Assistant** [2024-05-15 10:31]
    Quantum consciousness refers to...

    ![Image](file-abc123-screenshot.png)
    ```

    Args:
        session: Database session
        conversation_uuid: Conversation UUID
        request: Render request (pagination, media settings)
        config: Rendering configuration

    Returns:
        ChatGPTRenderResponse with markdown content and media refs
    """
    # Get conversation
    conv_stmt = select(ChatGPTConversation).where(
        ChatGPTConversation.uuid == conversation_uuid
    )
    conv_result = await session.execute(conv_stmt)
    conv = conv_result.scalar_one_or_none()

    if not conv:
        raise ValueError(f"Conversation {conversation_uuid} not found")

    # Get messages (ordered by created_at)
    msg_stmt = select(ChatGPTMessage).where(
        ChatGPTMessage.conversation_uuid == conversation_uuid
    ).order_by(ChatGPTMessage.created_at)

    msg_result = await session.execute(msg_stmt)
    all_messages = msg_result.scalars().all()

    # Filter messages
    messages = [msg for msg in all_messages if should_include_message(msg, config)]

    # Pagination
    total_messages = len(messages)
    messages_per_page = request.messages_per_page or config.DEFAULT_MESSAGES_PER_PAGE

    if request.pagination:
        total_pages = (total_messages + messages_per_page - 1) // messages_per_page
        current_page = 1  # TODO: Add page parameter to request
        start_idx = (current_page - 1) * messages_per_page
        end_idx = start_idx + messages_per_page
        messages = messages[start_idx:end_idx]
    else:
        total_pages = 1
        current_page = 1

    # Build markdown
    markdown_lines = []

    # Header
    markdown_lines.append(f"# {conv.title or 'Untitled Conversation'}")
    markdown_lines.append("")

    # Metadata
    metadata_parts = []
    if conv.created_at:
        metadata_parts.append(f"Created: {format_timestamp(conv.created_at, config)}")
    metadata_parts.append(f"Messages: {total_messages}")
    if conv.source_archive:
        metadata_parts.append(f"Archive: {conv.source_archive}")

    markdown_lines.append(f"*{' | '.join(metadata_parts)}*")
    markdown_lines.append("")
    markdown_lines.append("---")
    markdown_lines.append("")

    # Track media references
    media_refs = []
    media_ids_seen = set()

    # Render messages
    for i, message in enumerate(messages):
        # Role indicator
        role_icon = get_role_indicator(message.author_role, config)
        role_label = config.ROLE_LABELS.get(message.author_role, message.author_role.capitalize())

        # Timestamp
        timestamp_str = ""
        if config.INCLUDE_TIMESTAMPS and message.created_at:
            timestamp_str = f" [{format_timestamp(message.created_at, config)}]"

        # Message header
        markdown_lines.append(f"{role_icon} **{role_label}**{timestamp_str}")
        markdown_lines.append("")

        # Content - Parse intelligently (JSON, markdown, HTML, etc.)
        from humanizer.services.content_parser import ContentParser
        raw_content = message.content_text or ""
        parsed = ContentParser.parse(raw_content)
        content = parsed.formatted_content

        # Add metadata badge if JSON was parsed
        if parsed.content_type == "json" and parsed.metadata:
            markdown_lines.append(f"*[JSON content detected - {len(parsed.metadata)} metadata fields]*")
            markdown_lines.append("")

        # Process media if requested
        embedded_images = []
        if request.include_media:
            media_ids = extract_media_from_message(message)

            for file_id in media_ids:
                if file_id not in media_ids_seen:
                    # Get media record
                    media_stmt = select(ChatGPTMedia).where(
                        ChatGPTMedia.file_id == file_id
                    )
                    media_result = await session.execute(media_stmt)
                    media = media_result.scalar_one_or_none()

                    if media:
                        media_url = f"{config.MEDIA_URL_PREFIX}/{file_id}"
                        media_refs.append({
                            "file_id": file_id,
                            "url": media_url,
                            "mime_type": media.mime_type or "unknown",
                            "has_file": media.file_path is not None
                        })
                        media_ids_seen.add(file_id)

                        # Embed image inline if configured
                        if config.EMBED_IMAGES_INLINE:
                            # Try to replace protocol references in content
                            replaced = False
                            if f"sediment://{file_id}" in content:
                                content = content.replace(f"sediment://{file_id}", f"![Image]({media_url})")
                                replaced = True
                            if f"sediment://file_{file_id.replace('file-', '')}" in content:
                                content = content.replace(f"sediment://file_{file_id.replace('file-', '')}", f"![Image]({media_url})")
                                replaced = True
                            if f"file-service://{file_id}" in content:
                                content = content.replace(f"file-service://{file_id}", f"![Image]({media_url})")
                                replaced = True

                            # If not replaced (media in content_parts but not content_text), append
                            if not replaced:
                                embedded_images.append(f"![Image]({media_url})")

        markdown_lines.append(content)
        # Append images that weren't in content_text (from content_parts)
        for img_md in embedded_images:
            markdown_lines.append(img_md)
        markdown_lines.append("")

        # Separator between messages
        if i < len(messages) - 1:
            markdown_lines.append(config.MESSAGE_SEPARATOR)

    # Page break if paginated
    if request.pagination and current_page < total_pages and config.SHOW_PAGE_BREAKS:
        markdown_lines.append(config.SECTION_SEPARATOR)
        markdown_lines.append(f"*Page {current_page} of {total_pages}*")

    markdown = "\n".join(markdown_lines)

    return ChatGPTRenderResponse(
        conversation_uuid=conversation_uuid,
        title=conv.title,
        total_messages=total_messages,
        total_pages=total_pages,
        current_page=current_page,
        markdown=markdown,
        media_refs=media_refs
    )


# ========================================
# HTML Export
# ========================================

async def export_conversation_html(
    session: AsyncSession,
    conversation_uuid: UUID,
    request: ChatGPTExportRequest,
    config: RenderConfig = RenderConfig()
) -> str:
    """
    Export conversation as styled HTML.

    Features:
    - Responsive design
    - MathJax for LaTeX
    - Syntax highlighting for code
    - Embedded images (base64 or URLs)
    - Custom themes

    Returns:
        Complete HTML document as string
    """
    # Get markdown first
    render_request = ChatGPTRenderRequest(
        pagination=request.pagination,
        messages_per_page=request.messages_per_page,
        include_media=request.include_media
    )

    render_response = await render_conversation_markdown(
        session, conversation_uuid, render_request, config
    )

    # Convert markdown to HTML using python-markdown library
    import markdown
    import html as html_lib
    import re

    # Protect LaTeX content from markdown processing
    latex_blocks = []

    def protect_latex(match):
        """Store LaTeX block and return placeholder."""
        placeholder = f"LATEX_BLOCK_{len(latex_blocks)}_PLACEHOLDER"
        latex_blocks.append(match.group(0))
        return placeholder

    # Protect display math: \[...\] and $$...$$
    protected_md = re.sub(r'\\\[(.*?)\\\]', protect_latex, render_response.markdown, flags=re.DOTALL)
    protected_md = re.sub(r'\$\$(.*?)\$\$', protect_latex, protected_md, flags=re.DOTALL)

    # Protect inline math: \(...\) and $...$
    protected_md = re.sub(r'\\\((.*?)\\\)', protect_latex, protected_md, flags=re.DOTALL)
    protected_md = re.sub(r'\$([^\$]+?)\$', protect_latex, protected_md)

    # Configure markdown with extensions for better rendering
    md = markdown.Markdown(extensions=[
        'extra',        # Tables, fenced code, footnotes
        'codehilite',   # Syntax highlighting
        'nl2br',        # Newline to <br>
        'sane_lists',   # Better list handling
        'toc',          # Table of contents
    ])

    # Convert markdown to HTML
    html_content = md.convert(protected_md)

    # Restore LaTeX blocks
    for i, latex_block in enumerate(latex_blocks):
        placeholder = f"LATEX_BLOCK_{i}_PLACEHOLDER"
        html_content = html_content.replace(placeholder, latex_block)

    # Build HTML document
    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html_lib.escape(render_response.title or 'Conversation')}</title>

    <!-- MathJax for LaTeX rendering -->
    {_mathjax_script() if config.INCLUDE_MATHJAX else ''}

    <!-- Mermaid for chart rendering -->
    {_mermaid_script()}

    <style>
        {_get_html_css(config)}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>{html_lib.escape(render_response.title or 'Untitled Conversation')}</h1>
            <div class="metadata">
                <span>Messages: {render_response.total_messages}</span>
                {f'<span> | Pages: {render_response.total_pages}</span>' if render_response.total_pages > 1 else ''}
            </div>
        </header>

        <main class="conversation-content">
            {html_content}
        </main>

        <footer>
            <p>Rendered with Humanizer | {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
        </footer>
    </div>

    <!-- Re-render MathJax after page load -->
    <script>
        if (window.MathJax) {{
            MathJax.typesetPromise();
        }}
        if (window.mermaid) {{
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
        }}
    </script>
</body>
</html>"""

    return html_doc


def _mathjax_script() -> str:
    """Return MathJax CDN script tag."""
    return """
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <script>
        MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
            },
            svg: {fontCache: 'global'}
        };
    </script>
    """


def _mermaid_script() -> str:
    """Return Mermaid CDN script tag."""
    return """
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose'
        });
    </script>
    """


def _get_html_css(config: RenderConfig) -> str:
    """Return CSS for HTML export."""
    return """
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        header {
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        h1 {
            font-size: 2em;
            margin-bottom: 10px;
            color: #222;
        }

        .metadata {
            color: #666;
            font-size: 0.9em;
        }

        main {
            margin-bottom: 40px;
        }

        p {
            margin-bottom: 1.5em;
        }

        img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 20px 0;
        }

        footer {
            border-top: 1px solid #eee;
            padding-top: 20px;
            text-align: center;
            color: #999;
            font-size: 0.85em;
        }

        /* Message styling */
        .message {
            margin-bottom: 2em;
            padding: 15px;
            border-left: 3px solid #ddd;
        }

        .message.user { border-left-color: #4CAF50; }
        .message.assistant { border-left-color: #2196F3; }
        .message.system { border-left-color: #FF9800; }
        .message.tool { border-left-color: #9C27B0; }
    """


# ========================================
# Export Router
# ========================================

async def export_conversation(
    session: AsyncSession,
    conversation_uuid: UUID,
    request: ChatGPTExportRequest,
    config: RenderConfig = RenderConfig()
) -> ChatGPTExportResponse:
    """
    Export conversation in requested format.

    Supported formats:
    - raw_markdown: Plain markdown
    - rendered_html: Styled HTML with embedded media
    - pdf: PDF document (future)

    Args:
        session: Database session
        conversation_uuid: Conversation UUID
        request: Export request with format specification
        config: Rendering configuration

    Returns:
        ChatGPTExportResponse with content in requested format
    """
    # Get conversation
    conv_stmt = select(ChatGPTConversation).where(
        ChatGPTConversation.uuid == conversation_uuid
    )
    conv_result = await session.execute(conv_stmt)
    conv = conv_result.scalar_one_or_none()

    if not conv:
        raise ValueError(f"Conversation {conversation_uuid} not found")

    # Route to appropriate renderer
    if request.format == "raw_markdown":
        render_request = ChatGPTRenderRequest(
            pagination=request.pagination,
            messages_per_page=request.messages_per_page,
            include_media=request.include_media
        )
        render_response = await render_conversation_markdown(
            session, conversation_uuid, render_request, config
        )
        content = render_response.markdown
        media_count = len(render_response.media_refs)

    elif request.format == "rendered_html":
        content = await export_conversation_html(
            session, conversation_uuid, request, config
        )
        # Count media references
        media_stmt = select(ChatGPTMedia).where(
            ChatGPTMedia.conversation_uuid == conversation_uuid,
            ChatGPTMedia.file_path.isnot(None)
        )
        media_result = await session.execute(media_stmt)
        media_count = len(media_result.scalars().all())

    elif request.format == "pdf":
        # TODO: Implement PDF export
        # Options: weasyprint, reportlab, or wkhtmltopdf
        raise NotImplementedError(
            "PDF export not yet implemented. "
            "Future implementation will support: "
            "- Page headers/footers, "
            "- Table of contents, "
            "- Embedded fonts, "
            "- SVG graphics, "
            "- Interactive forms (PDF spec), "
            "- Animated transitions (PDF spec)"
        )

    else:
        raise ValueError(f"Unsupported format: {request.format}")

    return ChatGPTExportResponse(
        conversation_uuid=conversation_uuid,
        title=conv.title,
        format=request.format,
        content=content,
        media_count=media_count
    )
