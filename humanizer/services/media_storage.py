"""
Media Storage Service - Handle file storage strategies

Supports two storage modes:
1. Centralized: Copy files to organized structure (~/humanizer_media/...)
2. In-place: Reference files in original location

Manages file paths, copies, and integrity verification.
"""

import shutil
import hashlib
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime

from humanizer.models.document import StorageStrategy


class MediaStorageService:
    """
    Service for managing document file storage.

    Handles both centralized and in-place storage strategies.

    Centralized structure:
        ~/humanizer_media/
            documents/
                2025/
                    10/
                        {hash[:8]}-{original_name}.pdf
            images/
                2025/
                    10/
                        {hash[:8]}-{original_name}.jpg
            videos/
                2025/
                    10/
                        {hash[:8]}-{original_name}.mp4
    """

    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize storage service.

        Args:
            base_path: Base path for centralized storage
                      (default: ~/humanizer_media)
        """
        if base_path:
            self.base_path = Path(base_path).expanduser()
        else:
            self.base_path = Path.home() / "humanizer_media"

    async def store_file(
        self,
        source_path: str,
        file_type: str,
        strategy: StorageStrategy,
        file_hash: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Store file using specified strategy.

        Args:
            source_path: Original file path
            file_type: File type ('pdf', 'txt', 'md', 'image', 'video')
            strategy: Storage strategy (centralized or in_place)
            file_hash: Pre-computed file hash (optional)

        Returns:
            (stored_path, original_path) tuple

        Raises:
            FileNotFoundError: If source file doesn't exist
            Exception: For storage errors
        """
        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"Source file not found: {source_path}")

        # Compute hash if not provided
        if not file_hash:
            file_hash = self.compute_file_hash(source_path)

        if strategy == StorageStrategy.IN_PLACE:
            # In-place: just return the original path
            return str(source.absolute()), str(source.absolute())

        elif strategy == StorageStrategy.CENTRALIZED:
            # Centralized: copy to organized structure
            dest_path = self._get_centralized_path(source, file_type, file_hash)
            dest_path.parent.mkdir(parents=True, exist_ok=True)

            # Copy file
            try:
                shutil.copy2(source, dest_path)
            except Exception as e:
                raise Exception(f"Failed to copy file to centralized storage: {str(e)}")

            # Verify integrity
            if not self._verify_copy(source, dest_path):
                dest_path.unlink()  # Remove bad copy
                raise Exception("File copy integrity check failed")

            return str(dest_path), str(source.absolute())

        else:
            raise ValueError(f"Unknown storage strategy: {strategy}")

    def _get_centralized_path(
        self,
        source: Path,
        file_type: str,
        file_hash: str
    ) -> Path:
        """
        Get centralized storage path for file.

        Args:
            source: Source file path
            file_type: File type
            file_hash: File hash

        Returns:
            Destination path
        """
        # Determine category
        if file_type in ('pdf', 'txt', 'md', 'docx', 'html'):
            category = 'documents'
        elif file_type in ('image', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'):
            category = 'images'
        elif file_type in ('video', 'mp4', 'mov', 'avi', 'mkv', 'webm'):
            category = 'videos'
        else:
            category = 'other'

        # Create path: category/year/month/hash-filename
        now = datetime.now()
        year = str(now.year)
        month = f"{now.month:02d}"

        # Use first 8 chars of hash + original filename
        hash_prefix = file_hash[:8]
        filename = f"{hash_prefix}-{source.name}"

        dest_path = self.base_path / category / year / month / filename

        return dest_path

    def _verify_copy(self, source: Path, dest: Path) -> bool:
        """
        Verify file was copied correctly.

        Args:
            source: Source file
            dest: Destination file

        Returns:
            True if files match
        """
        source_hash = self.compute_file_hash(str(source))
        dest_hash = self.compute_file_hash(str(dest))
        return source_hash == dest_hash

    @staticmethod
    def compute_file_hash(file_path: str) -> str:
        """
        Compute SHA256 hash of file.

        Args:
            file_path: Path to file

        Returns:
            SHA256 hash (hex string)
        """
        sha256 = hashlib.sha256()

        with open(file_path, 'rb') as f:
            # Read in 64KB chunks
            for chunk in iter(lambda: f.read(65536), b''):
                sha256.update(chunk)

        return sha256.hexdigest()

    async def delete_file(self, file_path: str, strategy: StorageStrategy) -> bool:
        """
        Delete file (only if centralized storage).

        Args:
            file_path: File path
            strategy: Storage strategy used

        Returns:
            True if deleted, False if skipped (in-place)
        """
        if strategy == StorageStrategy.IN_PLACE:
            # Don't delete original files
            return False

        elif strategy == StorageStrategy.CENTRALIZED:
            # Delete centralized copy
            path = Path(file_path)
            if path.exists():
                path.unlink()
                return True
            return False

        return False

    def get_file_path(self, stored_path: str) -> Path:
        """
        Get Path object for stored file.

        Args:
            stored_path: Stored file path

        Returns:
            Path object
        """
        return Path(stored_path)

    def file_exists(self, file_path: str) -> bool:
        """
        Check if file exists at path.

        Args:
            file_path: File path to check

        Returns:
            True if exists
        """
        return Path(file_path).exists()
