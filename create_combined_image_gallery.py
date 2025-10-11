"""
Create combined image gallery from Journal Recognizer and Image Name Echo Bounce GPTs.

This script demonstrates TWO approaches to data retrieval:

1. **Direct Database Access (Used Here)** - Fast bulk extraction
   - Uses psql queries via SQLAlchemy
   - Efficient for large-scale data extraction
   - No API overhead
   - Direct access to JSONB metadata

2. **API Endpoint Access (Alternative)** - Better for external integrations
   - Uses HTTP API endpoints: /chatgpt/search, /chatgpt/conversation/{uuid}
   - Proper authentication, rate limiting, caching
   - Cleaner separation of concerns
   - Better for MCP server or external tools

**Choice Rationale:**
For this gallery generation task, we use direct DB access because:
- Single-use script (not production service)
- Need bulk extraction of images + metadata
- Performance matters (avoiding HTTP overhead)
- Running on same machine as database

For AUI recommendations or MCP tools, we'd use API endpoints.
"""

import asyncio
import re
from typing import List, Dict, Optional
from pathlib import Path
from sqlalchemy import text
from datetime import datetime

from humanizer.database.connection import get_session
from humanizer.models.chatgpt import ChatGPTConversation, ChatGPTMessage, ChatGPTMedia


# Custom GPT IDs
JOURNAL_RECOGNIZER_ID = "g-T7bW2qVzx"  # OCR notebook transcriptions
IMAGE_ECHO_BOUNCE_ID = "g-FmQp1Tm1G"   # Image titles & descriptions


def extract_code_block(content: str) -> str:
    """Extract text from markdown code block."""
    pattern = r'```(?:markdown)?\s*\n(.*?)```'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return content.strip()


def extract_table_data(content: str) -> Optional[Dict[str, str]]:
    """Extract title, short description, and long description from markdown table."""
    lines = content.split('\n')

    # Look for markdown table
    headers = []
    data_row = []

    for line in lines:
        line = line.strip()
        if '|' not in line:
            continue

        cells = [cell.strip() for cell in line.split('|')]
        cells = [c for c in cells if c and c != '---']

        if not cells:
            continue

        # Check for header separator
        if all('-' in cell for cell in cells):
            continue

        # Store headers or data
        if not headers:
            headers = [h.lower() for h in cells]
        elif not data_row:
            data_row = cells

    # Build dict
    if headers and data_row:
        result = {}
        for i, header in enumerate(headers):
            if i < len(data_row):
                result[header] = data_row[i]
        return result

    return None


async def extract_journal_images() -> List[Dict]:
    """
    Extract images from Journal Recognizer GPT.

    Data retrieval: Direct psql query using SQLAlchemy
    Why: Efficient bulk extraction with JSONB filtering
    """
    print("📔 Extracting Journal Recognizer images...")

    images = []

    async for session in get_session():
        try:
            # Query: Get conversations, messages, and media
            # Uses JSONB operator ->> to filter by gizmo_id
            query = text("""
                SELECT DISTINCT
                    c.uuid as conversation_uuid,
                    c.title as conversation_title,
                    m.uuid as message_uuid,
                    m.content_text,
                    m.author_role,
                    m.created_at,
                    media.file_id,
                    media.file_path,
                    media.mime_type
                FROM chatgpt_conversations c
                JOIN chatgpt_messages m ON m.conversation_uuid = c.uuid
                LEFT JOIN chatgpt_media media ON media.conversation_uuid = c.uuid
                WHERE
                    c.custom_metadata->>'gizmo_id' = :gizmo_id
                    AND media.file_path IS NOT NULL
                    AND media.mime_type LIKE 'image/%'
                ORDER BY m.created_at
            """)

            result = await session.execute(query, {'gizmo_id': JOURNAL_RECOGNIZER_ID})
            rows = result.fetchall()

            print(f"  Found {len(rows)} image messages")

            # Group by image, find associated transcription
            image_map = {}
            transcription_map = {}

            # First pass: collect transcriptions by conversation
            for row in rows:
                conv_uuid = str(row.conversation_uuid)
                msg_uuid = str(row.message_uuid)

                if row.author_role == 'assistant' and row.content_text and '```' in row.content_text:
                    # Extract transcription
                    transcription = extract_code_block(row.content_text)
                    if transcription:
                        transcription_map[conv_uuid] = transcription

            # Second pass: match images to transcriptions
            for row in rows:
                conv_uuid = str(row.conversation_uuid)

                if row.file_path:
                    image_key = row.file_id
                    if image_key not in image_map:
                        image_map[image_key] = {
                            'source': 'journal_recognizer',
                            'conversation_uuid': conv_uuid,
                            'conversation_title': row.conversation_title or 'Untitled',
                            'file_id': row.file_id,
                            'file_path': row.file_path,
                            'mime_type': row.mime_type,
                            'created_at': row.created_at,
                            'transcription': transcription_map.get(conv_uuid, 'No transcription found'),
                        }

            images = list(image_map.values())
            print(f"  ✅ Extracted {len(images)} unique images with transcriptions")
            return images

        finally:
            await session.close()


