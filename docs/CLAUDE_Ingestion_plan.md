Claude Conversation Archive Import System - Implementation Plan

 Overview

 Add support for importing Anthropic/Claude conversation archives alongside the existing ChatGPT import system. The system will handle zip
 files or extracted directories, support incremental imports with deduplication, and preserve all media attachments.

 Architecture Decision: Separate Tables

 Rationale:
 - Claude has unique features (Projects with docs, different attachment model)
 - Different message content structure (content blocks vs ChatGPT's content.parts)
 - Cleaner separation of concerns
 - Easier to maintain provider-specific features
 - Can share common patterns/utilities

 Database Schema (4 New Tables)

 1. claude_conversations

 - uuid (PG_UUID, PRIMARY KEY) - Claude conversation UUID
 - name (Text, nullable) - Conversation title
 - summary (Text, nullable) - Conversation summary
 - created_at (DateTime)
 - updated_at (DateTime)
 - account_uuid (PG_UUID) - User account UUID
 - project_uuid (PG_UUID, nullable) - Associated project
 - source_archive (String) - e.g., "data-2025-10-25"
 - custom_metadata (JSONB) - Full original JSON

 2. claude_messages

 - uuid (PG_UUID, PRIMARY KEY) - Claude message UUID
 - conversation_uuid (FK to claude_conversations)
 - sender (String) - 'human' or 'assistant'
 - text (Text) - Extracted text content
 - content_blocks (JSONB) - Original content array
 - created_at (DateTime)
 - updated_at (DateTime)
 - custom_metadata (JSONB) - Full original JSON
 - embedding (Vector(1024), nullable) - Semantic embedding

 3. claude_media

 - id (SERIAL, PRIMARY KEY)
 - conversation_uuid (FK)
 - message_uuid (FK, nullable)
 - file_name (String)
 - file_path (Text, nullable) - Actual file on disk
 - file_type (String, nullable) - 'txt', 'image', etc
 - file_size (Integer, nullable)
 - extracted_content (Text, nullable) - From attachments
 - source_archive (String)
 - mime_type (String, nullable)
 - file_metadata (JSONB)

 4. claude_projects

 - uuid (PG_UUID, PRIMARY KEY)
 - name (String)
 - description (Text, nullable)
 - is_private (Boolean)
 - is_starter_project (Boolean)
 - prompt_template (Text, nullable)
 - created_at (DateTime)
 - updated_at (DateTime)
 - creator_uuid (PG_UUID)
 - docs (JSONB) - Array of project docs
 - custom_metadata (JSONB)

 5. claude_provenance (optional, like ChatGPT)

 - conversation_uuid (FK, composite PK)
 - archive_name (String, composite PK)
 - archive_date (DateTime)
 - message_count (Integer)

 Implementation Files (Mirror ChatGPT Structure)

 Backend Files (9 new files)

 1. Models (humanizer/models/claude.py, ~200 lines)
 - ClaudeConversation
 - ClaudeMessage
 - ClaudeMedia
 - ClaudeProject
 - ClaudeProvenance

 2. Schemas (humanizer/models/schemas.py, +300 lines)
 - ClaudeIngestRequest
 - ClaudeIngestResponse
 - ClaudeConversationResponse
 - ClaudeMessageResponse
 - ClaudeSearchRequest/Response
 - ClaudeProjectResponse

 3. Service (humanizer/services/claude.py, ~900 lines)
 - find_archives() - Discover zip or directories
 - extract_archive() - Handle zip extraction
 - parse_conversations_json() - Parse conversations.json
 - parse_projects_json() - Parse projects.json
 - extract_media_references() - Find file references
 - find_media_file() - Locate actual files in UUID dirs
 - save_conversation() - Persist to DB with deduplication
 - save_project() - Store project data
 - merge_conversation_versions() - Handle re-imports
 - get_conversation() - Retrieve by UUID
 - search_messages() - Text search
 - list_conversations() - Paginated list
 - get_archive_stats() - Statistics

 4. API Router (humanizer/api/claude.py, ~300 lines)
 - POST /api/claude/ingest - Import archive
 - GET /api/claude/stats - Archive statistics
 - GET /api/claude/conversations - List conversations
 - GET /api/claude/conversation/{uuid} - Get single
 - POST /api/claude/search - Search messages
 - GET /api/claude/projects - List projects
 - GET /api/claude/project/{uuid} - Get project

 5. Alembic Migration (alembic/versions/xxx_add_claude_tables.py)
 - Create all 5 tables
 - Add indexes (conversation_uuid, message_uuid, sender, created_at)
 - Add vector extension if needed

 Archive Processing Logic

 Key Functions:

 1. Archive Discovery
 def find_archives(path: str, pattern: str = "data-*") -> List[str]:
     # Support both:
     # - Zip files: ~/Downloads/data-2025-10-25-*.zip
     # - Directories: ~/Downloads/data-2025-10-25-*/
     # - Auto-extracted: Check for conversations.json

 2. Deduplication Strategy
 - Conversation: UUID-based (skip if exists and not force_reimport)
 - Message: UUID-based (skip if exists)
 - Media: By file_name + conversation_uuid
 - Project: UUID-based

 3. Media Matching
 - Message has files array: [{file_name: "image.jpg"}]
 - Search: {conversation_uuid}/ directory for matching filename
 - Also check for attachments with extracted_content (text files)
 - Store both file path and extracted content

 4. Incremental Import
 - Check existing conversations by UUID
 - For existing: Only add new messages (by message UUID)
 - Update conversation metadata if newer updated_at
 - Link new media if found

 Deduplication Details

 Conversation Level:
 # Check if conversation exists
 existing = session.query(ClaudeConversation).filter_by(uuid=conv_uuid).first()

 if existing and not force_reimport:
     # Incremental: Add only new messages
     existing_msg_uuids = {m.uuid for m in existing.messages}
     new_messages = [m for m in messages if m['uuid'] not in existing_msg_uuids]
     # Update metadata if newer
     if conv['updated_at'] > existing.updated_at:
         existing.updated_at = conv['updated_at']
         existing.custom_metadata = conv
 else:
     # Create new conversation

 Media Deduplication:
 # Check if media already exists
 existing_media = session.query(ClaudeMedia).filter_by(
     conversation_uuid=conv_uuid,
     file_name=file_name
 ).first()

 if existing_media:
     # Update file_path if we found actual file
     if not existing_media.file_path and found_path:
         existing_media.file_path = found_path
 else:
     # Create new media record

 Testing (3 test files)

 1. Test Service (tests/test_claude_service.py)
 - Archive parsing
 - Deduplication logic
 - Media matching
 - Incremental imports

 2. Test API (tests/test_claude_api.py)
 - Ingest endpoint
 - Search/list endpoints
 - Response validation

 3. Test Integration (tests/test_claude_integration.py)
 - Full import workflow
 - Cross-archive deduplication
 - Media preservation

 Migration Path

 Alembic Migration Steps:
 1. Create claude_conversations table
 2. Create claude_messages table
 3. Create claude_media table
 4. Create claude_projects table
 5. Create claude_provenance table
 6. Add indexes and foreign keys
 7. Add pgvector extension if not present

 Frontend Integration (Optional Phase 2)

 - Add Claude archive selector to upload UI
 - Unified conversation viewer (supports both ChatGPT and Claude)
 - Archive source indicator
 - Project browser for Claude-specific feature

 Key Design Decisions

 1. Separate vs Unified Tables: SEPARATE
 - Cleaner architecture
 - Easier to maintain provider-specific features
 - Can still implement unified search/viewer in frontend

 2. Media Storage: IN_PLACE (like ChatGPT)
 - Reference files at original archive location
 - Option for CENTRALIZED later

 3. Projects: Claude-Specific Feature
 - Store in separate table
 - Link conversations to projects via project_uuid

 4. Content Blocks: Preserve Original Structure
 - Store in JSONB as content_blocks
 - Extract text to text field for search
 - Attachments.extracted_content → separate field in claude_media

 Timeline Estimate

 - Database Models: 2 hours (mirror ChatGPT structure)
 - Service Layer: 6 hours (adapt ChatGPT logic to Claude format)
 - API Layer: 2 hours (mirror ChatGPT endpoints)
 - Alembic Migration: 1 hour
 - Testing: 3 hours
 - Documentation: 1 hour

 Total: ~15 hours of development

 Success Criteria

 ✅ Import 357 conversations from your archive✅ 4,710 messages correctly parsed✅ Media files (attachments and files) located and linked✅
  Deduplication: Re-importing same archive adds 0 duplicates✅ Incremental: New messages in existing conversations imported✅ Projects: All
  3 projects parsed and stored✅ Search: Full-text search across Claude messages✅ Performance: Import completes in <2 minutes for 357
 conversations

 Files to Create

 1. humanizer/models/claude.py (~200 lines)
 2. humanizer/services/claude.py (~900 lines)
 3. humanizer/api/claude.py (~300 lines)
 4. alembic/versions/xxx_add_claude_tables.py (~150 lines)
 5. tests/test_claude_service.py (~300 lines)
 6. tests/test_claude_api.py (~200 lines)
 7. humanizer/models/schemas.py (+300 lines for Claude schemas)

 Total: ~2,350 new lines of code
