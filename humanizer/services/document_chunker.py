"""
Document Chunker - Intelligent text chunking for large documents

Chunks documents while respecting natural boundaries:
1. Paragraphs (preferred)
2. Sentences (if paragraph too large)
3. Hard split (if sentence too large)

Adds overlap between chunks for context preservation.
"""

import re
from typing import List
from dataclasses import dataclass


@dataclass
class ChunkData:
    """
    Data for a single chunk.

    Attributes:
        text: Chunk text
        index: Chunk index in document
        start_offset: Character offset in document
        end_offset: Character offset in document
        size: Character count
        page_start: Starting page (if known)
        page_end: Ending page (if known)
    """
    text: str
    index: int
    start_offset: int
    end_offset: int
    size: int
    page_start: int = None
    page_end: int = None


class DocumentChunker:
    """
    Service for chunking large documents intelligently.

    Strategy:
    1. Try to chunk by paragraphs (double newline)
    2. If paragraph too large, chunk by sentences
    3. If sentence too large, hard split
    4. Add overlap between chunks for context
    """

    def __init__(
        self,
        chunk_size: int = 1000,
        overlap: int = 100,
        respect_paragraphs: bool = True,
        respect_sentences: bool = True,
    ):
        """
        Initialize chunker.

        Args:
            chunk_size: Target chunk size in characters
            overlap: Overlap between chunks in characters
            respect_paragraphs: Try to chunk on paragraph boundaries
            respect_sentences: Try to chunk on sentence boundaries
        """
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.respect_paragraphs = respect_paragraphs
        self.respect_sentences = respect_sentences

    def chunk(self, text: str, page_info: List[tuple] = None) -> List[ChunkData]:
        """
        Chunk document text intelligently.

        Args:
            text: Full document text
            page_info: Optional list of (page_num, start_offset, end_offset) tuples

        Returns:
            List of ChunkData objects
        """
        if not text or not text.strip():
            return []

        chunks = []

        if self.respect_paragraphs:
            # Try paragraph-based chunking
            paragraphs = self._split_paragraphs(text)
            chunks = self._chunk_by_sections(paragraphs, text)
        else:
            # Direct chunking
            chunks = self._chunk_by_size(text)

        # Add page information if available
        if page_info:
            chunks = self._add_page_info(chunks, page_info)

        return chunks

    def _split_paragraphs(self, text: str) -> List[str]:
        """
        Split text into paragraphs.

        Args:
            text: Full text

        Returns:
            List of paragraphs
        """
        # Split on double newlines
        paragraphs = re.split(r'\n\s*\n', text)
        return [p.strip() for p in paragraphs if p.strip()]

    def _chunk_by_sections(self, sections: List[str], full_text: str) -> List[ChunkData]:
        """
        Chunk text by combining sections (paragraphs).

        Args:
            sections: List of text sections (paragraphs)
            full_text: Original full text

        Returns:
            List of ChunkData
        """
        chunks = []
        current_chunk = []
        current_size = 0
        chunk_index = 0

        for section in sections:
            section_size = len(section)

            # If section alone exceeds chunk_size, split it further
            if section_size > self.chunk_size * 1.5:
                # Save current chunk if any
                if current_chunk:
                    chunk_text = '\n\n'.join(current_chunk)
                    chunk_data = self._create_chunk_data(
                        chunk_text, chunk_index, full_text
                    )
                    chunks.append(chunk_data)
                    chunk_index += 1
                    current_chunk = []
                    current_size = 0

                # Split large section
                if self.respect_sentences:
                    sub_chunks = self._chunk_by_sentences(section)
                else:
                    sub_chunks = self._chunk_by_size(section)

                for sub_chunk in sub_chunks:
                    chunks.append(
                        self._create_chunk_data(sub_chunk, chunk_index, full_text)
                    )
                    chunk_index += 1

            # If adding section exceeds chunk_size, start new chunk
            elif current_size + section_size > self.chunk_size and current_chunk:
                # Add overlap from current chunk
                chunk_text = '\n\n'.join(current_chunk)
                chunk_data = self._create_chunk_data(
                    chunk_text, chunk_index, full_text
                )
                chunks.append(chunk_data)
                chunk_index += 1

                # Start new chunk with overlap
                if self.overlap > 0 and current_chunk:
                    # Take last section(s) for overlap
                    overlap_text = current_chunk[-1]
                    if len(overlap_text) < self.overlap and len(current_chunk) > 1:
                        overlap_text = '\n\n'.join(current_chunk[-2:])

                    current_chunk = [overlap_text, section]
                    current_size = len(overlap_text) + section_size
                else:
                    current_chunk = [section]
                    current_size = section_size
            else:
                # Add to current chunk
                current_chunk.append(section)
                current_size += section_size

        # Add final chunk
        if current_chunk:
            chunk_text = '\n\n'.join(current_chunk)
            chunk_data = self._create_chunk_data(chunk_text, chunk_index, full_text)
            chunks.append(chunk_data)

        return chunks

    def _chunk_by_sentences(self, text: str) -> List[str]:
        """
        Chunk text by sentences.

        Args:
            text: Text to chunk

        Returns:
            List of text chunks
        """
        # Split on sentence boundaries
        sentences = re.split(r'(?<=[.!?])\s+', text)

        chunks = []
        current_chunk = []
        current_size = 0

        for sentence in sentences:
            sentence_size = len(sentence)

            # If sentence alone exceeds chunk_size, hard split
            if sentence_size > self.chunk_size * 1.5:
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_size = 0

                # Hard split long sentence
                hard_chunks = self._hard_split(sentence, self.chunk_size)
                chunks.extend(hard_chunks)

            elif current_size + sentence_size > self.chunk_size and current_chunk:
                # Start new chunk
                chunks.append(' '.join(current_chunk))

                # Add overlap
                if self.overlap > 0 and current_chunk:
                    overlap = current_chunk[-1] if len(current_chunk[-1]) < self.overlap else current_chunk[-1][-self.overlap:]
                    current_chunk = [overlap, sentence]
                    current_size = len(overlap) + sentence_size
                else:
                    current_chunk = [sentence]
                    current_size = sentence_size
            else:
                current_chunk.append(sentence)
                current_size += sentence_size

        if current_chunk:
            chunks.append(' '.join(current_chunk))

        return chunks

    def _chunk_by_size(self, text: str) -> List[ChunkData]:
        """
        Hard chunk by size (fallback).

        Args:
            text: Text to chunk

        Returns:
            List of ChunkData
        """
        chunks = []
        chunk_index = 0
        start = 0

        while start < len(text):
            end = start + self.chunk_size
            chunk_text = text[start:end]

            chunk_data = ChunkData(
                text=chunk_text,
                index=chunk_index,
                start_offset=start,
                end_offset=min(end, len(text)),
                size=len(chunk_text),
            )
            chunks.append(chunk_data)

            # Move forward with overlap
            start += (self.chunk_size - self.overlap)
            chunk_index += 1

        return chunks

    def _hard_split(self, text: str, size: int) -> List[str]:
        """
        Hard split text at size boundaries.

        Args:
            text: Text to split
            size: Split size

        Returns:
            List of text chunks
        """
        return [text[i:i+size] for i in range(0, len(text), size)]

    def _create_chunk_data(
        self,
        chunk_text: str,
        index: int,
        full_text: str
    ) -> ChunkData:
        """
        Create ChunkData from chunk text.

        Args:
            chunk_text: Chunk text
            index: Chunk index
            full_text: Original full text

        Returns:
            ChunkData object
        """
        # Find offsets in full text
        start_offset = full_text.find(chunk_text)
        if start_offset == -1:
            start_offset = 0

        end_offset = start_offset + len(chunk_text)

        return ChunkData(
            text=chunk_text,
            index=index,
            start_offset=start_offset,
            end_offset=end_offset,
            size=len(chunk_text),
        )

    def _add_page_info(
        self,
        chunks: List[ChunkData],
        page_info: List[tuple]
    ) -> List[ChunkData]:
        """
        Add page information to chunks.

        Args:
            chunks: List of ChunkData
            page_info: List of (page_num, start_offset, end_offset)

        Returns:
            Updated chunks with page info
        """
        for chunk in chunks:
            # Find which pages this chunk spans
            chunk_start = chunk.start_offset
            chunk_end = chunk.end_offset

            pages_in_chunk = set()
            for page_num, page_start, page_end in page_info:
                # Check if chunk overlaps with page
                if not (chunk_end <= page_start or chunk_start >= page_end):
                    pages_in_chunk.add(page_num)

            if pages_in_chunk:
                chunk.page_start = min(pages_in_chunk)
                chunk.page_end = max(pages_in_chunk)

        return chunks
