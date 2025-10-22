"""
PDF Parser - Parse PDF files with text and image extraction

Uses PyPDF2 for text extraction and pdfplumber as fallback.
Extracts embedded images when possible.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import tempfile
import logging

from .base import BaseParser, ParsedDocument

logger = logging.getLogger(__name__)


class PDFParser(BaseParser):
    """
    Parser for PDF files.

    Features:
    - Text extraction (PyPDF2 primary, pdfplumber fallback)
    - Image extraction from PDF pages
    - Metadata extraction (title, author, page count)
    - Table of contents extraction

    Note: Requires PyPDF2 and pdfplumber packages
    """

    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse a PDF file.

        Args:
            file_path: Path to .pdf file

        Returns:
            ParsedDocument with extracted content

        Raises:
            FileNotFoundError: If file doesn't exist
            Exception: For parsing errors
        """
        # Get file stats
        stats = self._get_file_stats(file_path)
        mime_type = self._detect_mime_type(file_path)

        try:
            import PyPDF2
        except ImportError:
            raise Exception("PyPDF2 not installed. Run: pip install PyPDF2")

        # Parse PDF
        try:
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)

                # Extract metadata
                metadata = self._extract_metadata(reader)
                page_count = len(reader.pages)

                # Extract text from all pages
                raw_text = self._extract_text(reader)

                # Extract images (if available)
                images = self._extract_images(reader, file_path)

                # Get title from metadata or filename
                title = metadata.get('title') or Path(file_path).stem
                author = metadata.get('author')

        except Exception as e:
            # Fallback to pdfplumber if PyPDF2 fails
            try:
                raw_text, page_count, images = await self._parse_with_pdfplumber(file_path)
                title = Path(file_path).stem
                author = None
                metadata = {}
            except Exception as fallback_error:
                raise Exception(f"Failed to parse PDF with both PyPDF2 and pdfplumber: {str(e)}, {str(fallback_error)}")

        return ParsedDocument(
            file_path=file_path,
            title=title,
            author=author,
            raw_text=raw_text,
            mime_type=mime_type or "application/pdf",
            page_count=page_count,
            images=images,
            metadata={
                **metadata,
                "file_size": stats["size"],
                "parser": "PyPDF2",
            },
        )

    def _extract_metadata(self, reader) -> Dict[str, Any]:
        """
        Extract PDF metadata.

        Args:
            reader: PyPDF2 PdfReader

        Returns:
            Dict of metadata
        """
        metadata = {}

        if hasattr(reader, 'metadata') and reader.metadata:
            pdf_meta = reader.metadata

            # Extract common fields
            if '/Title' in pdf_meta:
                metadata['title'] = pdf_meta['/Title']
            if '/Author' in pdf_meta:
                metadata['author'] = pdf_meta['/Author']
            if '/Subject' in pdf_meta:
                metadata['subject'] = pdf_meta['/Subject']
            if '/Creator' in pdf_meta:
                metadata['creator'] = pdf_meta['/Creator']
            if '/Producer' in pdf_meta:
                metadata['producer'] = pdf_meta['/Producer']
            if '/CreationDate' in pdf_meta:
                metadata['creation_date'] = pdf_meta['/CreationDate']

        return metadata

    def _extract_text(self, reader) -> str:
        """
        Extract text from all PDF pages.

        Args:
            reader: PyPDF2 PdfReader

        Returns:
            Combined text from all pages
        """
        text_parts = []

        for page_num, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")
            except Exception as e:
                # Skip pages that fail to extract
                # TECHNICAL DEBT: See TECHNICAL_DEBT.md #DEBT-002
                logger.warning(f"Failed to extract text from page {page_num + 1}: {e}")
                continue

        return '\n\n'.join(text_parts)

    def _extract_images(self, reader, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract embedded images from PDF.

        Args:
            reader: PyPDF2 PdfReader
            file_path: Original PDF path

        Returns:
            List of image info dicts
        """
        images = []

        # Note: Image extraction in PyPDF2 is complex and may not work for all PDFs
        # This is a simplified implementation
        try:
            for page_num, page in enumerate(reader.pages):
                if '/XObject' in page['/Resources']:
                    xObject = page['/Resources']['/XObject'].get_object()

                    for obj_name in xObject:
                        obj = xObject[obj_name]

                        if obj['/Subtype'] == '/Image':
                            images.append({
                                'page': page_num + 1,
                                'name': obj_name,
                                'width': obj.get('/Width'),
                                'height': obj.get('/Height'),
                            })
        except Exception as e:
            # Image extraction failed, continue without images
            # TECHNICAL DEBT: See TECHNICAL_DEBT.md #DEBT-003
            logger.warning(f"Failed to extract images from {file_path}: {e}")
            pass

        return images

    async def _parse_with_pdfplumber(self, file_path: str) -> tuple[str, int, list]:
        """
        Fallback parser using pdfplumber.

        Args:
            file_path: Path to PDF

        Returns:
            (text, page_count, images)
        """
        try:
            import pdfplumber
        except ImportError:
            raise Exception("pdfplumber not installed. Run: pip install pdfplumber")

        text_parts = []
        images = []

        with pdfplumber.open(file_path) as pdf:
            page_count = len(pdf.pages)

            for page_num, page in enumerate(pdf.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")

                    # Try to extract images
                    page_images = page.images
                    for img in page_images:
                        images.append({
                            'page': page_num + 1,
                            'width': img.get('width'),
                            'height': img.get('height'),
                        })
                except Exception as e:
                    logger.warning(f"Failed to extract images from page {page_num + 1} (pdfplumber): {e}")
                    continue

        text = '\n\n'.join(text_parts)
        return text, page_count, images
