"""
Test script for Claude archive import
"""

import asyncio
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from humanizer.services.claude import ingest_archive
from humanizer.models.schemas import ClaudeIngestRequest

# Database connection
DATABASE_URL = "postgresql+asyncpg://localhost/humanizer_dev"
engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def test_import():
    """Test importing Claude archive."""

    print("=" * 80)
    print("Testing Claude Archive Import")
    print("=" * 80)

    # Create ingestion request
    request = ClaudeIngestRequest(
        archive_path="~/Downloads/data-2025-10-25-16-14-18-batch-0000.zip",
        force_reimport=False,
        import_projects=True,
    )

    print(f"\nArchive path: {request.archive_path}")
    print(f"Force reimport: {request.force_reimport}")
    print(f"Import projects: {request.import_projects}")
    print("\nStarting import...")

    # Run import
    async with async_session_maker() as session:
        try:
            response = await ingest_archive(session, request)

            print("\n" + "=" * 80)
            print("Import Complete!")
            print("=" * 80)
            print(f"\nArchives found: {response.archives_found}")
            print(f"Conversations processed: {response.conversations_processed}")
            print(f"  - New: {response.conversations_new}")
            print(f"  - Updated: {response.conversations_updated}")
            print(f"Messages imported: {response.messages_imported}")
            print(f"Projects imported: {response.projects_imported}")
            print(f"Media files found: {response.media_files_found}")
            print(f"Media files matched: {response.media_files_matched}")
            print(f"\nProcessing time: {response.processing_time_seconds:.2f}s")

            if response.errors:
                print(f"\n⚠️  Errors ({len(response.errors)}):")
                for error in response.errors:
                    print(f"  - {error}")
            else:
                print("\n✅ No errors!")

            print("\n" + "=" * 80)

        except Exception as e:
            print(f"\n❌ Import failed: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(test_import())
