import type { GalleryResponse } from '../types';

const ARCHIVE_API = 'http://localhost:3002';

// ============================================================
// GALLERY SERVICE
// ============================================================

export const galleryService = {
  /**
   * Fetch images from the gallery endpoint
   * @param limit Number of images to fetch (default: 50)
   * @param offset Starting offset for pagination (default: 0)
   * @returns Promise<GalleryResponse> with images, total, and pagination info
   */
  async fetchImages(limit = 50, offset = 0): Promise<GalleryResponse> {
    const response = await fetch(
      `${ARCHIVE_API}/api/gallery?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch gallery: ${response.statusText}`);
    }

    return response.json();
  },
};