async def extract_echo_bounce_images() -> List[Dict]:
    """
    Extract images from Image Echo Bounce GPT.

    Data retrieval: Direct psql query with JOIN on media table
    Why: Need to correlate images with description tables in messages
    """
    print("🎨 Extracting Image Echo Bounce images...")

    images = []

    async for session in get_session():
        try:
            # Query: Get images and associated messages
            query = text("""
                SELECT DISTINCT
                    c.uuid as conversation_uuid,
                    c.title as conversation_title,
                    c.created_at as conversation_created_at,
                    m.uuid as message_uuid,
                    m.content_text,
                    m.author_role,
                    m.created_at as message_created_at,
                    media.file_id,
                    media.file_path,
                    media.mime_type,
                    media.message_uuid as media_message_uuid
                FROM chatgpt_conversations c
                JOIN chatgpt_messages m ON m.conversation_uuid = c.uuid
                LEFT JOIN chatgpt_media media ON media.conversation_uuid = c.uuid
                WHERE
                    c.custom_metadata->>'gizmo_id' = :gizmo_id
                    AND media.file_path IS NOT NULL
                    AND media.mime_type LIKE 'image/%'
                ORDER BY c.created_at, m.created_at
            """)

            result = await session.execute(query, {'gizmo_id': IMAGE_ECHO_BOUNCE_ID})
            rows = result.fetchall()

            print(f"  Found {len(rows)} image messages")

            # Group by image and conversation to find descriptions
            conv_messages = {}
            image_map = {}

            # Collect all messages by conversation
            for row in rows:
                conv_uuid = str(row.conversation_uuid)
                if conv_uuid not in conv_messages:
                    conv_messages[conv_uuid] = []

                if row.message_uuid:
                    conv_messages[conv_uuid].append({
                        'uuid': str(row.message_uuid),
                        'content': row.content_text,
                        'role': row.author_role,
                        'created_at': row.message_created_at,
                    })

            # Match images to descriptions
            for row in rows:
                if not row.file_path:
                    continue

                conv_uuid = str(row.conversation_uuid)
                file_id = row.file_id

                # Find the assistant response after this image
                description_data = None
                messages = conv_messages.get(conv_uuid, [])

                for msg in messages:
                    if msg['role'] == 'assistant' and msg['content'] and '|' in msg['content']:
                        # Try to extract table data
                        table = extract_table_data(msg['content'])
                        if table:
                            description_data = table
                            break

                if file_id not in image_map:
                    image_map[file_id] = {
                        'source': 'image_echo_bounce',
                        'conversation_uuid': conv_uuid,
                        'conversation_title': row.conversation_title or 'Untitled',
                        'file_id': file_id,
                        'file_path': row.file_path,
                        'mime_type': row.mime_type,
                        'created_at': row.message_created_at,
                        'title': description_data.get('title', 'No title') if description_data else 'No title',
                        'short_description': description_data.get('short description', 'N/A') if description_data else 'N/A',
                        'long_description': description_data.get('long description', 'N/A') if description_data else 'N/A',
                    }

            images = list(image_map.values())
            print(f"  ✅ Extracted {len(images)} unique images with descriptions")
            return images

        finally:
            await session.close()


