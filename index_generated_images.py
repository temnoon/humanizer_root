"""
Index DALL-E and sediment generated images into the database.
These were found in subdirectories but not previously indexed.
"""

import asyncio
import re
from pathlib import Path
from typing import Dict, List, Optional
from uuid import UUID
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database.connection import get_session
from humanizer.models.chatgpt import ChatGPTMedia, ChatGPTConversation

CHAT7_PATH = Path("/Users/tem/rho/var/media/chat7")
DALLE_PATH = CHAT7_PATH / "dalle-generations"


async def scan_dalle_images() -> List[Dict]:
    """Scan dalle-generations folder."""
    print("🔍 Scanning DALL-E images...")

    images = []
    if DALLE_PATH.exists():
        for file in DALLE_PATH.glob("file-*.webp"):
            # Format: file-{ID}-{UUID}.webp
            parts = file.stem.split('-', 2)
            if len(parts) >= 2:
                file_id = f"file-{parts[1]}"
                images.append({
                    'file_id': file_id,
                    'file_path': str(file),
                    'mime_type': 'image/webp',
                    'source': 'dalle-generations'
                })

    print(f"  ✅ Found {len(images)} DALL-E images")
    return images


async def scan_sediment_images() -> List[Dict]:
    """Scan user-* folders for sediment images."""
    print("🔍 Scanning sediment images...")

    images = []
    for user_folder in CHAT7_PATH.glob("user-*"):
        if user_folder.is_dir():
            # Look for image files
            for file in user_folder.rglob("file_*.png"):
                # Format: file_{HASH}-{UUID}.png
                file_id_part = file.stem.split('-')[0]
                # Convert file_ to file-
                file_id = file_id_part.replace('file_', 'file-')

                images.append({
                    'file_id': file_id,
                    'file_path': str(file),
                    'mime_type': 'image/png',
                    'source': 'sediment'
                })

    print(f"  ✅ Found {len(images)} sediment images")
    return images


async def find_conversation_for_image(session: AsyncSession, file_id: str, gizmo_id: str) -> Optional[UUID]:
    """
    Try to find which conversation this image belongs to.
    Look for the file_id in message content_parts or content_text.
    """

    # Search in content_parts (structured references)
    query = text("""
        SELECT DISTINCT m.conversation_uuid
        FROM chatgpt_messages m
        JOIN chatgpt_conversations c ON c.uuid = m.conversation_uuid
        WHERE
            c.custom_metadata->>'gizmo_id' = :gizmo_id
            AND (
                m.content_parts::text LIKE :file_pattern
                OR m.content_text LIKE :file_pattern
            )
        LIMIT 1
    """)

    result = await session.execute(
        query,
        {
            'gizmo_id': gizmo_id,
            'file_pattern': f'%{file_id}%'
        }
    )
    row = result.first()

    if row:
        return row.conversation_uuid

    return None


async def index_images(images: List[Dict], gizmo_id: str, source_name: str):
    """Index images into the database."""
    print(f"\n📥 Indexing {len(images)} {source_name} images...")

    async for session in get_session():
        try:
            indexed = 0
            skipped = 0
            linked = 0
            orphaned = 0

            for i, img in enumerate(images, 1):
                if i % 50 == 0:
                    print(f"  Processing {i}/{len(images)}...")

                file_id = img['file_id']

                # Check if already exists
                existing_stmt = select(ChatGPTMedia).where(
                    ChatGPTMedia.file_id == file_id
                )
                existing_result = await session.execute(existing_stmt)
                existing = existing_result.scalar_one_or_none()

                if existing:
                    # Update file path if missing
                    if not existing.file_path:
                        existing.file_path = img['file_path']
                        existing.source_archive = 'chat7'
                        existing.mime_type = img['mime_type']
                        indexed += 1
                    else:
                        skipped += 1
                    continue

                # Try to find which conversation this belongs to
                conv_uuid = await find_conversation_for_image(session, file_id, gizmo_id)

                # Create new media record
                media = ChatGPTMedia(
                    file_id=file_id,
                    conversation_uuid=conv_uuid,  # May be None (orphaned)
                    message_uuid=None,  # Can't determine specific message
                    file_path=img['file_path'],
                    source_archive='chat7',
                    mime_type=img['mime_type'],
                    file_metadata={'source': img['source']}
                )

                session.add(media)
                indexed += 1

                if conv_uuid:
                    linked += 1
                else:
                    orphaned += 1

            # Commit all changes
            await session.commit()

            print(f"  ✅ {source_name} indexing complete:")
            print(f"     - Indexed: {indexed}")
            print(f"     - Skipped (already exist): {skipped}")
            print(f"     - Linked to conversations: {linked}")
            print(f"     - Orphaned (no conversation): {orphaned}")

            return indexed

        except Exception as e:
            await session.rollback()
            print(f"  ❌ Error indexing {source_name}: {e}")
            raise
        finally:
            await session.close()


async def verify_indexing():
    """Verify how many media files are now indexed."""
    print("\n🔍 Verifying indexing...")

    async for session in get_session():
        try:
            query = text("""
                SELECT
                    COUNT(*) as total,
                    COUNT(file_path) as with_paths,
                    COUNT(DISTINCT conversation_uuid) as conversations
                FROM chatgpt_media med
                JOIN chatgpt_conversations c ON c.uuid = med.conversation_uuid
                WHERE c.custom_metadata->>'gizmo_id' = 'g-FmQp1Tm1G'
            """)

            result = await session.execute(query)
            row = result.first()

            print(f"  📊 Total media records: {row.total}")
            print(f"  📁 With file paths: {row.with_paths}")
            print(f"  💬 Across conversations: {row.conversations}")

            return row

        finally:
            await session.close()


async def main():
    print("=" * 60)
    print("Generated Images Indexing")
    print("=" * 60)

    GIZMO_ID = "g-FmQp1Tm1G"

    # Step 1: Scan directories
    dalle_images = await scan_dalle_images()
    sediment_images = await scan_sediment_images()

    total_found = len(dalle_images) + len(sediment_images)
    print(f"\n📊 Total images found: {total_found}")

    # Step 2: Index DALL-E images
    dalle_indexed = await index_images(dalle_images, GIZMO_ID, "DALL-E")

    # Step 3: Index sediment images
    sediment_indexed = await index_images(sediment_images, GIZMO_ID, "sediment")

    # Step 4: Verify
    stats = await verify_indexing()

    print("\n" + "=" * 60)
    print("✨ Indexing complete!")
    print(f"📊 Summary:")
    print(f"   - DALL-E images indexed: {dalle_indexed}")
    print(f"   - Sediment images indexed: {sediment_indexed}")
    print(f"   - Total media records now: {stats.total}")
    print(f"   - With file paths: {stats.with_paths}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
