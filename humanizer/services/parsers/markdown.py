"""
Markdown Parser - Parse Markdown files with frontmatter support

Extracts:
- Frontmatter metadata (YAML)
- Plain text content (stripped of markdown syntax)
- Structure (headings for chunking)
"""

import re
from pathlib import Path
from typing import Optional, Dict, Any

from .base import BaseParser, ParsedDocument


class MarkdownParser(BaseParser):
    """
    Parser for Markdown files.

    Features:
    - YAML frontmatter extraction
    - Plain text conversion
    - Heading structure preservation
    - Link extraction
    """

    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse a Markdown file.

        Args:
            file_path: Path to .md file

        Returns:
            ParsedDocument with extracted content

        Raises:
            FileNotFoundError: If file doesn't exist
            Exception: For parsing errors
        """
        # Get file stats
        stats = self._get_file_stats(file_path)
        mime_type = self._detect_mime_type(file_path)

        # Read file
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception as e:
            raise Exception(f"Failed to read markdown file: {str(e)}")

        # Extract frontmatter
        frontmatter, body = self._extract_frontmatter(content)

        # Extract title from frontmatter or first heading or filename
        title = self._extract_title(frontmatter, body, file_path)

        # Extract author from frontmatter
        author = frontmatter.get('author')

        # Convert markdown to plain text
        plain_text = self._markdown_to_text(body)

        # Extract headings for structure
        headings = self._extract_headings(body)

        # Extract links
        links = self._extract_links(body)

        metadata = {
            "file_size": stats["size"],
            "frontmatter": frontmatter,
            "headings": headings,
            "links": links,
            "markdown_length": len(body),
        }

        return ParsedDocument(
            file_path=file_path,
            title=title,
            author=author,
            raw_text=plain_text,
            mime_type=mime_type or "text/markdown",
            encoding="utf-8",
            metadata=metadata,
        )

    def _extract_frontmatter(self, content: str) -> tuple[Dict[str, Any], str]:
        """
        Extract YAML frontmatter from markdown.

        Args:
            content: Full markdown content

        Returns:
            (frontmatter_dict, body_without_frontmatter)
        """
        # Check for YAML frontmatter (--- ... ---)
        frontmatter_pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(frontmatter_pattern, content, re.DOTALL)

        if match:
            yaml_content = match.group(1)
            body = match.group(2)

            # Parse YAML (simple key: value parsing)
            frontmatter = {}
            for line in yaml_content.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    frontmatter[key.strip()] = value.strip()

            return frontmatter, body

        return {}, content

    def _extract_title(self, frontmatter: Dict, body: str, file_path: str) -> str:
        """
        Extract title from frontmatter, first heading, or filename.

        Args:
            frontmatter: Extracted frontmatter
            body: Markdown body
            file_path: File path

        Returns:
            Title string
        """
        # Try frontmatter first
        if 'title' in frontmatter:
            return frontmatter['title']

        # Try first heading
        heading_match = re.search(r'^#+\s+(.+)$', body, re.MULTILINE)
        if heading_match:
            return heading_match.group(1).strip()

        # Fallback to filename
        return Path(file_path).stem

    def _markdown_to_text(self, markdown: str) -> str:
        """
        Convert markdown to plain text.

        Args:
            markdown: Markdown content

        Returns:
            Plain text
        """
        text = markdown

        # Remove code blocks
        text = re.sub(r'```[\s\S]*?```', '', text)
        text = re.sub(r'`[^`]+`', '', text)

        # Remove links but keep text
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

        # Remove images
        text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)

        # Remove emphasis markers
        text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^\*]+)\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)
        text = re.sub(r'_([^_]+)_', r'\1', text)

        # Remove headings markers
        text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)

        # Remove horizontal rules
        text = re.sub(r'^[-*_]{3,}$', '', text, flags=re.MULTILINE)

        # Clean up multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)

        return text.strip()

    def _extract_headings(self, markdown: str) -> list[str]:
        """
        Extract all headings from markdown.

        Args:
            markdown: Markdown content

        Returns:
            List of headings
        """
        headings = []
        for match in re.finditer(r'^(#+)\s+(.+)$', markdown, re.MULTILINE):
            level = len(match.group(1))
            text = match.group(2).strip()
            headings.append(f"{'  ' * (level - 1)}{text}")
        return headings

    def _extract_links(self, markdown: str) -> list[str]:
        """
        Extract all links from markdown.

        Args:
            markdown: Markdown content

        Returns:
            List of URLs
        """
        links = []
        for match in re.finditer(r'\[([^\]]+)\]\(([^\)]+)\)', markdown):
            url = match.group(2)
            links.append(url)
        return links
