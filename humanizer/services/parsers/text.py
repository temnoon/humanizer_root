"""
Text Parser - Parse plain text files with encoding detection

Handles various text encodings and extracts content.
"""

import chardet
from pathlib import Path
from typing import Optional

from .base import BaseParser, ParsedDocument


class TextParser(BaseParser):
    """
    Parser for plain text files.

    Features:
    - Automatic encoding detection (chardet)
    - Handles UTF-8, ASCII, Latin-1, etc.
    - Derives title from filename or first line
    """

    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse a text file.

        Args:
            file_path: Path to .txt file

        Returns:
            ParsedDocument with extracted text

        Raises:
            FileNotFoundError: If file doesn't exist
            Exception: For parsing errors
        """
        # Get file stats
        stats = self._get_file_stats(file_path)
        mime_type = self._detect_mime_type(file_path)

        # Read file with encoding detection
        encoding = self._detect_encoding(file_path)

        try:
            with open(file_path, 'r', encoding=encoding or 'utf-8', errors='replace') as f:
                raw_text = f.read()
        except Exception as e:
            raise Exception(f"Failed to read text file: {str(e)}")

        # Derive title from first non-empty line or filename
        title = self._extract_title(raw_text, file_path)

        return ParsedDocument(
            file_path=file_path,
            title=title,
            raw_text=raw_text,
            mime_type=mime_type or "text/plain",
            encoding=encoding,
            metadata={
                "file_size": stats["size"],
                "line_count": raw_text.count('\n') + 1,
                "char_count": len(raw_text),
            },
        )

    def _detect_encoding(self, file_path: str) -> Optional[str]:
        """
        Detect file encoding using chardet.

        Args:
            file_path: Path to file

        Returns:
            Detected encoding or None
        """
        try:
            with open(file_path, 'rb') as f:
                # Read first 10KB for detection
                raw_data = f.read(10000)
                result = chardet.detect(raw_data)
                return result.get('encoding')
        except Exception:
            return None

    def _extract_title(self, text: str, file_path: str) -> str:
        """
        Extract title from text or filename.

        Args:
            text: File content
            file_path: Original file path

        Returns:
            Title string
        """
        # Try to use first non-empty line
        lines = text.strip().split('\n')
        for line in lines[:10]:  # Check first 10 lines
            line = line.strip()
            if line and len(line) < 200:  # Reasonable title length
                return line

        # Fallback to filename
        return Path(file_path).stem
