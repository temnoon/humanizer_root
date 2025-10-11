"""
Extract and deduplicate journal transcriptions from Journal Recognizer OCR GPT.

Gizmo ID: g-T7bW2qVzx
Total conversations: 134
Total transcriptions: 260
"""

import asyncio
import re
from typing import List, Dict, Tuple
from collections import defaultdict
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database.connection import get_session
from humanizer.models.chatgpt import ChatGPTConversation, ChatGPTMessage, ChatGPTMedia


def extract_code_block(content: str) -> str:
    """Extract text from markdown code block."""
    # Match ```markdown or ``` followed by content
    pattern = r'```(?:markdown)?\s*\n(.*?)```'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return content.strip()


def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate simple similarity between two texts (Jaccard similarity on words)."""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 or not words2:
        return 0.0
    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union)


async def extract_transcriptions():
    """Extract all transcriptions from Journal Recognizer OCR GPT."""
    print("🔍 Extracting transcriptions from g-T7bW2qVzx (Journal Recognizer OCR)...")

    async for session in get_session():
        try:
            # Query for all assistant messages with code blocks
            query = text("""
                SELECT
                    c.uuid as conversation_uuid,
                    c.title as conversation_title,
                    m.uuid as message_uuid,
                    m.content_text,
                    m.created_at
                FROM chatgpt_conversations c
                JOIN chatgpt_messages m ON m.conversation_uuid = c.uuid
                WHERE
                    c.custom_metadata->>'gizmo_id' = 'g-T7bW2qVzx'
                    AND m.author_role = 'assistant'
                    AND m.content_text LIKE '```%'
                ORDER BY m.created_at
            """)

            result = await session.execute(query)
            rows = result.fetchall()

            print(f"📊 Found {len(rows)} transcription messages")

            # Extract transcriptions
            transcriptions = []
            for row in rows:
                conv_uuid = row.conversation_uuid
                title = row.conversation_title or "Untitled"
                msg_uuid = row.message_uuid
                content = row.content_text
                created_at = row.created_at

                # Extract text from code block
                transcription = extract_code_block(content)

                transcriptions.append({
                    'conversation_uuid': str(conv_uuid),
                    'conversation_title': title,
                    'message_uuid': str(msg_uuid),
                    'transcription': transcription,
                    'created_at': created_at,
                    'original_content': content
                })

            print(f"✅ Extracted {len(transcriptions)} transcriptions")
            return transcriptions

        finally:
            await session.close()


async def deduplicate_transcriptions(transcriptions: List[Dict]) -> List[Dict]:
    """Deduplicate transcriptions using similarity matching."""
    print("\n🔄 Deduplicating transcriptions...")

    # Group by similar content
    unique = []
    duplicates = []

    for trans in transcriptions:
        text = trans['transcription']

        # Check if similar to any existing unique transcription
        is_duplicate = False
        for unique_trans in unique:
            similarity = calculate_similarity(text, unique_trans['transcription'])

            # If >90% similar, consider duplicate
            if similarity > 0.90:
                is_duplicate = True
                duplicates.append({
                    'duplicate': trans,
                    'similar_to': unique_trans,
                    'similarity': similarity
                })
                break

        if not is_duplicate:
            unique.append(trans)

    print(f"📈 Unique transcriptions: {len(unique)}")
    print(f"🔁 Duplicates found: {len(duplicates)}")

    # Show some duplicate examples
    if duplicates:
        print("\n📋 Sample duplicates:")
        for i, dup in enumerate(duplicates[:5]):
            print(f"\n  {i+1}. Similarity: {dup['similarity']:.2%}")
            print(f"     Original: {dup['similar_to']['conversation_title']}")
            print(f"     Duplicate: {dup['duplicate']['conversation_title']}")
            print(f"     Text preview: {dup['duplicate']['transcription'][:100]}...")

    return unique


async def find_associated_images(transcriptions: List[Dict]) -> Dict[str, List[Dict]]:
    """Find images associated with each transcription."""
    print("\n🖼️  Finding associated images...")

    async for session in get_session():
        try:
            images_by_message = {}

            for trans in transcriptions:
                msg_uuid = trans['message_uuid']
                conv_uuid = trans['conversation_uuid']

                # Find user message (with images) that preceded this assistant response
                query = text("""
                    SELECT
                        m.uuid as msg_uuid,
                        med.file_id,
                        med.file_path,
                        med.mime_type
                    FROM chatgpt_messages m
                    LEFT JOIN chatgpt_media med ON med.message_uuid = m.uuid
                    WHERE
                        m.conversation_uuid = :conv_uuid
                        AND m.author_role = 'user'
                        AND m.created_at < (
                            SELECT created_at FROM chatgpt_messages WHERE uuid = :msg_uuid
                        )
                        AND med.file_path IS NOT NULL
                    ORDER BY m.created_at DESC
                    LIMIT 10
                """)

                result = await session.execute(
                    query,
                    {'conv_uuid': conv_uuid, 'msg_uuid': msg_uuid}
                )
                rows = result.fetchall()

                images = []
                for row in rows:
                    images.append({
                        'file_id': row.file_id,
                        'file_path': row.file_path,
                        'mime_type': row.mime_type
                    })

                images_by_message[msg_uuid] = images

            total_images = sum(len(imgs) for imgs in images_by_message.values())
            print(f"✅ Found {total_images} images across {len(images_by_message)} transcriptions")

            return images_by_message

        finally:
            await session.close()


async def create_document(transcriptions: List[Dict], images: Dict[str, List[Dict]]) -> str:
    """Create a combined document with transcriptions and images."""
    print("\n📝 Creating document...")

    lines = []
    lines.append("# Journal Transcriptions")
    lines.append("")
    lines.append(f"*Extracted from {len(transcriptions)} notebook pages*")
    lines.append(f"*Source: Journal Recognizer OCR GPT (g-T7bW2qVzx)*")
    lines.append("")
    lines.append("---")
    lines.append("")

    for i, trans in enumerate(transcriptions, 1):
        # Add header
        title = trans['conversation_title']
        date = trans['created_at'].strftime("%Y-%m-%d")

        lines.append(f"## Entry {i}: {title}")
        lines.append(f"*Date: {date}*")
        lines.append("")

        # Add transcription
        lines.append(trans['transcription'])
        lines.append("")

        # Add associated images (limit to 2-3 per entry)
        msg_uuid = trans['message_uuid']
        entry_images = images.get(msg_uuid, [])

        if entry_images:
            lines.append("**Associated images:**")
            for img in entry_images[:3]:  # Limit to 3 images
                file_path = img['file_path']
                lines.append(f"- `{file_path}`")
            lines.append("")

        lines.append("---")
        lines.append("")

    document = "\n".join(lines)

    # Write to file
    output_path = "/Users/tem/humanizer_root/journal_transcriptions.md"
    with open(output_path, 'w') as f:
        f.write(document)

    print(f"✅ Document created: {output_path}")
    print(f"📄 Total length: {len(document):,} characters")

    return output_path


async def main():
    """Main extraction pipeline."""
    print("=" * 60)
    print("Journal Transcription Extraction Pipeline")
    print("=" * 60)

    # Step 1: Extract all transcriptions
    transcriptions = await extract_transcriptions()

    # Step 2: Deduplicate
    unique_transcriptions = await deduplicate_transcriptions(transcriptions)

    # Step 3: Find associated images
    images = await find_associated_images(unique_transcriptions)

    # Step 4: Create document
    output_path = await create_document(unique_transcriptions, images)

    print("\n" + "=" * 60)
    print("✨ Extraction complete!")
    print(f"📊 Summary:")
    print(f"   - Total transcriptions found: {len(transcriptions)}")
    print(f"   - Unique transcriptions: {len(unique_transcriptions)}")
    print(f"   - Duplicates removed: {len(transcriptions) - len(unique_transcriptions)}")
    print(f"   - Output file: {output_path}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
