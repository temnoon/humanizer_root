/**
 * Archive Parser Module
 *
 * Exports all parser components for conversation archive import.
 * Supports OpenAI, Claude, Facebook, Reddit, Twitter, Instagram, Substack exports.
 *
 * Key exports:
 * - ConversationParser: Main orchestrator for parsing archives
 * - OpenAIParser, ClaudeParser, FacebookParser, etc: Format-specific parsers
 * - ComprehensiveMediaIndexer: Builds multiple indices for media files
 * - ComprehensiveMediaMatcher: 7-strategy media matching algorithm
 * - MediaReferenceExtractor: Extracts all media references from conversations
 */

// Main orchestrator
export { ConversationParser } from './ConversationParser.js';

// Format-specific parsers
export { OpenAIParser } from './OpenAIParser.js';
export { ClaudeParser } from './ClaudeParser.js';
export { FacebookParser } from './FacebookParser.js';
export { BrowserPluginParser } from './BrowserPluginParser.js';
export { RedditParser } from './RedditParser.js';
export { TwitterParser } from './TwitterParser.js';
export { InstagramParser } from './InstagramParser.js';
export { SubstackParser } from './SubstackParser.js';

// Media indexing and matching
export { ComprehensiveMediaIndexer } from './ComprehensiveMediaIndexer.js';
export type { FileMetadata, MediaIndex, IndexStats } from './ComprehensiveMediaIndexer.js';

export { ComprehensiveMediaMatcher } from './ComprehensiveMediaMatcher.js';
export type { MatcherStats, ConversationWithMedia } from './ComprehensiveMediaMatcher.js';

export { MediaReferenceExtractor } from './MediaReferenceExtractor.js';
export type {
  AssetPointerRef,
  AttachmentRef,
  DalleGenerationRef,
  TextRef,
  MediaReferences,
} from './MediaReferenceExtractor.js';

// Types
export type {
  ExportFormat,
  ContentType,
  AuthorRole,
  MessageAuthor,
  MessageContent,
  MessageAttachment,
  MessageMetadata,
  Message,
  ConversationNode,
  ConversationMapping,
  Conversation,
  MediaFile,
  FileIndices,
  ParsedArchive,
  ImportJob,
  ImportPreview,
  ImportConflict,
  MergeResult,
  ImportResult,
  ClaudeExport,
  ClaudeChatMessage,
  MatchStrategy,
  MatchStats,
} from './types.js';

// Database import
export { importArchiveToDb, runImportCli } from './import-to-db.js';
export type { ImportResult as ArchiveImportResult } from './import-to-db.js';

// Utility functions
export {
  extractZip,
  findFiles,
  hashFile,
  hashContent,
  sanitizeFilename,
  formatDate,
  generateFolderName,
  parseISOTimestamp,
  getFileSize,
  getFileExtension,
  isMediaFile,
  ensureDir,
  copyFile,
  deepClone,
  extractFileId,
  readJSON,
  writeJSON,
  generateId,
  isDirectoryNonEmpty,
} from './utils.js';
