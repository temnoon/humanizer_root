"""
Get ChatGPT archive statistics directly from database
"""

import asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from humanizer.config import settings
from humanizer.models.chatgpt import (
    ChatGPTConversation,
    ChatGPTMessage,
    ChatGPTMedia,
    ChatGPTProvenance,
)


async def get_stats():
    """Get archive statistics."""
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Count conversations
        stmt = select(func.count()).select_from(ChatGPTConversation)
        result = await session.execute(stmt)
        total_conversations = result.scalar()

        # Count messages
        stmt = select(func.count()).select_from(ChatGPTMessage)
        result = await session.execute(stmt)
        total_messages = result.scalar()

        # Count media files
        stmt = select(func.count()).select_from(ChatGPTMedia)
        result = await session.execute(stmt)
        total_media = result.scalar()

        # Count media with file paths
        stmt = select(func.count()).select_from(ChatGPTMedia).where(
            ChatGPTMedia.file_path.isnot(None)
        )
        result = await session.execute(stmt)
        media_with_paths = result.scalar()

        # Get unique archives
        stmt = select(ChatGPTProvenance.archive_name).distinct()
        result = await session.execute(stmt)
        archives = sorted([row[0] for row in result.all()])

        # Date range
        stmt = select(
            func.min(ChatGPTMessage.created_at),
            func.max(ChatGPTMessage.created_at)
        ).select_from(ChatGPTMessage)
        result = await session.execute(stmt)
        earliest, latest = result.one()

        print("=" * 60)
        print("📊 CHATGPT ARCHIVE STATISTICS")
        print("=" * 60)
        print(f"Total conversations: {total_conversations:,}")
        print(f"Total messages: {total_messages:,}")
        print(f"Total media files: {total_media:,}")
        print(f"Media with file paths: {media_with_paths:,} ({media_with_paths/total_media*100:.1f}%)")
        print(f"\nArchives ingested: {', '.join(archives)}")
        print(f"\nDate range:")
        print(f"  Earliest: {earliest}")
        print(f"  Latest: {latest}")


if __name__ == "__main__":
    asyncio.run(get_stats())
