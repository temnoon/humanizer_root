import type { GalleryResponse } from '../types';
import { STORAGE_PATHS } from '../config/storage-paths';

const ARCHIVE_API = STORAGE_PATHS.archiveServerUrl;

// ============================================================
// GALLERY SERVICE
// ============================================================

export const galleryService = {
  /**
   * Fetch images from the gallery endpoint
   * @param limit Number of images to fetch (default: 50)
   * @param offset Starting offset for pagination (default: 0)
   * @param folder Optional conversation folder to filter by
   * @param search Optional search query for filtering by filename or conversation title
   * @returns Promise<GalleryResponse> with images, total, and pagination info
   */
  async fetchImages(
    limit = 50,
    offset = 0,
    folder?: string,
    search?: string
  ): Promise<GalleryResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (folder) {
      params.append('folder', folder);
    }

    if (search) {
      params.append('search', search);
    }

    const response = await fetch(
      `${ARCHIVE_API}/api/gallery?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch gallery: ${response.statusText}`);
    }

    return response.json();
  },
};
