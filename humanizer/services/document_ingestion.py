"""
Document Ingestion Service - Main orchestrator for file ingestion

Handles the complete ingestion pipeline:
1. File discovery (glob patterns, recursive search)
2. Duplicate detection (SHA256 hash)
3. File parsing (delegates to parsers)
4. Storage management (centralized vs in-place)
5. Content chunking (large documents)
6. Database persistence

Follows the ChatGPT archive ingestion pattern.
"""

import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.document import (
    Document,
    DocumentChunk,
    DocumentMedia,
    IngestionBatch,
    StorageStrategy,
    EmbeddingStatus,
)
from humanizer.services.parsers import (
    BaseParser,
    PDFParser,
    TextParser,
    MarkdownParser,
    ImageParser,
)
from humanizer.services.media_storage import MediaStorageService
from humanizer.services.document_chunker import DocumentChunker


class DocumentIngestionService:
    """
    Service for ingesting documents into the system.

    Supports:
    - Multiple file types (PDF, TXT, MD, images)
    - Both storage strategies (centralized, in-place)
    - Duplicate detection
    - Batch tracking
    - Error handling
    """

    def __init__(self):
        """Initialize ingestion service with parsers and services."""
        # Initialize parsers
        self.parsers: Dict[str, BaseParser] = {
            'pdf': PDFParser(),
            'txt': TextParser(),
            'md': MarkdownParser(),
            'markdown': MarkdownParser(),
            'image': ImageParser(),
            'jpg': ImageParser(),
            'jpeg': ImageParser(),
            'png': ImageParser(),
            'gif': ImageParser(),
            'webp': ImageParser(),
            'bmp': ImageParser(),
            'tiff': ImageParser(),
        }

        # Initialize services
        self.storage_service = MediaStorageService()
        self.chunker = DocumentChunker(chunk_size=1000, overlap=100)

    async def ingest_directory(
        self,
        session: AsyncSession,
        source_directory: str,
        file_types: Optional[List[str]] = None,
        storage_strategy: StorageStrategy = StorageStrategy.IN_PLACE,
        centralized_base_path: Optional[str] = None,
        recursive: bool = True,
        force_reimport: bool = False,
        generate_embeddings: bool = True,
    ) -> IngestionBatch:
        """
        Ingest all files from a directory.

        Process:
        1. Discover files matching types
        2. Check for duplicates (by file hash)
        3. Parse each file
        4. Store files (centralized or in-place)
        5. Chunk large documents
        6. Save to database
        7. Queue embeddings (background)

        Args:
            session: Database session
            source_directory: Path to directory
            file_types: Filter by types (e.g., ['pdf', 'txt', 'image'])
            storage_strategy: How to store files
            centralized_base_path: Base path for centralized storage
            recursive: Search subdirectories
            force_reimport: Re-import existing files
            generate_embeddings: Queue for embedding generation

        Returns:
            IngestionBatch with statistics
        """
        start_time = datetime.utcnow()

        # Update storage service base path if provided
        if centralized_base_path:
            self.storage_service.base_path = Path(centralized_base_path).expanduser()

        # Create batch record
        batch = IngestionBatch(
            id=uuid4(),
            source_directory=source_directory,
            batch_type='mixed' if not file_types else ','.join(file_types),
            storage_strategy=storage_strategy,
            centralized_base_path=centralized_base_path,
            total_files=0,
            successful=0,
            failed=0,
            skipped=0,
            started_at=start_time,
            errors=[],
            config_snapshot={
                'file_types': file_types,
                'recursive': recursive,
                'force_reimport': force_reimport,
                'generate_embeddings': generate_embeddings,
            },
        )

        # Add batch to session and flush BEFORE processing files
        # This ensures batch.id exists in DB for foreign key constraints
        session.add(batch)
        await session.flush()

        # Discover files
        files = self._discover_files(source_directory, file_types, recursive)
        batch.total_files = len(files)

        # Process each file
        for file_path in files:
            try:
                await self._ingest_file_internal(
                    session=session,
                    file_path=file_path,
                    batch_id=batch.id,
                    storage_strategy=storage_strategy,
                    force_reimport=force_reimport,
                    generate_embeddings=generate_embeddings,
                )
                batch.successful += 1

            except Exception as e:
                batch.failed += 1
                batch.errors.append({
                    'file': file_path,
                    'error': str(e),
                })

        # Complete batch
        batch.completed_at = datetime.utcnow()
        batch.processing_time_ms = int(
            (batch.completed_at - start_time).total_seconds() * 1000
        )

        # Commit final batch state (batch already in session from earlier flush)
        await session.commit()

        return batch

    async def ingest_file(
        self,
        session: AsyncSession,
        file_path: str,
        storage_strategy: StorageStrategy = StorageStrategy.IN_PLACE,
        force_reimport: bool = False,
        generate_embeddings: bool = True,
    ) -> Document:
        """
        Ingest a single file.

        Args:
            session: Database session
            file_path: Path to file
            storage_strategy: How to store file
            force_reimport: Re-import if exists
            generate_embeddings: Queue for embedding generation

        Returns:
            Document ORM model
        """
        return await self._ingest_file_internal(
            session=session,
            file_path=file_path,
            batch_id=None,
            storage_strategy=storage_strategy,
            force_reimport=force_reimport,
            generate_embeddings=generate_embeddings,
        )

    async def _ingest_file_internal(
        self,
        session: AsyncSession,
        file_path: str,
        batch_id: Optional[UUID],
        storage_strategy: StorageStrategy,
        force_reimport: bool,
        generate_embeddings: bool,
    ) -> Document:
        """
        Internal method to ingest a file.

        Args:
            session: Database session
            file_path: File path
            batch_id: Batch ID (if part of batch)
            storage_strategy: Storage strategy
            force_reimport: Force reimport
            generate_embeddings: Generate embeddings

        Returns:
            Document model

        Raises:
            FileNotFoundError: If file doesn't exist
            Exception: For ingestion errors
        """
        # Compute file hash
        file_hash = MediaStorageService.compute_file_hash(file_path)

        # Check for existing document
        if not force_reimport:
            stmt = select(Document).where(Document.file_hash == file_hash)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                raise Exception(f"Document already exists (hash: {file_hash[:8]}...)")

        # Detect file type
        file_type = self._detect_file_type(file_path)

        # Parse file
        parser = self.parsers.get(file_type)
        if not parser:
            raise Exception(f"No parser available for file type: {file_type}")

        parsed = await parser.parse(file_path)

        # Store file
        stored_path, original_path = await self.storage_service.store_file(
            source_path=file_path,
            file_type=file_type,
            strategy=storage_strategy,
            file_hash=file_hash,
        )

        # Get file stats
        file_path_obj = Path(file_path)
        file_stat = file_path_obj.stat()

        # Create document record
        document = Document(
            id=uuid4(),
            filename=file_path_obj.name,
            file_path=stored_path,
            original_path=original_path if storage_strategy == StorageStrategy.CENTRALIZED else None,
            file_size=file_stat.st_size,
            file_type=file_type,
            mime_type=parsed.mime_type,
            file_hash=file_hash,
            storage_strategy=storage_strategy,
            title=parsed.title,
            author=parsed.author,
            raw_text=parsed.raw_text,
            file_modified_at=datetime.fromtimestamp(file_stat.st_mtime),
            source_directory=str(file_path_obj.parent),
            ingestion_batch_id=batch_id,
            embedding_status=EmbeddingStatus.PENDING if generate_embeddings else EmbeddingStatus.COMPLETED,
            custom_metadata=parsed.metadata,
        )

        session.add(document)
        await session.flush()  # Get document ID

        # Create chunks for text content
        if parsed.raw_text and len(parsed.raw_text) > 500:
            chunks = await self._create_chunks(
                document_id=document.id,
                text=parsed.raw_text,
                page_count=parsed.page_count,
                generate_embeddings=generate_embeddings,
            )

            for chunk in chunks:
                session.add(chunk)

        # Create media records for extracted images
        if parsed.images:
            for img_data in parsed.images:
                media = DocumentMedia(
                    id=uuid4(),
                    document_id=document.id,
                    media_type='image',
                    file_path=img_data.get('path', ''),
                    page_number=img_data.get('page'),
                    width=img_data.get('width'),
                    height=img_data.get('height'),
                    custom_metadata=img_data,
                )
                session.add(media)

        # Create media record for standalone images
        if file_type in ('image', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'):
            media = DocumentMedia(
                id=uuid4(),
                document_id=document.id,
                media_type='image',
                file_path=stored_path,
                width=parsed.width,
                height=parsed.height,
                custom_metadata={
                    'is_primary': True,
                    'exif': parsed.metadata.get('exif', {}),
                },
            )
            session.add(media)

        await session.commit()

        return document

    def _discover_files(
        self,
        directory: str,
        file_types: Optional[List[str]],
        recursive: bool,
    ) -> List[str]:
        """
        Discover files in directory.

        Args:
            directory: Directory to search
            file_types: File types to include
            recursive: Search recursively

        Returns:
            List of file paths
        """
        dir_path = Path(directory).expanduser()
        if not dir_path.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")

        files = []

        # Build glob patterns
        if file_types:
            extensions = []
            for ft in file_types:
                if ft == 'image':
                    extensions.extend(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'])
                else:
                    extensions.append(ft)

            patterns = [f"*.{ext}" for ext in extensions]
        else:
            patterns = ["*.*"]

        # Search for files
        for pattern in patterns:
            if recursive:
                found = dir_path.rglob(pattern)
            else:
                found = dir_path.glob(pattern)

            for file_path in found:
                if file_path.is_file():
                    files.append(str(file_path))

        return sorted(set(files))  # Remove duplicates and sort

    def _detect_file_type(self, file_path: str) -> str:
        """
        Detect file type from extension.

        Args:
            file_path: File path

        Returns:
            File type string
        """
        path = Path(file_path)
        ext = path.suffix.lower().lstrip('.')

        # Map extensions to types
        type_map = {
            'pdf': 'pdf',
            'txt': 'txt',
            'md': 'md',
            'markdown': 'markdown',
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'webp': 'image',
            'bmp': 'image',
            'tiff': 'image',
        }

        return type_map.get(ext, ext)

    async def _create_chunks(
        self,
        document_id: UUID,
        text: str,
        page_count: Optional[int],
        generate_embeddings: bool,
    ) -> List[DocumentChunk]:
        """
        Create document chunks.

        Args:
            document_id: Parent document ID
            text: Full text
            page_count: Number of pages
            generate_embeddings: Queue for embeddings

        Returns:
            List of DocumentChunk models
        """
        # Chunk text
        chunk_data_list = self.chunker.chunk(text)

        # Create chunk models
        chunks = []
        for chunk_data in chunk_data_list:
            chunk = DocumentChunk(
                id=uuid4(),
                document_id=document_id,
                chunk_index=chunk_data.index,
                chunk_text=chunk_data.text,
                chunk_size=chunk_data.size,
                start_page=chunk_data.page_start,
                end_page=chunk_data.page_end,
                start_offset=chunk_data.start_offset,
                end_offset=chunk_data.end_offset,
                embedding_status=EmbeddingStatus.PENDING if generate_embeddings else EmbeddingStatus.COMPLETED,
            )
            chunks.append(chunk)

        return chunks