def generate_markdown(journal_images: List[Dict], echo_images: List[Dict]) -> str:
    """Generate combined markdown gallery."""
    md = []

    # Header
    md.append("# Combined Image Gallery: Journal Recognizer + Image Echo Bounce")
    md.append(f"\n**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    md.append(f"\n**Total Images:** {len(journal_images) + len(echo_images)}")
    md.append(f"- Journal Recognizer (OCR): {len(journal_images)} images")
    md.append(f"- Image Echo Bounce: {len(echo_images)} images")

    # Data retrieval explanation
    md.append("\n---\n")
    md.append("## Data Retrieval Method\n")
    md.append("This gallery was generated using **direct PostgreSQL queries** via SQLAlchemy.\n")
    md.append("### Why Direct Database Access?\n")
    md.append("- **Performance**: Bulk extraction without HTTP overhead")
    md.append("- **Flexibility**: Direct JSONB querying with `custom_metadata->>'gizmo_id'`")
    md.append("- **Efficiency**: Single query joins conversations, messages, and media")
    md.append("- **Use Case**: One-time data extraction for gallery generation\n")

    md.append("### Alternative: API Endpoint Access\n")
    md.append("For production integrations (like MCP server or AUI), we use HTTP API endpoints:")
    md.append("```")
    md.append("GET /chatgpt/search?query=...&author_role=assistant")
    md.append("GET /chatgpt/conversation/{uuid}")
    md.append("POST /chatgpt/conversation/{uuid}/render")
    md.append("```\n")
    md.append("**Benefits of API approach:**")
    md.append("- Authentication & rate limiting")
    md.append("- Clean separation (business logic in services)")
    md.append("- Caching layer")
    md.append("- Better for external integrations\n")

    md.append("**For this task:** Direct DB = faster, simpler, sufficient.\n")

    # Journal Recognizer section
    md.append("\n---\n")
    md.append("## 📔 Journal Recognizer (OCR Transcriptions)\n")
    md.append(f"**Custom GPT ID:** `{JOURNAL_RECOGNIZER_ID}`")
    md.append(f"\n**Total Images:** {len(journal_images)}\n")

    for idx, img in enumerate(journal_images, 1):
        md.append(f"\n### Image {idx}: {img['conversation_title']}\n")
        md.append(f"**File:** `{Path(img['file_path']).name}`")
        md.append(f"\n**Created:** {img['created_at']}")
        md.append(f"\n**Conversation:** `{img['conversation_uuid']}`\n")

        # Embedded image (scaled to 400px)
        md.append(f'<img src="{img["file_path"]}" width="400" alt="Journal page {idx}" />\n')

        # Transcription
        md.append("**Transcription:**")
        md.append("```")
        md.append(img['transcription'])
        md.append("```\n")
        md.append("---\n")

    # Image Echo Bounce section
    md.append("\n## 🎨 Image Echo Bounce (Titles & Descriptions)\n")
    md.append(f"**Custom GPT ID:** `{IMAGE_ECHO_BOUNCE_ID}`")
    md.append(f"\n**Total Images:** {len(echo_images)}\n")

    for idx, img in enumerate(echo_images, 1):
        md.append(f"\n### Image {idx}: {img['conversation_title']}\n")
        md.append(f"**File:** `{Path(img['file_path']).name}`")
        md.append(f"\n**Created:** {img['created_at']}")
        md.append(f"\n**Conversation:** `{img['conversation_uuid']}`\n")

        # Embedded image (scaled to 400px)
        md.append(f'<img src="{img["file_path"]}" width="400" alt="{img["title"]}" />\n')

        # Metadata table
        md.append("| Field | Value |")
        md.append("| --- | --- |")
        md.append(f"| **Title** | {img['title']} |")
        md.append(f"| **Short Description** | {img['short_description']} |")
        md.append(f"| **Long Description** | {img['long_description']} |\n")
        md.append("---\n")

    return '\n'.join(md)


async def main():
    """Main execution."""
    print("🎨 Creating Combined Image Gallery")
    print("="*60)

    # Extract images from both GPTs
    journal_images = await extract_journal_images()
    echo_images = await extract_echo_bounce_images()

    # Generate markdown
    print("\n📝 Generating markdown...")
    markdown = generate_markdown(journal_images, echo_images)

    # Save to file
    output_file = Path("combined_image_gallery.md")
    output_file.write_text(markdown)

    print(f"\n✅ Gallery saved to: {output_file.absolute()}")
    print(f"   Total images: {len(journal_images) + len(echo_images)}")
    print(f"   - Journal Recognizer: {len(journal_images)}")
    print(f"   - Image Echo Bounce: {len(echo_images)}")


if __name__ == "__main__":
    asyncio.run(main())
