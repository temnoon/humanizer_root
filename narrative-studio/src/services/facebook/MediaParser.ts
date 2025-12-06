/**
 * MediaParser - Extract all media from Facebook export
 *
 * Parses:
 * - Uncategorized photos
 * - Event photos
 * - Album photos
 * - Message thread photos
 * - Videos
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import type { MediaItem } from './MediaItemsDatabase.js';

interface UncategorizedPhoto {
  uri: string;
  creation_timestamp: number;
  description?: string;
  media_metadata?: {
    photo_metadata?: {
      exif_data?: Array<Record<string, any>>;
    };
  };
}

interface AlbumMedia {
  uri: string;
  creation_timestamp: number;
  title?: string;
  description?: string;
}

export class MediaParser {
  private exportDir: string;

  constructor(exportDir: string) {
    this.exportDir = exportDir;
  }

  /**
   * Parse all media from Facebook export
   */
  async parseAll(): Promise<MediaItem[]> {
    console.log('📸 Parsing all Facebook media...\n');

    const allMedia: MediaItem[] = [];

    // Parse uncategorized photos
    const uncategorized = await this.parseUncategorizedPhotos();
    allMedia.push(...uncategorized);
    console.log(`   Uncategorized photos: ${uncategorized.length}`);

    // Parse birthday media
    const birthday = await this.parseBirthdayMedia();
    allMedia.push(...birthday);
    console.log(`   Birthday media: ${birthday.length}`);

    // Parse message thread photos
    const messagePhotos = await this.parseMessagePhotos();
    allMedia.push(...messagePhotos);
    console.log(`   Message thread photos: ${messagePhotos.length}`);

    // Parse videos
    const videos = await this.parseVideos();
    allMedia.push(...videos);
    console.log(`   Videos: ${videos.length}`);

    console.log(`\n✅ Total media parsed: ${allMedia.length}\n`);

    return allMedia;
  }

  /**
   * Parse uncategorized photos
   */
  private async parseUncategorizedPhotos(): Promise<MediaItem[]> {
    const jsonPath = path.join(
      this.exportDir,
      'your_facebook_activity/posts/your_uncategorized_photos.json'
    );

    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);

      const photos: UncategorizedPhoto[] = data.other_photos_v2 || [];
      const mediaItems: MediaItem[] = [];

      for (const photo of photos) {
        const fullPath = path.join(this.exportDir, photo.uri);

        try {
          const stats = await fs.stat(fullPath);
          const dimensions = await this.getImageDimensions(fullPath);

          mediaItems.push({
            id: this.generateId(fullPath, photo.creation_timestamp),
            source_type: 'uncategorized',
            media_type: 'image',
            file_path: fullPath,
            filename: path.basename(photo.uri),
            file_size: stats.size,
            width: dimensions?.width,
            height: dimensions?.height,
            created_at: photo.creation_timestamp,
            description: photo.description,
            exif_data: photo.media_metadata?.photo_metadata?.exif_data
              ? JSON.stringify(photo.media_metadata.photo_metadata.exif_data)
              : undefined,
          });
        } catch (err) {
          console.warn(`⚠️  File not found: ${fullPath}`);
        }
      }

      return mediaItems;
    } catch (err) {
      console.warn('⚠️  No uncategorized photos found');
      return [];
    }
  }

  /**
   * Parse birthday media
   */
  private async parseBirthdayMedia(): Promise<MediaItem[]> {
    const jsonPath = path.join(
      this.exportDir,
      'your_facebook_activity/posts/birthday_media.json'
    );

    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);

      const mediaItems: MediaItem[] = [];

      // Birthday media structure is different - array of entries with label_values
      for (const entry of data) {
        const timestamp = entry.timestamp || 0;

        // Find media in label_values
        const mediaLabel = entry.label_values?.find((lv: any) => lv.label === 'Media');
        if (mediaLabel && mediaLabel.media) {
          for (const mediaItem of mediaLabel.media) {
            const fullPath = path.join(this.exportDir, mediaItem.uri);

            try {
              const stats = await fs.stat(fullPath);
              const dimensions = await this.getImageDimensions(fullPath);

              mediaItems.push({
                id: this.generateId(fullPath, mediaItem.creation_timestamp || timestamp),
                source_type: 'birthday',
                media_type: 'image',
                file_path: fullPath,
                filename: path.basename(mediaItem.uri),
                file_size: stats.size,
                width: dimensions?.width,
                height: dimensions?.height,
                created_at: mediaItem.creation_timestamp || timestamp,
                description: mediaItem.title,
              });
            } catch (err) {
              console.warn(`⚠️  File not found: ${fullPath}`);
            }
          }
        }
      }

      return mediaItems;
    } catch (err) {
      console.warn('⚠️  No birthday media found');
      return [];
    }
  }

  /**
   * Parse message thread photos
   */
  private async parseMessagePhotos(): Promise<MediaItem[]> {
    const messagesDir = path.join(this.exportDir, 'your_facebook_activity/messages');
    const mediaItems: MediaItem[] = [];

    try {
      // Check inbox, archived_threads, filtered_threads
      const threadDirs = ['inbox', 'archived_threads', 'filtered_threads'];

      for (const threadType of threadDirs) {
        const threadPath = path.join(messagesDir, threadType);

        try {
          const threads = await fs.readdir(threadPath);

          for (const thread of threads) {
            const photosDir = path.join(threadPath, thread, 'photos');

            try {
              const photoFiles = await fs.readdir(photosDir);

              for (const photoFile of photoFiles) {
                if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(photoFile)) continue;

                const fullPath = path.join(photosDir, photoFile);
                const stats = await fs.stat(fullPath);
                const dimensions = await this.getImageDimensions(fullPath);

                // Use file mtime as creation_at if not available
                const created_at = Math.floor(stats.mtimeMs / 1000);

                mediaItems.push({
                  id: this.generateId(fullPath, created_at),
                  source_type: 'message',
                  media_type: 'image',
                  file_path: fullPath,
                  filename: photoFile,
                  file_size: stats.size,
                  width: dimensions?.width,
                  height: dimensions?.height,
                  created_at,
                  context: thread, // Thread name
                  context_id: thread,
                });
              }
            } catch {
              // No photos folder in this thread
            }
          }
        } catch {
          // Thread type doesn't exist
        }
      }

      return mediaItems;
    } catch (err) {
      console.warn('⚠️  No message photos found');
      return [];
    }
  }

  /**
   * Parse videos
   */
  private async parseVideos(): Promise<MediaItem[]> {
    const mediaItems: MediaItem[] = [];

    // Find all video files in the export
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];

    try {
      const videos = await this.findFiles(this.exportDir, (file) => {
        const ext = path.extname(file).toLowerCase();
        return videoExtensions.includes(ext);
      });

      for (const videoPath of videos) {
        try {
          const stats = await fs.stat(videoPath);
          const dimensions = await this.getVideoDimensions(videoPath);

          // Determine source type from path
          let sourceType = 'uncategorized';
          if (videoPath.includes('/messages/')) {
            sourceType = 'message';
          } else if (videoPath.includes('/posts/')) {
            sourceType = 'post';
          } else if (videoPath.includes('/stories/')) {
            sourceType = 'story';
          }

          const created_at = Math.floor(stats.mtimeMs / 1000);

          mediaItems.push({
            id: this.generateId(videoPath, created_at),
            source_type: sourceType,
            media_type: 'video',
            file_path: videoPath,
            filename: path.basename(videoPath),
            file_size: stats.size,
            width: dimensions?.width,
            height: dimensions?.height,
            created_at,
          });
        } catch (err) {
          console.warn(`⚠️  Error processing video: ${videoPath}`);
        }
      }

      return mediaItems;
    } catch (err) {
      console.warn('⚠️  No videos found');
      return [];
    }
  }

  /**
   * Get image dimensions using 'file' command
   */
  private async getImageDimensions(imagePath: string): Promise<{ width: number; height: number } | null> {
    try {
      const output = execSync(`file "${imagePath}"`, { encoding: 'utf-8' });

      // Parse output like: "JPEG image data, JFIF standard 1.02, ... precision 8, 640x426, components 3"
      const match = output.match(/(\d+)x(\d+)/);
      if (match) {
        return {
          width: parseInt(match[1]),
          height: parseInt(match[2]),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get video dimensions using ffprobe
   */
  private async getVideoDimensions(videoPath: string): Promise<{ width: number; height: number } | null> {
    try {
      const output = execSync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`,
        { encoding: 'utf-8' }
      );

      const [width, height] = output.trim().split(',').map(Number);
      if (width && height) {
        return { width, height };
      }
      return null;
    } catch {
      // ffprobe not available or video corrupt
      return null;
    }
  }

  /**
   * Find files recursively matching predicate
   */
  private async findFiles(dir: string, predicate: (file: string) => boolean): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subResults = await this.findFiles(fullPath, predicate);
          results.push(...subResults);
        } else if (predicate(fullPath)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Permission denied or directory doesn't exist
    }

    return results;
  }

  /**
   * Generate unique ID for media item
   */
  private generateId(filePath: string, timestamp: number): string {
    const hash = crypto.createHash('sha256');
    hash.update(filePath + timestamp.toString());
    return hash.digest('hex').substring(0, 16);
  }
}
