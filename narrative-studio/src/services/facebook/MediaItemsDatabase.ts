/**
 * MediaItemsDatabase - Database schema and operations for Facebook media
 *
 * Handles all media types:
 * - Uncategorized photos
 * - Event photos
 * - Album photos
 * - Message thread photos
 * - Videos
 * - Post/comment associated media (existing)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';

export interface MediaItem {
  id: string;                    // Unique ID (hash of path + timestamp)
  source_type: string;           // 'uncategorized' | 'event' | 'album' | 'message' | 'post' | 'comment'
  media_type: string;            // 'image' | 'video'
  file_path: string;             // Absolute path to media file
  filename: string;              // Just the filename
  file_size: number;             // Size in bytes
  width?: number;                // Image/video width in pixels
  height?: number;               // Image/video height in pixels
  created_at: number;            // Unix timestamp
  description?: string;          // Caption/description
  tags?: string;                 // JSON array of tags
  context?: string;              // Event name, album name, thread name, etc.
  context_id?: string;           // Event ID, album ID, thread ID, etc.
  related_post_id?: string;      // Link to post if associated
  exif_data?: string;            // JSON string of EXIF data
  metadata?: string;             // JSON string of additional metadata
}

export class MediaItemsDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(archivePath: string) {
    this.dbPath = path.join(archivePath, '.embeddings.db');
    this.db = new Database(this.dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    // Create media_items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS media_items (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        media_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        created_at REAL NOT NULL,
        description TEXT,
        tags TEXT,
        context TEXT,
        context_id TEXT,
        related_post_id TEXT,
        exif_data TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_media_source_type ON media_items(source_type);
      CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
      CREATE INDEX IF NOT EXISTS idx_media_created ON media_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_media_filename ON media_items(filename);
      CREATE INDEX IF NOT EXISTS idx_media_size ON media_items(file_size);
      CREATE INDEX IF NOT EXISTS idx_media_dimensions ON media_items(width, height);
      CREATE INDEX IF NOT EXISTS idx_media_context ON media_items(context_id);
    `);

    console.log('✅ Media items schema initialized');
  }

  /**
   * Insert a media item
   */
  insertMediaItem(item: MediaItem): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO media_items (
        id, source_type, media_type, file_path, filename, file_size,
        width, height, created_at, description, tags, context, context_id,
        related_post_id, exif_data, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.id,
      item.source_type,
      item.media_type,
      item.file_path,
      item.filename,
      item.file_size,
      item.width || null,
      item.height || null,
      item.created_at,
      item.description || null,
      item.tags || null,
      item.context || null,
      item.context_id || null,
      item.related_post_id || null,
      item.exif_data || null,
      item.metadata || null
    );
  }

  /**
   * Bulk insert media items
   */
  insertMediaItems(items: MediaItem[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO media_items (
        id, source_type, media_type, file_path, filename, file_size,
        width, height, created_at, description, tags, context, context_id,
        related_post_id, exif_data, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: MediaItem[]) => {
      for (const item of items) {
        stmt.run(
          item.id,
          item.source_type,
          item.media_type,
          item.file_path,
          item.filename,
          item.file_size,
          item.width || null,
          item.height || null,
          item.created_at,
          item.description || null,
          item.tags || null,
          item.context || null,
          item.context_id || null,
          item.related_post_id || null,
          item.exif_data || null,
          item.metadata || null
        );
      }
    });

    insertMany(items);
    return items.length;
  }

  /**
   * Get all media items with filters
   */
  getMediaItems(filters: {
    sourceType?: string;
    mediaType?: string;
    period?: string;           // e.g., "Q2_2015"
    filenamePattern?: string;
    minSize?: number;
    maxSize?: number;
    widthRange?: [number, number];
    heightRange?: [number, number];
    limit?: number;
    offset?: number;
  }): MediaItem[] {
    let query = 'SELECT * FROM media_items WHERE 1=1';
    const params: any[] = [];

    if (filters.sourceType) {
      query += ' AND source_type = ?';
      params.push(filters.sourceType);
    }

    if (filters.mediaType) {
      query += ' AND media_type = ?';
      params.push(filters.mediaType);
    }

    if (filters.filenamePattern) {
      query += ' AND filename LIKE ?';
      params.push(`%${filters.filenamePattern}%`);
    }

    if (filters.minSize !== undefined) {
      query += ' AND file_size >= ?';
      params.push(filters.minSize);
    }

    if (filters.maxSize !== undefined) {
      query += ' AND file_size <= ?';
      params.push(filters.maxSize);
    }

    if (filters.widthRange) {
      query += ' AND width >= ? AND width <= ?';
      params.push(filters.widthRange[0], filters.widthRange[1]);
    }

    if (filters.heightRange) {
      query += ' AND height >= ? AND height <= ?';
      params.push(filters.heightRange[0], filters.heightRange[1]);
    }

    // Period filter (birthday-based quarters)
    if (filters.period) {
      const [qStr, yearStr] = filters.period.split('_');
      const targetQuarter = parseInt(qStr.replace('Q', ''));
      const targetYear = parseInt(yearStr);

      // Calculate period boundaries
      const periodBounds = this.getPeriodBounds(targetQuarter, targetYear);
      query += ' AND created_at >= ? AND created_at <= ?';
      params.push(periodBounds.start, periodBounds.end);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as MediaItem[];
  }

  /**
   * Get period bounds for birthday-based quarters
   * Birthday: April 21
   */
  private getPeriodBounds(quarter: number, year: number): { start: number; end: number } {
    // Quarter boundaries (based on April 21 birthday):
    // Q1: Apr 21 - Jul 19
    // Q2: Jul 20 - Oct 17
    // Q3: Oct 18 - Jan 15
    // Q4: Jan 16 - Apr 20

    let startMonth: number, startDay: number, startYear: number;
    let endMonth: number, endDay: number, endYear: number;

    switch (quarter) {
      case 1:
        startMonth = 3; startDay = 21; startYear = year;
        endMonth = 6; endDay = 19; endYear = year;
        break;
      case 2:
        startMonth = 6; startDay = 20; startYear = year;
        endMonth = 9; endDay = 17; endYear = year;
        break;
      case 3:
        startMonth = 9; startDay = 18; startYear = year;
        endMonth = 0; endDay = 15; endYear = year + 1;
        break;
      case 4:
        startMonth = 0; startDay = 16; startYear = year;
        endMonth = 3; endDay = 20; endYear = year;
        break;
      default:
        throw new Error(`Invalid quarter: ${quarter}`);
    }

    const start = new Date(startYear, startMonth, startDay, 0, 0, 0).getTime() / 1000;
    const end = new Date(endYear, endMonth, endDay, 23, 59, 59).getTime() / 1000;

    return { start, end };
  }

  /**
   * Get media count grouped by source type
   */
  getMediaCountBySource(): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT source_type, COUNT(*) as count
      FROM media_items
      GROUP BY source_type
    `);

    const rows = stmt.all() as Array<{ source_type: string; count: number }>;
    return rows.reduce((acc, row) => {
      acc[row.source_type] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get total media count
   */
  getTotalMediaCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM media_items');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
