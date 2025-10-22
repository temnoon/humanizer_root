"""
Base Parser - Abstract interface for all file parsers

All parsers must implement the parse() method and return a ParsedDocument.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any
from pathlib import Path


@dataclass
class ParsedDocument:
    """
    Result of parsing a document.

    Contains all extracted information from the file.

    Attributes:
        file_path: Original file path
        title: Extracted or derived title
        author: Extracted author (if available)
        raw_text: Full extracted text content
        metadata: File-specific metadata
        page_count: Number of pages (for PDFs)
        images: List of extracted images (paths or data)
        mime_type: Detected MIME type
        encoding: Text encoding (for text files)
        language: Detected language (optional)
        created_date: File creation date from metadata
        modified_date: File modification date
        width: Image width (for images)
        height: Image height (for images)
    """
    file_path: str
    title: Optional[str] = None
    author: Optional[str] = None
    raw_text: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: Optional[int] = None
    images: List[Dict[str, Any]] = field(default_factory=list)
    mime_type: Optional[str] = None
    encoding: Optional[str] = None
    language: Optional[str] = None
    created_date: Optional[str] = None
    modified_date: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class BaseParser(ABC):
    """
    Abstract base class for file parsers.

    All parsers must implement the parse() method.

    Usage:
        parser = PDFParser()
        result = await parser.parse("/path/to/file.pdf")
    """

    @abstractmethod
    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse a file and extract content.

        Args:
            file_path: Path to file to parse

        Returns:
            ParsedDocument with extracted content

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file format is invalid
            Exception: For parsing errors
        """
        pass

    def _get_file_stats(self, file_path: str) -> Dict[str, Any]:
        """
        Get file statistics from filesystem.

        Args:
            file_path: Path to file

        Returns:
            Dict with file stats (size, modified time, etc.)
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        stat = path.stat()
        return {
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "created": stat.st_ctime,
        }

    def _detect_mime_type(self, file_path: str) -> Optional[str]:
        """
        Detect MIME type from file.

        Args:
            file_path: Path to file

        Returns:
            MIME type or None
        """
        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_path)
        return mime_type
