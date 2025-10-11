"""
Extract image echo and bounce chains from g-FmQp1Tm1G GPT.

This GPT:
- Accepts images (often polar graphs from notebooks)
- Returns tables with Title, Short Description, Long Description
- Supports /d (detailed description) and /e (echo/generate) commands
- Creates chains: image → description → generated image → new description

Output: PDF with images and description chains.
"""

import asyncio
import re
import json
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path

from humanizer.database.connection import get_session
from humanizer.models.chatgpt import ChatGPTConversation, ChatGPTMessage, ChatGPTMedia


GIZMO_ID = "g-FmQp1Tm1G"


def extract_table_from_text(content: str) -> Optional[List[Dict[str, str]]]:
    """Extract markdown table rows from text."""
    # Look for markdown tables with | separators
    table_pattern = r'\|([^\|]+)\|([^\|]+)\|'
    lines = content.split('\n')

    table_data = []
    in_table = False
    headers = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check if this is a table line
        if '|' in line:
            cells = [cell.strip() for cell in line.split('|')]
            cells = [c for c in cells if c]  # Remove empty

            if not cells:
                continue

            # Check for header separator (----)
            if all('-' in cell for cell in cells):
                in_table = True
                continue

            # Store headers
            if not in_table and not headers:
                headers = cells
                continue

            # Store data rows
            if in_table and headers and len(cells) >= len(headers):
                row_dict = {}
                for i, header in enumerate(headers):
                    if i < len(cells):
                        row_dict[header.lower()] = cells[i]
                if row_dict:
                    table_data.append(row_dict)

    return table_data if table_data else None


def extract_description(content: str) -> str:
    """Extract detailed description from content."""
    # Remove table markers and clean up
    lines = content.split('\n')
    description_lines = []
    in_description = False

    for line in lines:
        line = line.strip()

        # Skip table lines
        if '|' in line and ('---' in line or line.startswith('|')):
            in_description = False
            continue

        # Start collecting after table or heading
        if line.startswith('#') or (in_description and line):
            in_description = True

        if in_description and line and not line.startswith('|'):
            description_lines.append(line)

    return '\n'.join(description_lines).strip()


async def extract_conversations():
    """Extract all conversations with image echo bounce GPT."""
    print(f"🔍 Extracting conversations from {GIZMO_ID} (Image Name echo and bounce)...")

    async for session in get_session():
        try:
            # Get all conversations
            query = text("""
                SELECT
                    c.uuid,
                    c.title,
                    c.created_at,
                    COUNT(m.uuid) as message_count
                FROM chatgpt_conversations c
                JOIN chatgpt_messages m ON m.conversation_uuid = c.uuid
                WHERE c.custom_metadata->>'gizmo_id' = :gizmo_id
                GROUP BY c.uuid, c.title, c.created_at
                ORDER BY c.created_at DESC
            """)

            result = await session.execute(query, {'gizmo_id': GIZMO_ID})
            rows = result.fetchall()

            conversations = []
            for row in rows:
                conversations.append({
                    'uuid': str(row.uuid),
                    'title': row.title or "Untitled",
                    'created_at': row.created_at,
                    'message_count': row.message_count
                })

            print(f"📊 Found {len(conversations)} conversations")
            return conversations

        finally:
            await session.close()


async def extract_conversation_chain(conv_uuid: str):
    """Extract image-description chain for one conversation."""
    async for session in get_session():
        try:
            # Get all messages in order
            query = text("""
                SELECT
                    m.uuid,
                    m.author_role,
                    m.content_text,
                    m.content_parts,
                    m.created_at
                FROM chatgpt_messages m
                WHERE m.conversation_uuid = :conv_uuid
                ORDER BY m.created_at
            """)

            result = await session.execute(query, {'conv_uuid': conv_uuid})
            rows = result.fetchall()

            chain = []
            current_entry = None

            for row in rows:
                msg = {
                    'uuid': str(row.uuid),
                    'role': row.author_role,
                    'content': row.content_text or '',
                    'content_parts': row.content_parts,
                    'created_at': row.created_at
                }

                # User message with images
                if msg['role'] == 'user' and msg['content_parts']:
                    # Extract image references from content_parts
                    images = await extract_images_from_parts(session, msg['content_parts'])

                    if images:
                        # Start new entry
                        if current_entry:
                            chain.append(current_entry)

                        current_entry = {
                            'type': 'original_image',
                            'images': images,
                            'command': msg['content'].strip(),
                            'descriptions': []
                        }

                # Assistant message with table or description
                elif msg['role'] == 'assistant' and msg['content']:
                    if current_entry:
                        # Try to extract table
                        table = extract_table_from_text(msg['content'])
                        description = extract_description(msg['content'])

                        current_entry['descriptions'].append({
                            'table': table,
                            'description': description,
                            'full_text': msg['content']
                        })

                # Tool message (DALL-E generation)
                elif msg['role'] == 'tool' and 'DALL·E' in msg['content']:
                    if current_entry:
                        current_entry['has_generation'] = True

            # Add last entry
            if current_entry:
                chain.append(current_entry)

            return chain

        finally:
            await session.close()


