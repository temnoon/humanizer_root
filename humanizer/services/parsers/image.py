"""
Image Parser - Parse image files and extract metadata

Handles various image formats:
- JPG/JPEG
- PNG
- GIF
- WebP
- BMP
- TIFF

Extracts EXIF data, dimensions, and other metadata.
"""

from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from .base import BaseParser, ParsedDocument


class ImageParser(BaseParser):
    """
    Parser for image files.

    Features:
    - EXIF metadata extraction (for JPEG)
    - Dimension extraction (width, height)
    - Format detection
    - Thumbnail generation (optional)

    Note: Requires Pillow (PIL) package
    """

    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse an image file.

        Args:
            file_path: Path to image file

        Returns:
            ParsedDocument with image metadata

        Raises:
            FileNotFoundError: If file doesn't exist
            Exception: For parsing errors
        """
        # Get file stats
        stats = self._get_file_stats(file_path)
        mime_type = self._detect_mime_type(file_path)

        try:
            from PIL import Image
        except ImportError:
            raise Exception("Pillow not installed. Run: pip install Pillow")

        # Open and parse image
        try:
            with Image.open(file_path) as img:
                # Basic info
                width, height = img.size
                format_name = img.format
                mode = img.mode

                # Extract EXIF data (for JPEG)
                exif_data = self._extract_exif(img)

                # Extract title from filename
                title = Path(file_path).stem

                # Get creation date from EXIF or filesystem
                created_date = exif_data.get('DateTime') or datetime.fromtimestamp(stats['created']).isoformat()

                metadata = {
                    "file_size": stats["size"],
                    "format": format_name,
                    "mode": mode,
                    "exif": exif_data,
                    "has_transparency": mode in ('RGBA', 'LA', 'P'),
                }

        except Exception as e:
            raise Exception(f"Failed to parse image: {str(e)}")

        return ParsedDocument(
            file_path=file_path,
            title=title,
            mime_type=mime_type or f"image/{format_name.lower()}",
            width=width,
            height=height,
            created_date=created_date,
            metadata=metadata,
        )

    def _extract_exif(self, img) -> Dict[str, Any]:
        """
        Extract EXIF metadata from image.

        Args:
            img: PIL Image object

        Returns:
            Dict of EXIF data
        """
        exif_data = {}

        try:
            # Get EXIF data
            exif = img.getexif()
            if exif:
                # Common EXIF tags
                exif_tags = {
                    0x010F: 'Make',          # Camera manufacturer
                    0x0110: 'Model',         # Camera model
                    0x0112: 'Orientation',   # Image orientation
                    0x0132: 'DateTime',      # Date and time
                    0x9003: 'DateTimeOriginal',  # Original date/time
                    0x829A: 'ExposureTime',  # Exposure time
                    0x829D: 'FNumber',       # F-number
                    0x8827: 'ISO',           # ISO speed
                    0x9209: 'Flash',         # Flash
                    0xA002: 'PixelXDimension',  # Image width
                    0xA003: 'PixelYDimension',  # Image height
                }

                for tag_id, tag_name in exif_tags.items():
                    value = exif.get(tag_id)
                    if value is not None:
                        exif_data[tag_name] = str(value)

                # GPS data
                gps_info = exif.get(0x8825)  # GPSInfo tag
                if gps_info:
                    exif_data['has_gps'] = True
        except Exception:
            # EXIF extraction failed, continue without it
            pass

        return exif_data
