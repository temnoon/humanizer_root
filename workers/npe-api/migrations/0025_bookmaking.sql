-- Bookmaking Tool - D1 Database Schema
-- Phase 1: Core book structure with chapters, sections, pages, and annotations

-- Books (main container)
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    author TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'unlisted', 'public')),
    settings TEXT, -- JSON: theme, fontSize, fontFamily, showProvenance, showAnnotations, enableCurator
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_books_user ON books(user_id);
CREATE INDEX idx_books_visibility ON books(visibility);
CREATE INDEX idx_books_updated ON books(updated_at DESC);

-- Chapters
CREATE TABLE IF NOT EXISTS book_chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    epigraph TEXT,
    summary TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX idx_chapters_book ON book_chapters(book_id);
CREATE INDEX idx_chapters_order ON book_chapters(book_id, order_index);

-- Sections (within chapters)
CREATE TABLE IF NOT EXISTS book_sections (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    title TEXT,
    order_index INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES book_chapters(id) ON DELETE CASCADE
);

CREATE INDEX idx_sections_chapter ON book_sections(chapter_id);
CREATE INDEX idx_sections_order ON book_sections(chapter_id, order_index);

-- Pages (core content unit)
CREATE TABLE IF NOT EXISTS book_pages (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    content TEXT NOT NULL, -- Markdown/HTML content
    content_type TEXT NOT NULL DEFAULT 'text' CHECK(content_type IN ('text', 'conversation', 'image', 'embed')),
    original_content TEXT, -- If transformed, the original version
    source TEXT NOT NULL, -- JSON: type, archiveName, conversationId, url, etc.
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (section_id) REFERENCES book_sections(id) ON DELETE CASCADE
);

CREATE INDEX idx_pages_section ON book_pages(section_id);
CREATE INDEX idx_pages_order ON book_pages(section_id, order_index);

-- Annotations (marginalia on pages)
CREATE TABLE IF NOT EXISTS book_annotations (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('highlight', 'note', 'question', 'link', 'definition')),
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    selected_text TEXT NOT NULL,
    content TEXT NOT NULL,
    curator_response TEXT, -- For questions answered by curator
    linked_page_id TEXT, -- For cross-reference links
    linked_url TEXT,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (page_id) REFERENCES book_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_page_id) REFERENCES book_pages(id) ON DELETE SET NULL
);

CREATE INDEX idx_annotations_page ON book_annotations(page_id);
CREATE INDEX idx_annotations_type ON book_annotations(type);

-- Page transformations (tool applications)
CREATE TABLE IF NOT EXISTS book_page_transformations (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    parameters TEXT, -- JSON
    input_content TEXT NOT NULL,
    output_content TEXT NOT NULL,
    analysis_result TEXT, -- JSON for analysis tools
    applied_at INTEGER NOT NULL,
    applied_by TEXT NOT NULL,
    FOREIGN KEY (page_id) REFERENCES book_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (applied_by) REFERENCES users(id)
);

CREATE INDEX idx_page_transformations_page ON book_page_transformations(page_id);
CREATE INDEX idx_page_transformations_tool ON book_page_transformations(tool_id);

-- Curator threads (conversations about pages)
CREATE TABLE IF NOT EXISTS book_curator_threads (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    messages TEXT NOT NULL, -- JSON array of messages
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (page_id) REFERENCES book_pages(id) ON DELETE CASCADE
);

CREATE INDEX idx_curator_threads_page ON book_curator_threads(page_id);

-- Book statistics (denormalized for performance)
CREATE TABLE IF NOT EXISTS book_stats (
    book_id TEXT PRIMARY KEY,
    word_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 0,
    chapter_count INTEGER NOT NULL DEFAULT 0,
    source_count INTEGER NOT NULL DEFAULT 0,
    annotation_count INTEGER NOT NULL DEFAULT 0,
    curator_conversations INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Import jobs (for async imports)
CREATE TABLE IF NOT EXISTS book_import_jobs (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('archive', 'gutenberg', 'notes', 'folder', 'url')),
    source_params TEXT NOT NULL, -- JSON
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0, -- 0-100
    result TEXT, -- JSON: created page IDs, errors
    error TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_import_jobs_book ON book_import_jobs(book_id);
CREATE INDEX idx_import_jobs_status ON book_import_jobs(status);