async def extract_images_from_parts(session: AsyncSession, content_parts) -> List[Dict]:
    """Extract images from content_parts JSONB."""
    images = []

    try:
        if isinstance(content_parts, str):
            parts = json.loads(content_parts)
        else:
            parts = content_parts

        if not isinstance(parts, list):
            return images

        for part in parts:
            if not isinstance(part, dict):
                continue

            # Look for asset_pointer or image references
            asset_pointer = part.get('asset_pointer', '')
            if asset_pointer and 'file-' in asset_pointer:
                # Extract file ID (skip protocol like file-service://)
                # asset_pointer format: "file-service://file-ABC123..."
                file_id_match = re.search(r'://(file-[A-Za-z0-9_-]+)', asset_pointer)
                if not file_id_match:
                    # Try direct match if no protocol
                    file_id_match = re.search(r'^(file-[A-Za-z0-9_-]+)', asset_pointer)

                if file_id_match:
                    file_id = file_id_match.group(1)

                    # Get media record
                    media_stmt = select(ChatGPTMedia).where(
                        ChatGPTMedia.file_id == file_id
                    )
                    media_result = await session.execute(media_stmt)
                    media = media_result.scalar_one_or_none()

                    if media:
                        images.append({
                            'file_id': file_id,
                            'file_path': media.file_path,
                            'mime_type': media.mime_type
                        })

    except (json.JSONDecodeError, TypeError, AttributeError) as e:
        print(f"  Warning: Could not parse content_parts: {e}")

    return images


async def create_markdown_document(conversations: List[Dict], all_chains: Dict[str, List]):
    """Create markdown document with all image-description chains."""
    print("\n📝 Creating document...")

    lines = []
    lines.append("# Image Echo and Bounce Collection")
    lines.append("")
    lines.append(f"*Extracted from {len(conversations)} conversations*")
    lines.append(f"*Source: Image Name echo and bounce GPT ({GIZMO_ID})*")
    lines.append("")
    lines.append("---")
    lines.append("")

    conversation_count = 0

    for conv in conversations:
        conv_uuid = conv['uuid']
        chain = all_chains.get(conv_uuid, [])

        if not chain:
            continue

        conversation_count += 1

        # Conversation header
        lines.append(f"## {conversation_count}. {conv['title']}")
        lines.append(f"*Date: {conv['created_at'].strftime('%Y-%m-%d')}*")
        lines.append("")

        # Process chain
        for i, entry in enumerate(chain, 1):
            lines.append(f"### Chain {i}")
            lines.append("")

            # Original images
            if entry['images']:
                lines.append("**Original Images:**")
                for img in entry['images']:
                    if img['file_path']:
                        lines.append(f"![Original]({img['file_path']})")
                        lines.append("")
                lines.append("")

            # Descriptions
            if entry['descriptions']:
                for desc in entry['descriptions']:
                    # Add table if present
                    if desc['table']:
                        lines.append("**Image Descriptions:**")
                        lines.append("")
                        # Reconstruct markdown table
                        if desc['table']:
                            headers = list(desc['table'][0].keys())
                            lines.append("| " + " | ".join(h.title() for h in headers) + " |")
                            lines.append("|" + "|".join(["---" for _ in headers]) + "|")
                            for row in desc['table']:
                                values = [row.get(h, '') for h in headers]
                                lines.append("| " + " | ".join(values) + " |")
                            lines.append("")

                    # Add detailed description
                    if desc['description']:
                        lines.append("**Detailed Description:**")
                        lines.append("")
                        lines.append(desc['description'])
                        lines.append("")

            # Note if generation occurred
            if entry.get('has_generation'):
                lines.append("*→ DALL-E generated new image from this description*")
                lines.append("")

            lines.append("---")
            lines.append("")

    document = "\n".join(lines)

    # Write to file
    output_path = "/Users/tem/humanizer_root/image_echo_bounce.md"
    with open(output_path, 'w') as f:
        f.write(document)

    print(f"✅ Document created: {output_path}")
    print(f"📄 Conversations included: {conversation_count}")
    print(f"📄 Total length: {len(document):,} characters")

    return output_path


async def main():
    """Main extraction pipeline."""
    print("=" * 60)
    print("Image Echo and Bounce Extraction Pipeline")
    print("=" * 60)

    # Step 1: Get all conversations
    conversations = await extract_conversations()

    # Step 2: Extract chains from each conversation
    print("\n🔗 Extracting image-description chains...")
    all_chains = {}

    for i, conv in enumerate(conversations, 1):
        if i % 10 == 0:
            print(f"  Processing conversation {i}/{len(conversations)}...")

        chain = await extract_conversation_chain(conv['uuid'])
        if chain:
            all_chains[conv['uuid']] = chain

    print(f"✅ Extracted chains from {len(all_chains)} conversations")

    # Step 3: Create document
    output_path = await create_markdown_document(conversations, all_chains)

    print("\n" + "=" * 60)
    print("✨ Extraction complete!")
    print(f"📊 Summary:")
    print(f"   - Total conversations: {len(conversations)}")
    print(f"   - Conversations with chains: {len(all_chains)}")
    print(f"   - Output file: {output_path}")
    print("\n💡 Next step: Convert to PDF using weasyprint or similar")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
