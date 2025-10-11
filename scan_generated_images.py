"""
Scan for DALL-E generated and sediment images in subdirectories,
then update the extraction to include them.
"""

import asyncio
from pathlib import Path
from typing import Dict, List
from sqlalchemy import text
from humanizer.database.connection import get_session

CHAT7_PATH = Path("/Users/tem/rho/var/media/chat7")
DALLE_PATH = CHAT7_PATH / "dalle-generations"


async def scan_dalle_images() -> Dict[str, List[str]]:
    """Scan dalle-generations folder and group by conversation."""
    print("🔍 Scanning dalle-generations folder...")

    dalle_files = {}

    if DALLE_PATH.exists():
        for file in DALLE_PATH.glob("file-*.webp"):
            file_id = file.stem.split('-')[1]  # Extract ID from file-{ID}-{UUID}.webp
            full_file_id = f"file-{file_id}"

            # Try to find which conversation this belongs to
            # DALL-E images are usually orphaned, so we'll need to match by timestamp or conversation context
            dalle_files[full_file_id] = str(file)

    print(f"✅ Found {len(dalle_files)} DALL-E images")
    return dalle_files


async def scan_sediment_images() -> Dict[str, List[str]]:
    """Scan user-* folders for sediment-style images."""
    print("🔍 Scanning sediment (user-*) folders...")

    sediment_files = {}

    for user_folder in CHAT7_PATH.glob("user-*"):
        if user_folder.is_dir():
            for file in user_folder.rglob("file_*.png"):
                # Sediment format: file_{HASH}-{UUID}.png
                file_id_part = file.stem.split('-')[0]  # file_{HASH}
                # Convert file_ to file-
                file_id = file_id_part.replace('file_', 'file-')

                sediment_files[file_id] = str(file)

    print(f"✅ Found {len(sediment_files)} sediment images")
    return sediment_files


async def find_generated_images_for_conversations() -> Dict[str, List[Dict]]:
    """
    Find which DALL-E/sediment images belong to which conversations.
    Match by looking at conversation UUID in message timestamps.
    """
    print("\n🔗 Matching generated images to conversations...")

    dalle_files = await scan_dalle_images()
    sediment_files = await scan_sediment_images()

    # Group by conversation
    conversation_images = {}

    async for session in get_session():
        try:
            # Get all g-FmQp1Tm1G conversations
            query = text("""
                SELECT DISTINCT
                    c.uuid,
                    c.title,
                    c.created_at,
                    c.updated_at
                FROM chatgpt_conversations c
                WHERE c.custom_metadata->>'gizmo_id' = 'g-FmQp1Tm1G'
                ORDER BY c.updated_at DESC
            """)

            result = await session.execute(query)
            rows = result.fetchall()

            print(f"📊 Found {len(rows)} conversations")
            print(f"📊 Total DALL-E images: {len(dalle_files)}")
            print(f"📊 Total sediment images: {len(sediment_files)}")

            # For now, create a mapping file
            output = []
            output.append("# Generated Images Mapping\n")
            output.append(f"## DALL-E Images ({len(dalle_files)})\n")
            for file_id, path in list(dalle_files.items())[:20]:
                output.append(f"- `{file_id}`: {path}\n")

            output.append(f"\n## Sediment Images ({len(sediment_files)})\n")
            for file_id, path in list(sediment_files.items())[:20]:
                output.append(f"- `{file_id}`: {path}\n")

            # Write mapping file
            mapping_file = "/Users/tem/humanizer_root/generated_images_map.md"
            with open(mapping_file, 'w') as f:
                f.writelines(output)

            print(f"\n✅ Mapping file created: {mapping_file}")

            return {
                'dalle': dalle_files,
                'sediment': sediment_files,
                'conversations': len(rows)
            }

        finally:
            await session.close()


async def main():
    print("=" * 60)
    print("Generated Images Scanner")
    print("=" * 60)

    result = await find_generated_images_for_conversations()

    print("\n" + "=" * 60)
    print("✨ Scan complete!")
    print(f"📊 Summary:")
    print(f"   - DALL-E images: {len(result['dalle'])}")
    print(f"   - Sediment images: {len(result['sediment'])}")
    print(f"   - Conversations: {result['conversations']}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
