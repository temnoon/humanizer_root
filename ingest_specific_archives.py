"""
Ingest specific ChatGPT archives (chat5 and Chat8)

This script ingests two specific archives:
- /Users/tem/nab2/chat5
- /Users/tem/Chat8

It bypasses the find_archives() function and processes archives directly.
"""

import asyncio
import time
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from humanizer.config import settings
from humanizer.services.chatgpt import (
    parse_conversations_json,
    merge_conversation_versions,
    extract_media_references,
    find_media_file,
    save_conversation,
)


async def ingest_specific_archives():
    """Ingest chat5 and Chat8 archives."""
    start_time = time.time()

    # Archive paths
    archives = [
        Path("/Users/tem/nab2/chat5"),
        Path("/Users/tem/Chat8"),
    ]

    # Verify archives exist
    for archive_path in archives:
        if not archive_path.exists():
            print(f"❌ Archive not found: {archive_path}")
            return
        if not (archive_path / "conversations.json").exists():
            print(f"❌ No conversations.json in: {archive_path}")
            return

    print(f"✅ Found {len(archives)} archives to process\n")

    # Create database session
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        errors = []
        conversation_index = {}

        # Step 1: Parse all archives and index by UUID
        print("📖 Parsing archives...")
        for archive_path in archives:
            try:
                conversations_file = archive_path / "conversations.json"
                conversations = parse_conversations_json(conversations_file)

                print(f"  {archive_path.name}: {len(conversations)} conversations")

                for conv in conversations:
                    conv_id = conv.get('id')
                    if not conv_id:
                        continue

                    if conv_id not in conversation_index:
                        conversation_index[conv_id] = []

                    conversation_index[conv_id].append({
                        'archive': archive_path,
                        'archive_name': archive_path.name,
                        'data': conv,
                        'updated_at': conv.get('update_time', 0),
                    })

            except Exception as e:
                error_msg = f"Error parsing {archive_path.name}: {str(e)}"
                errors.append(error_msg)
                print(f"❌ {error_msg}")

        print(f"\n📊 Total unique conversations: {len(conversation_index)}")

        # Step 2: Merge and save conversations
        print("\n💾 Saving conversations to database...")
        total_messages = 0
        total_media_found = 0
        total_media_matched = 0
        conversations_saved = 0
        conversations_skipped = 0

        for idx, (conv_id, versions) in enumerate(conversation_index.items(), 1):
            if idx % 100 == 0:
                print(f"  Processed {idx}/{len(conversation_index)} conversations...")

            try:
                # Merge temporal versions (latest update wins)
                merged_conv = merge_conversation_versions([v['data'] for v in versions])

                # Extract media references
                messages = merged_conv.get('merged_messages', [])
                media_refs = extract_media_references(messages)
                total_media_found += len(media_refs)

                # Match media files (check all source archives)
                for media_ref in media_refs:
                    # Collect all archives that have this conversation
                    conv_archives = [v['archive'] for v in versions]
                    result = find_media_file(conv_archives, media_ref['file_id'])
                    if result:
                        file_path, archive_name = result
                        media_ref['file_path'] = str(file_path)
                        media_ref['source_archive'] = archive_name
                        total_media_matched += 1

                # Save to database
                conv_db, messages_imported, media_imported = await save_conversation(
                    session,
                    merged_conv,
                    archive_name=versions[0]['archive_name'],  # Use first archive as source
                    media_refs=media_refs,
                    force_reimport=False  # Skip existing conversations
                )

                if messages_imported > 0:
                    conversations_saved += 1
                    total_messages += messages_imported
                else:
                    conversations_skipped += 1

            except Exception as e:
                error_msg = f"Error saving conversation {conv_id[:8]}: {str(e)}"
                errors.append(error_msg)
                # Don't print individual errors during bulk import

        await session.commit()

        # Final stats
        processing_time = time.time() - start_time

        print("\n" + "="*60)
        print("✅ INGESTION COMPLETE")
        print("="*60)
        print(f"Archives processed: {len(archives)}")
        print(f"Conversations saved: {conversations_saved}")
        print(f"Conversations skipped (already exist): {conversations_skipped}")
        print(f"Total messages imported: {total_messages}")
        print(f"Media files found: {total_media_found}")
        print(f"Media files matched: {total_media_matched}")
        print(f"Errors: {len(errors)}")
        print(f"Processing time: {processing_time:.2f}s")

        if errors:
            print("\n⚠️ Errors encountered:")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more")


if __name__ == "__main__":
    asyncio.run(ingest_specific_archives())
