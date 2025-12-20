/**
 * EmbeddingDatabase - SQLite storage for text, references, and vectors
 *
 * Unified storage using SQLite + sqlite-vec for:
 * - Text content (conversations, messages, chunks)
 * - Vector embeddings (384-dim all-MiniLM-L6-v2)
 * - User curation and discovered structures
 *
 * One database per archive for portability.
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { v4 as uuidv4 } from 'uuid';
import type {
  Conversation,
  Message,
  Chunk,
  UserMark,
  Cluster,
  ClusterMember,
  Anchor,
  MarkType,
  TargetType,
  AnchorType,
  SearchResult,
} from './types.js';

const SCHEMA_VERSION = 4;  // Bumped for pyramid tables and import tracking
const EMBEDDING_DIM = 384;  // all-MiniLM-L6-v2

export class EmbeddingDatabase {
  private db: Database.Database;
  private archivePath: string;
  private vecLoaded: boolean = false;

  constructor(archivePath: string) {
    this.archivePath = archivePath;
    const dbPath = `${archivePath}/.embeddings.db`;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Load sqlite-vec extension for vector operations
    try {
      sqliteVec.load(this.db);
      this.vecLoaded = true;
    } catch (err) {
      console.warn('sqlite-vec extension not loaded:', err);
      // Continue without vector support
    }

    this.initSchema();
  }

  private initSchema(): void {
    // Check schema version
    const versionResult = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
    `).get();

    if (!versionResult) {
      this.createTables();
    } else {
      const currentVersion = this.db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
      if (!currentVersion || currentVersion.version < SCHEMA_VERSION) {
        this.migrateSchema(currentVersion?.version || 0);
      }
    }
  }

  private createTables(): void {
    this.db.exec(`
      -- Schema version tracking
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
      INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION});

      -- Core entities
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        folder TEXT NOT NULL,
        title TEXT,
        created_at REAL,
        updated_at REAL,
        message_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        is_interesting INTEGER DEFAULT 0,
        summary TEXT,
        summary_embedding_id TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        parent_id TEXT,
        role TEXT NOT NULL,
        content TEXT,
        created_at REAL,
        token_count INTEGER DEFAULT 0,
        embedding_id TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        chunk_index INTEGER,
        content TEXT,
        token_count INTEGER DEFAULT 0,
        embedding_id TEXT,
        granularity TEXT NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id)
      );

      -- User curation
      CREATE TABLE IF NOT EXISTS user_marks (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        mark_type TEXT NOT NULL,
        note TEXT,
        created_at REAL
      );

      -- Discovered structures
      CREATE TABLE IF NOT EXISTS clusters (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        centroid_embedding_id TEXT,
        member_count INTEGER DEFAULT 0,
        coherence_score REAL,
        created_at REAL
      );

      CREATE TABLE IF NOT EXISTS cluster_members (
        cluster_id TEXT,
        embedding_id TEXT,
        distance_to_centroid REAL,
        PRIMARY KEY (cluster_id, embedding_id)
      );

      CREATE TABLE IF NOT EXISTS anchors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        anchor_type TEXT NOT NULL,
        embedding BLOB,
        source_embedding_ids TEXT,
        created_at REAL
      );

      -- ========================================================================
      -- Unified Content Tables (Facebook posts, comments, photos, etc.)
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,              -- 'post', 'comment', 'photo', 'video', 'message', 'document'
        source TEXT NOT NULL,             -- 'facebook', 'openai', 'claude', 'instagram', 'local'

        -- Content
        text TEXT,                        -- Post text, comment text, message content
        title TEXT,                       -- Optional title

        -- Timestamps
        created_at REAL NOT NULL,         -- Unix timestamp
        updated_at REAL,

        -- Author/Actor
        author_name TEXT,                 -- "Tem Noon" or "Friend Name"
        author_id TEXT,                   -- Facebook user ID
        is_own_content INTEGER,           -- 1 if created by user, 0 if by others

        -- Context/Relationships
        parent_id TEXT,                   -- For replies/comments
        thread_id TEXT,                   -- Top-level post ID
        context TEXT,                     -- JSON: "commented on David Morris's post"

        -- File System Reference
        file_path TEXT,                   -- Path to folder: "facebook_import/posts/Q1_2008/post_123/"

        -- Media
        media_refs TEXT,                  -- JSON array of file paths
        media_count INTEGER DEFAULT 0,

        -- Metadata
        metadata TEXT,                    -- JSON: source-specific fields
        tags TEXT,                        -- JSON array

        -- Embeddings
        embedding BLOB,                   -- vec0 embedding (384-dim for all-MiniLM-L6-v2)
        embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',

        -- Search
        search_text TEXT,                 -- Preprocessed for FTS

        FOREIGN KEY (parent_id) REFERENCES content_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS media_files (
        id TEXT PRIMARY KEY,
        content_item_id TEXT,

        file_path TEXT NOT NULL,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,

        type TEXT NOT NULL,               -- 'photo', 'video', 'audio', 'document'
        width INTEGER,
        height INTEGER,
        duration INTEGER,

        taken_at REAL,
        uploaded_at REAL,

        caption TEXT,
        location TEXT,                    -- JSON
        people_tagged TEXT,               -- JSON array
        metadata TEXT,                    -- JSON

        embedding BLOB,                   -- CLIP for visual similarity (future)
        embedding_model TEXT,

        FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        content_item_id TEXT NOT NULL,

        reaction_type TEXT NOT NULL,      -- 'like', 'love', 'haha', 'wow', 'sad', 'angry'
        reactor_name TEXT,
        reactor_id TEXT,

        created_at REAL NOT NULL,

        FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS archive_settings (
        archive_id TEXT PRIMARY KEY,      -- 'facebook_import_2025-11-18'
        settings TEXT NOT NULL,           -- JSON of ArchiveOrganizationSettings
        created_at REAL NOT NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_message ON chunks(message_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_granularity ON chunks(granularity);
      CREATE INDEX IF NOT EXISTS idx_user_marks_target ON user_marks(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_interesting ON conversations(is_interesting);

      -- Indexes for unified content tables
      CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(type);
      CREATE INDEX IF NOT EXISTS idx_content_source ON content_items(source);
      CREATE INDEX IF NOT EXISTS idx_content_created ON content_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_content_author ON content_items(author_name);
      CREATE INDEX IF NOT EXISTS idx_content_thread ON content_items(thread_id);
      CREATE INDEX IF NOT EXISTS idx_content_own ON content_items(is_own_content);
      CREATE INDEX IF NOT EXISTS idx_content_file_path ON content_items(file_path);

      CREATE INDEX IF NOT EXISTS idx_media_content ON media_files(content_item_id);
      CREATE INDEX IF NOT EXISTS idx_media_type ON media_files(type);
      CREATE INDEX IF NOT EXISTS idx_media_taken ON media_files(taken_at DESC);

      CREATE INDEX IF NOT EXISTS idx_reactions_content ON reactions(content_item_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_type ON reactions(reaction_type);

      -- ========================================================================
      -- Import Tracking
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,              -- 'openai', 'facebook', 'claude', 'paste', 'file'
        source_path TEXT,                  -- Original file/folder path
        status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'

        -- Stats
        thread_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        media_count INTEGER DEFAULT 0,
        total_words INTEGER DEFAULT 0,

        -- Timestamps
        created_at REAL NOT NULL,
        started_at REAL,
        completed_at REAL,

        -- Error tracking
        error_message TEXT,

        -- Metadata
        metadata TEXT                      -- JSON: source-specific details
      );

      -- ========================================================================
      -- Pyramid Tables (Hierarchical Summarization)
      -- ========================================================================

      -- L0 base chunks (leaf nodes of pyramid)
      CREATE TABLE IF NOT EXISTS pyramid_chunks (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,           -- References content_items.id or conversations.id
        thread_type TEXT NOT NULL,         -- 'conversation', 'post', 'document'

        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER NOT NULL,

        -- Structural metadata
        start_offset INTEGER,              -- Character offset in original
        end_offset INTEGER,
        boundary_type TEXT,                -- 'paragraph', 'section', 'semantic'

        -- Embeddings
        embedding BLOB,
        embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',

        created_at REAL NOT NULL,

        UNIQUE(thread_id, chunk_index)
      );

      -- L1+ summary nodes
      CREATE TABLE IF NOT EXISTS pyramid_summaries (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        level INTEGER NOT NULL,            -- 1 = summarizes chunks, 2 = summarizes L1, etc.

        content TEXT NOT NULL,             -- The summary text
        word_count INTEGER NOT NULL,

        -- Children (what this summary covers)
        child_ids TEXT NOT NULL,           -- JSON array of chunk/summary IDs
        child_type TEXT NOT NULL,          -- 'chunk' or 'summary'

        -- Compression info
        source_word_count INTEGER,         -- Total words of source content
        compression_ratio REAL,            -- source_word_count / word_count

        -- Embeddings
        embedding BLOB,
        embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',

        -- LLM tracking
        model_used TEXT,                   -- 'claude-3-haiku', etc.

        created_at REAL NOT NULL
      );

      -- Apex summary (one per thread)
      CREATE TABLE IF NOT EXISTS pyramid_apex (
        id TEXT PRIMARY KEY,
        thread_id TEXT UNIQUE NOT NULL,

        -- Core synthesis
        summary TEXT NOT NULL,             -- Full document summary
        themes TEXT,                       -- JSON array of extracted themes

        -- Narrative analysis (optional)
        characters TEXT,                   -- JSON array of key entities/people
        arc TEXT,                          -- Narrative arc description

        -- Stats
        total_chunks INTEGER NOT NULL,
        pyramid_depth INTEGER NOT NULL,    -- How many levels in pyramid
        total_source_words INTEGER NOT NULL,

        -- Embeddings
        embedding BLOB,
        embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',

        -- LLM tracking
        model_used TEXT,

        created_at REAL NOT NULL,
        updated_at REAL
      );

      -- Indexes for pyramid tables
      CREATE INDEX IF NOT EXISTS idx_pyramid_chunks_thread ON pyramid_chunks(thread_id);
      CREATE INDEX IF NOT EXISTS idx_pyramid_summaries_thread ON pyramid_summaries(thread_id);
      CREATE INDEX IF NOT EXISTS idx_pyramid_summaries_level ON pyramid_summaries(level);
      CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
      CREATE INDEX IF NOT EXISTS idx_imports_source ON imports(source);
    `);

    // Create vec0 virtual tables for vector search (if extension loaded)
    if (this.vecLoaded) {
      this.createVectorTables();
    }
  }

  private createVectorTables(): void {
    // Summary embeddings (one per conversation)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_summaries USING vec0(
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    // Message embeddings (one per message)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_messages USING vec0(
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        message_id TEXT,
        role TEXT,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    // Paragraph embeddings (for interesting conversations)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_paragraphs USING vec0(
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        message_id TEXT,
        chunk_index INTEGER,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    // Sentence embeddings (for user-selected messages)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_sentences USING vec0(
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        message_id TEXT,
        chunk_index INTEGER,
        sentence_index INTEGER,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    // Anchor embeddings (computed centroids/anti-centroids)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_anchors USING vec0(
        id TEXT PRIMARY KEY,
        anchor_type TEXT,
        name TEXT,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    // Cluster centroids
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_clusters USING vec0(
        id TEXT PRIMARY KEY,
        cluster_id TEXT,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    // Content item embeddings (Facebook posts, comments, etc.)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_content_items USING vec0(
        id TEXT PRIMARY KEY,
        content_item_id TEXT,
        type TEXT,
        source TEXT,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    // Pyramid embeddings (hierarchical summarization)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_pyramid_chunks USING vec0(
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        chunk_index INTEGER,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_pyramid_summaries USING vec0(
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        level INTEGER,
        embedding float[${EMBEDDING_DIM}]
      );
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_pyramid_apex USING vec0(
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        embedding float[${EMBEDDING_DIM}]
      );
    `);
  }

  private migrateSchema(fromVersion: number): void {
    // Migration from version 1 to 2: add vector tables
    if (fromVersion < 2 && this.vecLoaded) {
      this.createVectorTables();
    }

    // Migration from version 2 to 3: add unified content tables
    if (fromVersion < 3) {
      this.db.exec(`
        -- Unified content tables for Facebook posts, comments, photos, etc.
        CREATE TABLE IF NOT EXISTS content_items (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          source TEXT NOT NULL,
          text TEXT,
          title TEXT,
          created_at REAL NOT NULL,
          updated_at REAL,
          author_name TEXT,
          author_id TEXT,
          is_own_content INTEGER,
          parent_id TEXT,
          thread_id TEXT,
          context TEXT,
          file_path TEXT,
          media_refs TEXT,
          media_count INTEGER DEFAULT 0,
          metadata TEXT,
          tags TEXT,
          embedding BLOB,
          embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
          search_text TEXT,
          FOREIGN KEY (parent_id) REFERENCES content_items(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS media_files (
          id TEXT PRIMARY KEY,
          content_item_id TEXT,
          file_path TEXT NOT NULL,
          file_name TEXT,
          file_size INTEGER,
          mime_type TEXT,
          type TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          duration INTEGER,
          taken_at REAL,
          uploaded_at REAL,
          caption TEXT,
          location TEXT,
          people_tagged TEXT,
          metadata TEXT,
          embedding BLOB,
          embedding_model TEXT,
          FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS reactions (
          id TEXT PRIMARY KEY,
          content_item_id TEXT NOT NULL,
          reaction_type TEXT NOT NULL,
          reactor_name TEXT,
          reactor_id TEXT,
          created_at REAL NOT NULL,
          FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS archive_settings (
          archive_id TEXT PRIMARY KEY,
          settings TEXT NOT NULL,
          created_at REAL NOT NULL
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(type);
        CREATE INDEX IF NOT EXISTS idx_content_source ON content_items(source);
        CREATE INDEX IF NOT EXISTS idx_content_created ON content_items(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_content_author ON content_items(author_name);
        CREATE INDEX IF NOT EXISTS idx_content_thread ON content_items(thread_id);
        CREATE INDEX IF NOT EXISTS idx_content_own ON content_items(is_own_content);
        CREATE INDEX IF NOT EXISTS idx_content_file_path ON content_items(file_path);
        CREATE INDEX IF NOT EXISTS idx_media_content ON media_files(content_item_id);
        CREATE INDEX IF NOT EXISTS idx_media_type ON media_files(type);
        CREATE INDEX IF NOT EXISTS idx_media_taken ON media_files(taken_at DESC);
        CREATE INDEX IF NOT EXISTS idx_reactions_content ON reactions(content_item_id);
        CREATE INDEX IF NOT EXISTS idx_reactions_type ON reactions(reaction_type);
      `);

      // Add vector table for content items if vec extension is loaded
      if (this.vecLoaded) {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_content_items USING vec0(
            id TEXT PRIMARY KEY,
            content_item_id TEXT,
            type TEXT,
            source TEXT,
            embedding float[${EMBEDDING_DIM}]
          );
        `);
      }
    }

    // Migration from version 3 to 4: add pyramid tables and import tracking
    if (fromVersion < 4) {
      this.db.exec(`
        -- Import tracking
        CREATE TABLE IF NOT EXISTS imports (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          source_path TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          thread_count INTEGER DEFAULT 0,
          message_count INTEGER DEFAULT 0,
          media_count INTEGER DEFAULT 0,
          total_words INTEGER DEFAULT 0,
          created_at REAL NOT NULL,
          started_at REAL,
          completed_at REAL,
          error_message TEXT,
          metadata TEXT
        );

        -- L0 base chunks
        CREATE TABLE IF NOT EXISTS pyramid_chunks (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          thread_type TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          word_count INTEGER NOT NULL,
          start_offset INTEGER,
          end_offset INTEGER,
          boundary_type TEXT,
          embedding BLOB,
          embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
          created_at REAL NOT NULL,
          UNIQUE(thread_id, chunk_index)
        );

        -- L1+ summary nodes
        CREATE TABLE IF NOT EXISTS pyramid_summaries (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          level INTEGER NOT NULL,
          content TEXT NOT NULL,
          word_count INTEGER NOT NULL,
          child_ids TEXT NOT NULL,
          child_type TEXT NOT NULL,
          source_word_count INTEGER,
          compression_ratio REAL,
          embedding BLOB,
          embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
          model_used TEXT,
          created_at REAL NOT NULL
        );

        -- Apex summary
        CREATE TABLE IF NOT EXISTS pyramid_apex (
          id TEXT PRIMARY KEY,
          thread_id TEXT UNIQUE NOT NULL,
          summary TEXT NOT NULL,
          themes TEXT,
          characters TEXT,
          arc TEXT,
          total_chunks INTEGER NOT NULL,
          pyramid_depth INTEGER NOT NULL,
          total_source_words INTEGER NOT NULL,
          embedding BLOB,
          embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
          model_used TEXT,
          created_at REAL NOT NULL,
          updated_at REAL
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_pyramid_chunks_thread ON pyramid_chunks(thread_id);
        CREATE INDEX IF NOT EXISTS idx_pyramid_summaries_thread ON pyramid_summaries(thread_id);
        CREATE INDEX IF NOT EXISTS idx_pyramid_summaries_level ON pyramid_summaries(level);
        CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
        CREATE INDEX IF NOT EXISTS idx_imports_source ON imports(source);
      `);

      // Add vector tables for pyramid content
      if (this.vecLoaded) {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_pyramid_chunks USING vec0(
            id TEXT PRIMARY KEY,
            thread_id TEXT,
            chunk_index INTEGER,
            embedding float[${EMBEDDING_DIM}]
          );

          CREATE VIRTUAL TABLE IF NOT EXISTS vec_pyramid_summaries USING vec0(
            id TEXT PRIMARY KEY,
            thread_id TEXT,
            level INTEGER,
            embedding float[${EMBEDDING_DIM}]
          );

          CREATE VIRTUAL TABLE IF NOT EXISTS vec_pyramid_apex USING vec0(
            id TEXT PRIMARY KEY,
            thread_id TEXT,
            embedding float[${EMBEDDING_DIM}]
          );
        `);
      }
    }

    this.db.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
  }

  // ===========================================================================
  // Conversation Operations
  // ===========================================================================

  insertConversation(conv: Omit<Conversation, 'isInteresting' | 'summary' | 'summaryEmbeddingId'>): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO conversations
      (id, folder, title, created_at, updated_at, message_count, total_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      conv.id,
      conv.folder,
      conv.title,
      conv.createdAt,
      conv.updatedAt,
      conv.messageCount,
      conv.totalTokens
    );
  }

  getConversation(id: string): Conversation | null {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToConversation(row);
  }

  getAllConversations(): Conversation[] {
    const rows = this.db.prepare('SELECT * FROM conversations ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map(this.rowToConversation);
  }

  getInterestingConversations(): Conversation[] {
    const rows = this.db.prepare('SELECT * FROM conversations WHERE is_interesting = 1 ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map(this.rowToConversation);
  }

  markConversationInteresting(id: string, interesting: boolean): void {
    this.db.prepare('UPDATE conversations SET is_interesting = ? WHERE id = ?').run(interesting ? 1 : 0, id);
  }

  updateConversationSummary(id: string, summary: string, embeddingId: string): void {
    this.db.prepare('UPDATE conversations SET summary = ?, summary_embedding_id = ? WHERE id = ?').run(summary, embeddingId, id);
  }

  private rowToConversation(row: Record<string, unknown>): Conversation {
    return {
      id: row.id as string,
      folder: row.folder as string,
      title: row.title as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      messageCount: row.message_count as number,
      totalTokens: row.total_tokens as number,
      isInteresting: (row.is_interesting as number) === 1,
      summary: row.summary as string | null,
      summaryEmbeddingId: row.summary_embedding_id as string | null,
    };
  }

  // ===========================================================================
  // Message Operations
  // ===========================================================================

  insertMessage(msg: Omit<Message, 'embeddingId'>): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO messages
      (id, conversation_id, parent_id, role, content, created_at, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.conversationId,
      msg.parentId,
      msg.role,
      msg.content,
      msg.createdAt,
      msg.tokenCount
    );
  }

  insertMessagesBatch(messages: Omit<Message, 'embeddingId'>[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO messages
      (id, conversation_id, parent_id, role, content, created_at, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((msgs: Omit<Message, 'embeddingId'>[]) => {
      for (const msg of msgs) {
        insert.run(msg.id, msg.conversationId, msg.parentId, msg.role, msg.content, msg.createdAt, msg.tokenCount);
      }
    });

    insertMany(messages);
  }

  getMessage(id: string): Message | null {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToMessage(row);
  }

  getMessagesForConversation(conversationId: string): Message[] {
    const rows = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(conversationId) as Record<string, unknown>[];
    return rows.map(this.rowToMessage);
  }

  getAllMessages(): Message[] {
    const rows = this.db.prepare('SELECT * FROM messages ORDER BY created_at').all() as Record<string, unknown>[];
    return rows.map(this.rowToMessage);
  }

  getMessagesWithoutEmbeddings(): Message[] {
    const rows = this.db.prepare('SELECT * FROM messages WHERE embedding_id IS NULL').all() as Record<string, unknown>[];
    return rows.map(this.rowToMessage);
  }

  updateMessageEmbeddingId(id: string, embeddingId: string): void {
    this.db.prepare('UPDATE messages SET embedding_id = ? WHERE id = ?').run(embeddingId, id);
  }

  updateMessageEmbeddingIdsBatch(updates: { id: string; embeddingId: string }[]): void {
    const update = this.db.prepare('UPDATE messages SET embedding_id = ? WHERE id = ?');
    const updateMany = this.db.transaction((items: { id: string; embeddingId: string }[]) => {
      for (const item of items) {
        update.run(item.embeddingId, item.id);
      }
    });
    updateMany(updates);
  }

  private rowToMessage(row: Record<string, unknown>): Message {
    return {
      id: row.id as string,
      conversationId: row.conversation_id as string,
      parentId: row.parent_id as string | null,
      role: row.role as 'user' | 'assistant' | 'system' | 'tool',
      content: row.content as string,
      createdAt: row.created_at as number,
      tokenCount: row.token_count as number,
      embeddingId: row.embedding_id as string | null,
    };
  }

  // ===========================================================================
  // Chunk Operations
  // ===========================================================================

  insertChunk(chunk: Omit<Chunk, 'embeddingId'>): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO chunks
      (id, message_id, chunk_index, content, token_count, granularity)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      chunk.id,
      chunk.messageId,
      chunk.chunkIndex,
      chunk.content,
      chunk.tokenCount,
      chunk.granularity
    );
  }

  insertChunksBatch(chunks: Omit<Chunk, 'embeddingId'>[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO chunks
      (id, message_id, chunk_index, content, token_count, granularity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: Omit<Chunk, 'embeddingId'>[]) => {
      for (const chunk of items) {
        insert.run(chunk.id, chunk.messageId, chunk.chunkIndex, chunk.content, chunk.tokenCount, chunk.granularity);
      }
    });

    insertMany(chunks);
  }

  getChunksForMessage(messageId: string): Chunk[] {
    const rows = this.db.prepare('SELECT * FROM chunks WHERE message_id = ? ORDER BY chunk_index').all(messageId) as Record<string, unknown>[];
    return rows.map(this.rowToChunk);
  }

  getChunksByGranularity(granularity: 'paragraph' | 'sentence'): Chunk[] {
    const rows = this.db.prepare('SELECT * FROM chunks WHERE granularity = ?').all(granularity) as Record<string, unknown>[];
    return rows.map(this.rowToChunk);
  }

  updateChunkEmbeddingId(id: string, embeddingId: string): void {
    this.db.prepare('UPDATE chunks SET embedding_id = ? WHERE id = ?').run(embeddingId, id);
  }

  private rowToChunk(row: Record<string, unknown>): Chunk {
    return {
      id: row.id as string,
      messageId: row.message_id as string,
      chunkIndex: row.chunk_index as number,
      content: row.content as string,
      tokenCount: row.token_count as number,
      embeddingId: row.embedding_id as string | null,
      granularity: row.granularity as 'paragraph' | 'sentence',
    };
  }

  // ===========================================================================
  // User Mark Operations
  // ===========================================================================

  addUserMark(targetType: TargetType, targetId: string, markType: MarkType, note?: string): string {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO user_marks (id, target_type, target_id, mark_type, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, targetType, targetId, markType, note || null, Date.now() / 1000);
    return id;
  }

  removeUserMark(id: string): void {
    this.db.prepare('DELETE FROM user_marks WHERE id = ?').run(id);
  }

  getUserMarksForTarget(targetType: TargetType, targetId: string): UserMark[] {
    const rows = this.db.prepare('SELECT * FROM user_marks WHERE target_type = ? AND target_id = ?').all(targetType, targetId) as Record<string, unknown>[];
    return rows.map(this.rowToUserMark);
  }

  getUserMarksByType(markType: MarkType): UserMark[] {
    const rows = this.db.prepare('SELECT * FROM user_marks WHERE mark_type = ?').all(markType) as Record<string, unknown>[];
    return rows.map(this.rowToUserMark);
  }

  private rowToUserMark(row: Record<string, unknown>): UserMark {
    return {
      id: row.id as string,
      targetType: row.target_type as TargetType,
      targetId: row.target_id as string,
      markType: row.mark_type as MarkType,
      note: row.note as string | null,
      createdAt: row.created_at as number,
    };
  }

  // ===========================================================================
  // Cluster Operations
  // ===========================================================================

  insertCluster(cluster: Omit<Cluster, 'id' | 'createdAt'>): string {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO clusters (id, name, description, centroid_embedding_id, member_count, coherence_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, cluster.name, cluster.description, cluster.centroidEmbeddingId, cluster.memberCount, cluster.coherenceScore, Date.now() / 1000);
    return id;
  }

  getCluster(id: string): Cluster | null {
    const row = this.db.prepare('SELECT * FROM clusters WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToCluster(row);
  }

  getAllClusters(): Cluster[] {
    const rows = this.db.prepare('SELECT * FROM clusters ORDER BY coherence_score DESC').all() as Record<string, unknown>[];
    return rows.map(this.rowToCluster);
  }

  updateClusterName(id: string, name: string, description?: string): void {
    this.db.prepare('UPDATE clusters SET name = ?, description = ? WHERE id = ?').run(name, description || null, id);
  }

  addClusterMember(clusterId: string, embeddingId: string, distanceToCentroid: number): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO cluster_members (cluster_id, embedding_id, distance_to_centroid)
      VALUES (?, ?, ?)
    `).run(clusterId, embeddingId, distanceToCentroid);
  }

  getClusterMembers(clusterId: string): ClusterMember[] {
    const rows = this.db.prepare('SELECT * FROM cluster_members WHERE cluster_id = ? ORDER BY distance_to_centroid').all(clusterId) as Record<string, unknown>[];
    return rows.map(row => ({
      clusterId: row.cluster_id as string,
      embeddingId: row.embedding_id as string,
      distanceToCentroid: row.distance_to_centroid as number,
    }));
  }

  clearClusters(): void {
    this.db.exec('DELETE FROM cluster_members; DELETE FROM clusters;');
  }

  private rowToCluster(row: Record<string, unknown>): Cluster {
    return {
      id: row.id as string,
      name: row.name as string | null,
      description: row.description as string | null,
      centroidEmbeddingId: row.centroid_embedding_id as string | null,
      memberCount: row.member_count as number,
      coherenceScore: row.coherence_score as number,
      createdAt: row.created_at as number,
    };
  }

  // ===========================================================================
  // Anchor Operations
  // ===========================================================================

  insertAnchor(anchor: Omit<Anchor, 'id' | 'createdAt'>): string {
    const id = uuidv4();
    const embeddingBlob = Buffer.from(new Float32Array(anchor.embedding).buffer);
    const sourceIdsJson = JSON.stringify(anchor.sourceEmbeddingIds);

    this.db.prepare(`
      INSERT INTO anchors (id, name, description, anchor_type, embedding, source_embedding_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, anchor.name, anchor.description, anchor.anchorType, embeddingBlob, sourceIdsJson, Date.now() / 1000);
    return id;
  }

  getAnchor(id: string): Anchor | null {
    const row = this.db.prepare('SELECT * FROM anchors WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToAnchor(row);
  }

  getAllAnchors(): Anchor[] {
    const rows = this.db.prepare('SELECT * FROM anchors ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map(this.rowToAnchor);
  }

  getAnchorsByType(anchorType: AnchorType): Anchor[] {
    const rows = this.db.prepare('SELECT * FROM anchors WHERE anchor_type = ?').all(anchorType) as Record<string, unknown>[];
    return rows.map(this.rowToAnchor);
  }

  deleteAnchor(id: string): void {
    this.db.prepare('DELETE FROM anchors WHERE id = ?').run(id);
  }

  private rowToAnchor(row: Record<string, unknown>): Anchor {
    const embeddingBlob = row.embedding as Buffer;
    const embedding = Array.from(new Float32Array(embeddingBlob.buffer, embeddingBlob.byteOffset, embeddingBlob.byteLength / 4));
    const sourceIds = JSON.parse(row.source_embedding_ids as string) as string[];

    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      anchorType: row.anchor_type as AnchorType,
      embedding,
      sourceEmbeddingIds: sourceIds,
      createdAt: row.created_at as number,
    };
  }

  // ===========================================================================
  // Vector Operations (sqlite-vec)
  // ===========================================================================

  /**
   * Convert a number array to the JSON format expected by vec0
   */
  private embeddingToJson(embedding: number[]): string {
    return JSON.stringify(embedding);
  }

  /**
   * Convert binary buffer from sqlite-vec to number array
   * sqlite-vec stores vectors as Float32Array binary blobs
   */
  private embeddingFromBinary(data: Buffer | string): number[] {
    if (typeof data === 'string') {
      // If it's still JSON (shouldn't happen but handle gracefully)
      return JSON.parse(data);
    }
    // Convert binary buffer to Float32Array
    const floats = new Float32Array(data.buffer, data.byteOffset, data.length / 4);
    return Array.from(floats);
  }

  /**
   * Insert a summary embedding
   */
  insertSummaryEmbedding(id: string, conversationId: string, embedding: number[]): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');
    this.db.prepare(`
      INSERT INTO vec_summaries (id, conversation_id, embedding)
      VALUES (?, ?, ?)
    `).run(id, conversationId, this.embeddingToJson(embedding));
  }

  /**
   * Insert a message embedding
   */
  insertMessageEmbedding(
    id: string,
    conversationId: string,
    messageId: string,
    role: string,
    embedding: number[]
  ): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');
    this.db.prepare(`
      INSERT INTO vec_messages (id, conversation_id, message_id, role, embedding)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, conversationId, messageId, role, this.embeddingToJson(embedding));
  }

  /**
   * Insert message embeddings in batch (more efficient)
   */
  insertMessageEmbeddingsBatch(
    items: Array<{
      id: string;
      conversationId: string;
      messageId: string;
      role: string;
      embedding: number[];
    }>
  ): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    const insert = this.db.prepare(`
      INSERT INTO vec_messages (id, conversation_id, message_id, role, embedding)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: Array<{
      id: string;
      conversationId: string;
      messageId: string;
      role: string;
      embedding: number[];
    }>) => {
      for (const item of items) {
        insert.run(
          item.id,
          item.conversationId,
          item.messageId,
          item.role,
          this.embeddingToJson(item.embedding)
        );
      }
    });

    insertMany(items);
  }

  /**
   * Insert a paragraph embedding
   */
  insertParagraphEmbedding(
    id: string,
    conversationId: string,
    messageId: string,
    chunkIndex: number,
    embedding: number[]
  ): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');
    this.db.prepare(`
      INSERT INTO vec_paragraphs (id, conversation_id, message_id, chunk_index, embedding)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, conversationId, messageId, chunkIndex, this.embeddingToJson(embedding));
  }

  /**
   * Insert a sentence embedding
   */
  insertSentenceEmbedding(
    id: string,
    conversationId: string,
    messageId: string,
    chunkIndex: number,
    sentenceIndex: number,
    embedding: number[]
  ): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');
    this.db.prepare(`
      INSERT INTO vec_sentences (id, conversation_id, message_id, chunk_index, sentence_index, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, conversationId, messageId, chunkIndex, sentenceIndex, this.embeddingToJson(embedding));
  }

  /**
   * Insert an anchor embedding
   */
  insertAnchorEmbedding(id: string, anchorType: AnchorType, name: string, embedding: number[]): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');
    this.db.prepare(`
      INSERT INTO vec_anchors (id, anchor_type, name, embedding)
      VALUES (?, ?, ?, ?)
    `).run(id, anchorType, name, this.embeddingToJson(embedding));
  }

  /**
   * Insert a cluster centroid embedding
   */
  insertClusterEmbedding(id: string, clusterId: string, embedding: number[]): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');
    this.db.prepare(`
      INSERT INTO vec_clusters (id, cluster_id, embedding)
      VALUES (?, ?, ?)
    `).run(id, clusterId, this.embeddingToJson(embedding));
  }

  /**
   * Search for similar messages by embedding
   */
  searchMessages(queryEmbedding: number[], limit: number = 20): SearchResult[] {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    const results = this.db.prepare(`
      SELECT
        vec_messages.id,
        vec_messages.conversation_id,
        vec_messages.message_id,
        vec_messages.role,
        vec_messages.distance,
        messages.content,
        conversations.title as conversation_title
      FROM vec_messages
      JOIN messages ON messages.id = vec_messages.message_id
      JOIN conversations ON conversations.id = vec_messages.conversation_id
      WHERE embedding MATCH ? AND k = ?
      ORDER BY distance
    `).all(this.embeddingToJson(queryEmbedding), limit) as Array<Record<string, unknown>>;

    return results.map(row => ({
      id: row.id as string,
      content: row.content as string,
      similarity: 1 - (row.distance as number),  // Convert distance to similarity
      metadata: {
        conversationId: row.conversation_id,
        messageId: row.message_id,
        role: row.role,
      },
      conversationId: row.conversation_id as string,
      conversationTitle: row.conversation_title as string,
      messageRole: row.role as string,
    }));
  }

  /**
   * Search for similar summaries by embedding
   */
  searchSummaries(queryEmbedding: number[], limit: number = 20): SearchResult[] {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    const results = this.db.prepare(`
      SELECT
        vec_summaries.id,
        vec_summaries.conversation_id,
        vec_summaries.distance,
        conversations.title,
        conversations.summary as content
      FROM vec_summaries
      JOIN conversations ON conversations.id = vec_summaries.conversation_id
      WHERE embedding MATCH ? AND k = ?
      ORDER BY distance
    `).all(this.embeddingToJson(queryEmbedding), limit) as Array<Record<string, unknown>>;

    return results.map(row => ({
      id: row.id as string,
      content: row.content as string || row.title as string,
      similarity: 1 - (row.distance as number),
      metadata: { title: row.title },
      conversationId: row.conversation_id as string,
      conversationTitle: row.title as string,
    }));
  }

  /**
   * Search for similar paragraphs
   */
  searchParagraphs(queryEmbedding: number[], limit: number = 20): SearchResult[] {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    const results = this.db.prepare(`
      SELECT
        vec_paragraphs.id,
        vec_paragraphs.conversation_id,
        vec_paragraphs.message_id,
        vec_paragraphs.chunk_index,
        vec_paragraphs.distance,
        chunks.content,
        conversations.title as conversation_title
      FROM vec_paragraphs
      JOIN chunks ON chunks.id = vec_paragraphs.id
      JOIN conversations ON conversations.id = vec_paragraphs.conversation_id
      WHERE embedding MATCH ? AND k = ?
      ORDER BY distance
    `).all(this.embeddingToJson(queryEmbedding), limit) as Array<Record<string, unknown>>;

    return results.map(row => ({
      id: row.id as string,
      content: row.content as string,
      similarity: 1 - (row.distance as number),
      metadata: {
        conversationId: row.conversation_id,
        messageId: row.message_id,
        chunkIndex: row.chunk_index,
      },
      conversationId: row.conversation_id as string,
      conversationTitle: row.conversation_title as string,
    }));
  }

  /**
   * Find messages similar to a given message embedding ID
   */
  findSimilarToMessage(embeddingId: string, limit: number = 20, excludeSameConversation: boolean = false): SearchResult[] {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    // Get the embedding for the source message
    const source = this.db.prepare(`
      SELECT embedding, conversation_id FROM vec_messages WHERE id = ?
    `).get(embeddingId) as { embedding: string; conversation_id: string } | undefined;

    if (!source) return [];

    let query = `
      SELECT
        vec_messages.id,
        vec_messages.conversation_id,
        vec_messages.message_id,
        vec_messages.role,
        vec_messages.distance,
        messages.content,
        conversations.title as conversation_title
      FROM vec_messages
      JOIN messages ON messages.id = vec_messages.message_id
      JOIN conversations ON conversations.id = vec_messages.conversation_id
      WHERE embedding MATCH ? AND k = ?
        AND vec_messages.id != ?
    `;

    if (excludeSameConversation) {
      query += ` AND vec_messages.conversation_id != ?`;
    }

    query += ` ORDER BY distance`;

    const params = excludeSameConversation
      ? [source.embedding, limit + 1, embeddingId, source.conversation_id]  // +1 to account for filtering
      : [source.embedding, limit + 1, embeddingId];

    const results = this.db.prepare(query).all(...params) as Array<Record<string, unknown>>;

    return results.map(row => ({
      id: row.id as string,
      content: row.content as string,
      similarity: 1 - (row.distance as number),
      metadata: {
        conversationId: row.conversation_id,
        messageId: row.message_id,
        role: row.role,
      },
      conversationId: row.conversation_id as string,
      conversationTitle: row.conversation_title as string,
      messageRole: row.role as string,
    })).slice(0, limit);  // Limit after filtering
  }

  /**
   * Get an embedding vector by ID from any vec table
   */
  getEmbedding(table: 'messages' | 'summaries' | 'paragraphs' | 'sentences' | 'anchors' | 'clusters', id: string): number[] | null {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    const tableName = `vec_${table}`;
    const row = this.db.prepare(`SELECT embedding FROM ${tableName} WHERE id = ?`).get(id) as { embedding: Buffer | string } | undefined;
    if (!row) return null;

    return this.embeddingFromBinary(row.embedding);
  }

  /**
   * Get multiple embeddings by IDs
   */
  getEmbeddings(table: 'messages' | 'summaries' | 'paragraphs' | 'sentences', ids: string[]): Map<string, number[]> {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    const tableName = `vec_${table}`;
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT id, embedding FROM ${tableName} WHERE id IN (${placeholders})`).all(...ids) as Array<{ id: string; embedding: Buffer | string }>;

    const result = new Map<string, number[]>();
    for (const row of rows) {
      result.set(row.id, this.embeddingFromBinary(row.embedding));
    }
    return result;
  }

  /**
   * Get messages by embedding IDs with optional filters
   * Used for cluster member retrieval with filtering
   */
  getMessagesByEmbeddingIds(
    embeddingIds: string[],
    options: {
      roles?: ('user' | 'assistant' | 'system' | 'tool')[];
      excludeImagePrompts?: boolean;
      excludeShortMessages?: number; // exclude messages shorter than N chars
      limit?: number;
      offset?: number;
      groupByConversation?: boolean;
    } = {}
  ): {
    messages: Array<{
      embeddingId: string;
      messageId: string;
      conversationId: string;
      conversationTitle: string;
      role: string;
      content: string;
      createdAt: number;
    }>;
    total: number;
    byConversation?: Map<string, Array<{
      embeddingId: string;
      messageId: string;
      role: string;
      content: string;
      createdAt: number;
    }>>;
  } {
    if (embeddingIds.length === 0) {
      return { messages: [], total: 0 };
    }

    // Build query with filters
    const placeholders = embeddingIds.map(() => '?').join(',');
    let whereClause = `vec_messages.id IN (${placeholders})`;
    const params: (string | number)[] = [...embeddingIds];

    // Role filter
    if (options.roles && options.roles.length > 0) {
      const rolePlaceholders = options.roles.map(() => '?').join(',');
      whereClause += ` AND vec_messages.role IN (${rolePlaceholders})`;
      params.push(...options.roles);
    }

    // First get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM vec_messages
      JOIN messages ON messages.id = vec_messages.message_id
      WHERE ${whereClause}
    `;
    const countResult = this.db.prepare(countQuery).get(...params) as { total: number };
    let total = countResult.total;

    // Now get the actual data
    let query = `
      SELECT
        vec_messages.id as embedding_id,
        vec_messages.message_id,
        vec_messages.conversation_id,
        vec_messages.role,
        messages.content,
        messages.created_at,
        conversations.title as conversation_title
      FROM vec_messages
      JOIN messages ON messages.id = vec_messages.message_id
      JOIN conversations ON conversations.id = vec_messages.conversation_id
      WHERE ${whereClause}
      ORDER BY messages.created_at DESC
    `;

    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    if (options.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const rows = this.db.prepare(query).all(...params) as Array<Record<string, unknown>>;

    // Apply content-based filters in JS (more flexible)
    let messages = rows.map(row => ({
      embeddingId: row.embedding_id as string,
      messageId: row.message_id as string,
      conversationId: row.conversation_id as string,
      conversationTitle: row.conversation_title as string,
      role: row.role as string,
      content: row.content as string,
      createdAt: row.created_at as number,
    }));

    // Filter out image generation prompts (DALL-E style prompts)
    if (options.excludeImagePrompts) {
      const imagePromptPatterns = [
        /^(create|generate|draw|make|design|paint|illustrate)\s+(an?\s+)?(image|picture|photo|illustration|art|artwork|drawing)/i,
        /^(show me|can you (create|draw|make))/i,
        /\bDALL[-·]?E\b/i,
        /^(a |an )?[\w\s,]+\b(in the style of|digital art|oil painting|watercolor|photograph|3d render)/i,
      ];

      const beforeFilter = messages.length;
      messages = messages.filter(m => {
        const content = m.content.trim();
        return !imagePromptPatterns.some(pattern => pattern.test(content));
      });
      total -= (beforeFilter - messages.length);
    }

    // Filter short messages
    if (options.excludeShortMessages && options.excludeShortMessages > 0) {
      const beforeFilter = messages.length;
      messages = messages.filter(m => m.content.length >= options.excludeShortMessages!);
      total -= (beforeFilter - messages.length);
    }

    // Group by conversation if requested
    if (options.groupByConversation) {
      const byConversation = new Map<string, Array<{
        embeddingId: string;
        messageId: string;
        role: string;
        content: string;
        createdAt: number;
      }>>();

      for (const msg of messages) {
        const key = msg.conversationId;
        if (!byConversation.has(key)) {
          byConversation.set(key, []);
        }
        byConversation.get(key)!.push({
          embeddingId: msg.embeddingId,
          messageId: msg.messageId,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
        });
      }

      return { messages, total, byConversation };
    }

    return { messages, total };
  }

  /**
   * Get vector statistics
   */
  getVectorStats(): {
    summaryCount: number;
    messageCount: number;
    paragraphCount: number;
    sentenceCount: number;
    anchorCount: number;
    clusterCount: number;
  } {
    if (!this.vecLoaded) {
      return { summaryCount: 0, messageCount: 0, paragraphCount: 0, sentenceCount: 0, anchorCount: 0, clusterCount: 0 };
    }

    const summaryCount = this.db.prepare('SELECT COUNT(*) as count FROM vec_summaries').get() as { count: number };
    const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM vec_messages').get() as { count: number };
    const paragraphCount = this.db.prepare('SELECT COUNT(*) as count FROM vec_paragraphs').get() as { count: number };
    const sentenceCount = this.db.prepare('SELECT COUNT(*) as count FROM vec_sentences').get() as { count: number };
    const anchorCount = this.db.prepare('SELECT COUNT(*) as count FROM vec_anchors').get() as { count: number };
    const clusterCount = this.db.prepare('SELECT COUNT(*) as count FROM vec_clusters').get() as { count: number };

    return {
      summaryCount: summaryCount.count,
      messageCount: messageCount.count,
      paragraphCount: paragraphCount.count,
      sentenceCount: sentenceCount.count,
      anchorCount: anchorCount.count,
      clusterCount: clusterCount.count,
    };
  }

  /**
   * Check if vector operations are available
   */
  hasVectorSupport(): boolean {
    return this.vecLoaded;
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  getStats(): {
    conversationCount: number;
    messageCount: number;
    chunkCount: number;
    interestingCount: number;
    clusterCount: number;
    anchorCount: number;
  } {
    const convCount = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
    const msgCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
    const chunkCount = this.db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number };
    const interestingCount = this.db.prepare('SELECT COUNT(*) as count FROM conversations WHERE is_interesting = 1').get() as { count: number };
    const clusterCount = this.db.prepare('SELECT COUNT(*) as count FROM clusters').get() as { count: number };
    const anchorCount = this.db.prepare('SELECT COUNT(*) as count FROM anchors').get() as { count: number };

    return {
      conversationCount: convCount.count,
      messageCount: msgCount.count,
      chunkCount: chunkCount.count,
      interestingCount: interestingCount.count,
      clusterCount: clusterCount.count,
      anchorCount: anchorCount.count,
    };
  }

  // ===========================================================================
  // Content Items (Facebook posts, comments, etc.)
  // ===========================================================================

  insertContentItem(item: {
    id: string;
    type: string;
    source: string;
    text?: string;
    title?: string;
    created_at: number;
    updated_at?: number;
    author_name?: string;
    author_id?: string;
    is_own_content: boolean;
    parent_id?: string;
    thread_id?: string;
    context?: string;
    file_path?: string;
    media_refs?: string;
    media_count?: number;
    metadata?: string;
    tags?: string;
    search_text?: string;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO content_items (
        id, type, source, text, title, created_at, updated_at,
        author_name, author_id, is_own_content, parent_id, thread_id,
        context, file_path, media_refs, media_count, metadata, tags, search_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.type,
      item.source,
      item.text,
      item.title,
      item.created_at,
      item.updated_at,
      item.author_name,
      item.author_id,
      item.is_own_content ? 1 : 0,
      item.parent_id,
      item.thread_id,
      item.context,
      item.file_path,
      item.media_refs,
      item.media_count,
      item.metadata,
      item.tags,
      item.search_text
    );
  }

  insertContentItemsBatch(items: Array<{
    id: string;
    type: string;
    source: string;
    text?: string;
    title?: string;
    created_at: number;
    updated_at?: number;
    author_name?: string;
    author_id?: string;
    is_own_content: boolean;
    parent_id?: string;
    thread_id?: string;
    context?: string;
    file_path?: string;
    media_refs?: string;
    media_count?: number;
    metadata?: string;
    tags?: string;
    search_text?: string;
  }>): void {
    const insertMany = this.db.transaction((items: any[]) => {
      for (const item of items) {
        this.insertContentItem(item);
      }
    });

    insertMany(items);
  }

  getContentItem(id: string): any | null {
    const row = this.db.prepare('SELECT * FROM content_items WHERE id = ?').get(id);
    return row || null;
  }

  getContentItemsBySource(source: string): any[] {
    return this.db.prepare('SELECT * FROM content_items WHERE source = ? ORDER BY created_at DESC').all(source);
  }

  getContentItemsByType(type: string): any[] {
    return this.db.prepare('SELECT * FROM content_items WHERE type = ? ORDER BY created_at DESC').all(type);
  }

  /**
   * Insert content item embedding into vec_content_items
   */
  insertContentItemEmbedding(
    id: string,
    contentItemId: string,
    type: string,
    source: string,
    embedding: number[]
  ): void {
    if (!this.vecLoaded) throw new Error('Vector operations not available');
    this.db.prepare(`
      INSERT OR REPLACE INTO vec_content_items (id, content_item_id, type, source, embedding)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, contentItemId, type, source, this.embeddingToJson(embedding));
  }

  /**
   * Search content items by semantic similarity
   */
  searchContentItems(
    queryEmbedding: number[],
    limit: number = 20,
    type?: string,
    source?: string
  ): Array<{ id: string; content_item_id: string; type: string; source: string; distance: number }> {
    if (!this.vecLoaded) throw new Error('Vector operations not available');

    let sql = `
      SELECT id, content_item_id, type, source, distance
      FROM vec_content_items
      WHERE embedding MATCH ?
    `;

    const params: any[] = [this.embeddingToJson(queryEmbedding)];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (source) {
      sql += ` AND source = ?`;
      params.push(source);
    }

    sql += ` ORDER BY distance LIMIT ?`;
    params.push(limit);

    return this.db.prepare(sql).all(...params) as any[];
  }

  // ===========================================================================
  // Reactions
  // ===========================================================================

  insertReaction(reaction: {
    id: string;
    content_item_id: string;
    reaction_type: string;
    reactor_name?: string;
    reactor_id?: string;
    created_at: number;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO reactions (
        id, content_item_id, reaction_type, reactor_name, reactor_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      reaction.id,
      reaction.content_item_id,
      reaction.reaction_type,
      reaction.reactor_name,
      reaction.reactor_id,
      reaction.created_at
    );
  }

  insertReactionsBatch(reactions: Array<{
    id: string;
    content_item_id: string;
    reaction_type: string;
    reactor_name?: string;
    reactor_id?: string;
    created_at: number;
  }>): void {
    const insertMany = this.db.transaction((reactions: any[]) => {
      for (const reaction of reactions) {
        this.insertReaction(reaction);
      }
    });

    insertMany(reactions);
  }

  getReactionsForContentItem(contentItemId: string): any[] {
    return this.db.prepare('SELECT * FROM reactions WHERE content_item_id = ? ORDER BY created_at DESC').all(contentItemId);
  }

  // ===========================================================================
  // Import Tracking
  // ===========================================================================

  createImport(params: {
    id: string;
    source: string;
    sourcePath?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.db.prepare(`
      INSERT INTO imports (id, source, source_path, status, created_at, metadata)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(
      params.id,
      params.source,
      params.sourcePath || null,
      Date.now(),
      params.metadata ? JSON.stringify(params.metadata) : null
    );
  }

  startImport(id: string): void {
    this.db.prepare(`
      UPDATE imports SET status = 'processing', started_at = ? WHERE id = ?
    `).run(Date.now(), id);
  }

  completeImport(id: string, stats: {
    threadCount: number;
    messageCount: number;
    mediaCount: number;
    totalWords: number;
  }): void {
    this.db.prepare(`
      UPDATE imports SET
        status = 'completed',
        completed_at = ?,
        thread_count = ?,
        message_count = ?,
        media_count = ?,
        total_words = ?
      WHERE id = ?
    `).run(
      Date.now(),
      stats.threadCount,
      stats.messageCount,
      stats.mediaCount,
      stats.totalWords,
      id
    );
  }

  failImport(id: string, errorMessage: string): void {
    this.db.prepare(`
      UPDATE imports SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?
    `).run(Date.now(), errorMessage, id);
  }

  getImport(id: string): Record<string, unknown> | null {
    return this.db.prepare('SELECT * FROM imports WHERE id = ?').get(id) as Record<string, unknown> | null;
  }

  getImportsByStatus(status: string): Record<string, unknown>[] {
    return this.db.prepare('SELECT * FROM imports WHERE status = ? ORDER BY created_at DESC').all(status) as Record<string, unknown>[];
  }

  getAllImports(): Record<string, unknown>[] {
    return this.db.prepare('SELECT * FROM imports ORDER BY created_at DESC').all() as Record<string, unknown>[];
  }

  deleteImport(id: string): boolean {
    const result = this.db.prepare('DELETE FROM imports WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ===========================================================================
  // Database Access (for PyramidService)
  // ===========================================================================

  /**
   * Get the underlying database instance for use by other services
   * (e.g., PyramidService that needs to share the same database)
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  close(): void {
    this.db.close();
  }
}
