// ============================================================
// ARCHIVE PARSER - Main Exports
// ============================================================

// Core parsers
export { ConversationParser } from './ConversationParser';
export { OpenAIParser } from './OpenAIParser';
export { ClaudeParser } from './ClaudeParser';
export { FacebookParser } from './FacebookParser';
export { ChromePluginParser } from './ChromePluginParser';

// Original media handling (basic)
export { MediaIndexer } from './MediaIndexer';
export { MediaMatcher } from './MediaMatcher';

// NEW: Comprehensive media handling (7 strategies - ported from Python)
export { MediaReferenceExtractor } from './MediaReferenceExtractor';
export type { AssetPointerRef, AttachmentRef, DalleGenerationRef, TextRef, MediaReferences } from './MediaReferenceExtractor';

export { ComprehensiveMediaIndexer } from './ComprehensiveMediaIndexer';
export type { FileMetadata, MediaIndex, IndexStats } from './ComprehensiveMediaIndexer';

export { ComprehensiveMediaMatcher } from './ComprehensiveMediaMatcher';
export type { MatcherStats, ConversationWithMedia } from './ComprehensiveMediaMatcher';

export { ConversationOrganizer } from './ConversationOrganizer';
export type { OrganizerStats, MediaMapping, AssetFile } from './ConversationOrganizer';

// Importer
export { IncrementalImporter } from './IncrementalImporter';

export * from './types';
export * from './utils';
