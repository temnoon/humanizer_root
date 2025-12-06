/**
 * DatabaseImporter - Import Facebook content into the database with embeddings
 */

import { EmbeddingDatabase } from '../embeddings/EmbeddingDatabase.js';
import { embedBatch, initializeEmbedding } from '../embeddings/EmbeddingGenerator.js';
import type { ContentItem, Reaction, FacebookImportProgress } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export interface ImportToDbOptions {
  archivePath: string;                 // Path to archive (for database location)
  batchSize?: number;                  // Batch size for embeddings (default: 100)
  onProgress?: (progress: FacebookImportProgress) => void;
}

export class DatabaseImporter {
  private db: EmbeddingDatabase;

  constructor(archivePath: string) {
    this.db = new EmbeddingDatabase(archivePath);
  }

  /**
   * Import content items and reactions into database with embeddings
   */
  async importToDatabase(
    posts: ContentItem[],
    comments: ContentItem[],
    reactions: Reaction[],
    options: ImportToDbOptions
  ): Promise<{
    postsIndexed: number;
    commentsIndexed: number;
    reactionsIndexed: number;
    embeddingsGenerated: number;
  }> {
    const { batchSize = 100, onProgress } = options;

    console.log('🗄️  Stage 3: Indexing into database with embeddings\n');

    let embeddingsGenerated = 0;

    // ========================================================================
    // Index Posts
    // ========================================================================
    console.log('📝 Indexing posts...');
    onProgress?.({
      stage: 'indexing',
      current: 0,
      total: posts.length + comments.length,
      message: `Indexing posts...`,
    });

    // Prepare posts for batch insert
    const postsToInsert = posts.map(post => ({
      id: post.id,
      type: post.type,
      source: post.source,
      text: post.text,
      title: post.title,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author_name: post.author_name,
      author_id: post.author_id,
      is_own_content: post.is_own_content,
      parent_id: post.parent_id,
      thread_id: post.thread_id,
      context: post.context,
      file_path: post.file_path,
      media_refs: post.media_refs ? JSON.stringify(post.media_refs) : undefined,
      media_count: post.media_count,
      metadata: post.metadata ? JSON.stringify(post.metadata) : undefined,
      tags: post.tags ? JSON.stringify(post.tags) : undefined,
      search_text: post.search_text,
    }));

    this.db.insertContentItemsBatch(postsToInsert);
    console.log(`   Inserted ${posts.length} posts`);

    // Generate embeddings for posts (in batches)
    console.log(`   Generating embeddings for posts...`);
    embeddingsGenerated += await this.generateEmbeddingsForItems(posts, 'post', batchSize, onProgress);

    // ========================================================================
    // Index Comments
    // ========================================================================
    console.log('\n💬 Indexing comments...');
    onProgress?.({
      stage: 'indexing',
      current: posts.length,
      total: posts.length + comments.length,
      message: `Indexing comments...`,
    });

    const commentsToInsert = comments.map(comment => ({
      id: comment.id,
      type: comment.type,
      source: comment.source,
      text: comment.text,
      title: comment.title,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      author_name: comment.author_name,
      author_id: comment.author_id,
      is_own_content: comment.is_own_content,
      parent_id: comment.parent_id,
      thread_id: comment.thread_id,
      context: comment.context,
      file_path: comment.file_path,
      media_refs: comment.media_refs ? JSON.stringify(comment.media_refs) : undefined,
      media_count: comment.media_count,
      metadata: comment.metadata ? JSON.stringify(comment.metadata) : undefined,
      tags: comment.tags ? JSON.stringify(comment.tags) : undefined,
      search_text: comment.search_text,
    }));

    this.db.insertContentItemsBatch(commentsToInsert);
    console.log(`   Inserted ${comments.length} comments`);

    // Generate embeddings for comments
    console.log(`   Generating embeddings for comments...`);
    embeddingsGenerated += await this.generateEmbeddingsForItems(comments, 'comment', batchSize, onProgress);

    // ========================================================================
    // Index Reactions (without embeddings)
    // ========================================================================
    // TODO: Reactions need to be linked to content_items first
    // Skipping reactions for now - they require a linking phase to match
    // reactions to posts/comments based on title/context
    console.log('\n❤️  Skipping reactions (linking phase needed)');
    console.log(`   ${reactions.length} reactions saved to organized archive`);

    console.log(`\n✅ Database indexing complete!`);
    console.log(`   Posts: ${posts.length}`);
    console.log(`   Comments: ${comments.length}`);
    console.log(`   Reactions: ${reactions.length}`);
    console.log(`   Embeddings: ${embeddingsGenerated}`);

    return {
      postsIndexed: posts.length,
      commentsIndexed: comments.length,
      reactionsIndexed: reactions.length,
      embeddingsGenerated,
    };
  }

  /**
   * Generate embeddings for a batch of content items
   */
  private async generateEmbeddingsForItems(
    items: ContentItem[],
    type: string,
    batchSize: number,
    onProgress?: (progress: FacebookImportProgress) => void
  ): Promise<number> {
    let generated = 0;

    // Initialize embedding model if not already done
    await initializeEmbedding();

    // Filter items that have text to embed
    const itemsWithText = items.filter(item => item.text && item.text.length > 0);

    // Process in batches
    for (let i = 0; i < itemsWithText.length; i += batchSize) {
      const batch = itemsWithText.slice(i, i + batchSize);

      onProgress?.({
        stage: 'embeddings',
        current: i,
        total: itemsWithText.length,
        message: `Generating embeddings for ${type}s (${i}/${itemsWithText.length})`,
      });

      // Generate embeddings for batch
      const texts = batch.map(item => item.text!);
      const embeddings = await embedBatch(texts);

      // Insert embeddings into vec_content_items
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const embedding = embeddings[j];

        if (embedding && embedding.length > 0) {
          const embeddingId = `emb_${item.id}_${uuidv4().substring(0, 8)}`;

          this.db.insertContentItemEmbedding(
            embeddingId,
            item.id,
            item.type,
            item.source,
            Array.from(embedding)
          );

          generated++;
        }
      }
    }

    return generated;
  }

  /**
   * Get database statistics
   */
  getStats(): {
    posts: number;
    comments: number;
    reactions: number;
    total: number;
  } {
    const posts = this.db.getContentItemsByType('post');
    const comments = this.db.getContentItemsByType('comment');
    // Reactions aren't indexed yet (need linking phase)
    const reactions = 0;

    return {
      posts: posts.length,
      comments: comments.length,
      reactions,
      total: posts.length + comments.length + reactions,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the database instance (for direct access)
   */
  getDatabase(): EmbeddingDatabase {
    return this.db;
  }
}
