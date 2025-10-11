"""
Fast indexing - just add all generated images as orphaned records.
We can link them later if needed.
"""

import asyncio
from pathlib import Path
from sqlalchemy import text
from humanizer.database.connection import get_session

CHAT7_PATH = Path("/Users/tem/rho/var/media/chat7")


async def index_all_generated_images():
    """Index all DALL-E and sediment images in one batch."""
    print("🔍 Scanning for generated images...")

    # Scan DALL-E
    dalle_images = []
    dalle_path = CHAT7_PATH / "dalle-generations"
    if dalle_path.exists():
        for file in dalle_path.glob("file-*.webp"):
            parts = file.stem.split('-', 2)
            if len(parts) >= 2:
                file_id = f"file-{parts[1]}"
                dalle_images.append((file_id, str(file), 'image/webp', 'dalle-generations'))

    # Scan sediment
    sediment_images = []
    for user_folder in CHAT7_PATH.glob("user-*"):
        if user_folder.is_dir():
            for file in user_folder.rglob("file_*.png"):
                file_id_part = file.stem.split('-')[0].replace('file_', 'file-')
                sediment_images.append((file_id_part, str(file), 'image/png', 'sediment'))

    print(f"  ✅ Found {len(dalle_images)} DALL-E images")
    print(f"  ✅ Found {len(sediment_images)} sediment images")

    all_images = dalle_images + sediment_images

    # Batch insert
    print(f"\n📥 Indexing {len(all_images)} images...")

    async for session in get_session():
        try:
            indexed = 0
            skipped = 0

            for i, (file_id, file_path, mime_type, source) in enumerate(all_images, 1):
                if i % 50 == 0:
                    print(f"  Processing {i}/{len(all_images)}...")

                # Check if exists
                check_query = text("""
                    SELECT 1 FROM chatgpt_media WHERE file_id = :file_id
                """)
                result = await session.execute(check_query, {'file_id': file_id})
                if result.first():
                    skipped += 1
                    continue

                # Insert as orphaned (conversation_uuid = NULL)
                insert_query = text("""
                    INSERT INTO chatgpt_media
                    (file_id, conversation_uuid, message_uuid, file_path, source_archive, mime_type, file_metadata)
                    VALUES (:file_id, NULL, NULL, :file_path, 'chat7', :mime_type, (:metadata)::jsonb)
                """)

                await session.execute(insert_query, {
                    'file_id': file_id,
                    'file_path': file_path,
                    'mime_type': mime_type,
                    'metadata': f'{{"source": "{source}"}}'
                })

                indexed += 1

            await session.commit()

            print(f"\n  ✅ Indexing complete:")
            print(f"     - Indexed: {indexed}")
            print(f"     - Skipped (already exist): {skipped}")

            return indexed, skipped

        except Exception as e:
            await session.rollback()
            print(f"  ❌ Error: {e}")
            raise
        finally:
            await session.close()


async def verify():
    """Check final counts."""
    print("\n🔍 Verification...")

    async for session in get_session():
        try:
            query = text("""
                SELECT
                    COUNT(*) FILTER (WHERE conversation_uuid IS NOT NULL) as linked,
                    COUNT(*) FILTER (WHERE conversation_uuid IS NULL) as orphaned,
                    COUNT(*) as total
                FROM chatgpt_media
                WHERE source_archive = 'chat7'
            """)

            result = await session.execute(query)
            row = result.first()

            print(f"  📊 Total media (chat7): {row.total}")
            print(f"     - Linked to conversations: {row.linked}")
            print(f"     - Orphaned: {row.orphaned}")

            return row

        finally:
            await session.close()


async def main():
    print("=" * 60)
    print("Fast Generated Images Indexing")
    print("=" * 60)

    indexed, skipped = await index_all_generated_images()
    stats = await verify()

    print("\n" + "=" * 60)
    print("✨ Complete!")
    print(f"   - New images indexed: {indexed}")
    print(f"   - Skipped (duplicates): {skipped}")
    print(f"   - Total in database: {stats.total}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
