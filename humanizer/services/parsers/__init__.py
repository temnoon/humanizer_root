"""
File Parsers Package

Parsers for various file types:
- PDF: PDFParser (PyPDF2 + pdfplumber)
- Text: TextParser (encoding detection)
- Markdown: MarkdownParser (frontmatter + structure)
- Image: ImageParser (PIL/Pillow metadata)
"""

from .base import BaseParser, ParsedDocument
from .pdf import PDFParser
from .text import TextParser
from .markdown import MarkdownParser
from .image import ImageParser

__all__ = [
    "BaseParser",
    "ParsedDocument",
    "PDFParser",
    "TextParser",
    "MarkdownParser",
    "ImageParser",
]
