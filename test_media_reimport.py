#!/usr/bin/env python3
"""
Test script to re-import ChatGPT archives with updated media file matching.

This will populate the file_path and source_archive fields in chatgpt_media table.
"""

import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database.connection import async_session_maker
from humanizer.services.chatgpt import ingest_archives
from humanizer.models.schemas import ChatGPTIngestRequest
from humanizer.models.chatgpt import ChatGPTMedia


async def check_media_before():
    """Check media status before re-import."""
    async with async_session_maker() as session:
        # Count total media
        stmt = select(ChatGPTMedia)
        result = await session.execute(stmt)
        all_media = result.scalars().all()

        total = len(all_media)
        with_paths = sum(1 for m in all_media if m.file_path is not None)
        without_paths = total - with_paths

        print(f"📊 Current Media Status:")
        print(f"  Total media records: {total}")
        print(f"  With file paths: {with_paths}")
        print(f"  Without file paths: {without_paths}")
        print()

        # Show sample media without paths
        print(f"📁 Sample media without paths:")
        no_path_media = [m for m in all_media if m.file_path is None][:5]
        for m in no_path_media:
            print(f"  - {m.file_id} ({m.mime_type or 'unknown'})")
        print()

        return total, with_paths, without_paths


async def reimport_archives():
    """Re-import archives with updated media matching."""
    async with async_session_maker() as session:
        # Archive location (exact path)
        archive_dir = "/Users/tem/rho/var/media"

        request = ChatGPTIngestRequest(
            home_dir=archive_dir,
            archive_pattern="chat7",
            force_reimport=True  # Force re-import to update media paths
        )

        print(f"🔄 Re-importing archives from {archive_dir}...")
        print(f"   Pattern: {request.archive_pattern}")
        print(f"   Force reimport: True")
        print()

        response = await ingest_archives(session, request)

        print(f"✅ Import complete!")
        print(f"  Archives found: {response.archives_found}")
        print(f"  Conversations processed: {response.conversations_processed}")
        print(f"  Messages imported: {response.messages_imported}")
        print(f"  Media files found: {response.media_files_found}")
        print(f"  Media files matched: {response.media_files_matched}")
        print(f"  Processing time: {response.processing_time_seconds:.2f}s")
        print()

        if response.errors:
            print(f"⚠️  Errors ({len(response.errors)}):")
            for error in response.errors[:5]:
                print(f"  - {error}")
            print()

        return response


async def check_media_after():
    """Check media status after re-import."""
    async with async_session_maker() as session:
        # Count total media
        stmt = select(ChatGPTMedia)
        result = await session.execute(stmt)
        all_media = result.scalars().all()

        total = len(all_media)
        with_paths = sum(1 for m in all_media if m.file_path is not None)
        without_paths = total - with_paths

        print(f"📊 Updated Media Status:")
        print(f"  Total media records: {total}")
        print(f"  With file paths: {with_paths} (+{with_paths - before_with_paths})")
        print(f"  Without file paths: {without_paths}")
        print()

        # Show sample media with paths
        print(f"📁 Sample media with paths:")
        with_path_media = [m for m in all_media if m.file_path is not None][:5]
        for m in with_path_media:
            print(f"  - {m.file_id}")
            print(f"    Path: {m.file_path}")
            print(f"    Archive: {m.source_archive}")
        print()

        return total, with_paths, without_paths


async def main():
    """Main test function."""
    global before_with_paths

    print("=" * 70)
    print("ChatGPT Archive Media Re-Import Test")
    print("=" * 70)
    print()

    # Check before
    before_total, before_with_paths, before_without = await check_media_before()

    # Re-import
    response = await reimport_archives()

    # Check after
    after_total, after_with_paths, after_without = await check_media_after()

    # Summary
    print("=" * 70)
    print("📈 Summary")
    print("=" * 70)
    print(f"Media files matched: {after_with_paths - before_with_paths} new paths")
    print(f"Success rate: {(after_with_paths / after_total * 100):.1f}%")
    print()

    if after_without > 0:
        print(f"ℹ️  {after_without} media files still without paths")
        print(f"   These may not exist in the archives or need additional handling.")
    print()


if __name__ == "__main__":
    asyncio.run(main())
