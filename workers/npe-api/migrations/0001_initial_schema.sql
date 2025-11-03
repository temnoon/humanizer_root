-- Narrative Projection Engine - D1 Database Schema
-- Initial migration for cloud service

-- User accounts
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_login INTEGER
);

CREATE INDEX idx_users_email ON users(email);

-- NPE Personas (narrator voices)
CREATE TABLE IF NOT EXISTS npe_personas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    system_prompt TEXT NOT NULL
);

-- NPE Namespaces (fictional universes)
CREATE TABLE IF NOT EXISTS npe_namespaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    context_prompt TEXT NOT NULL
);

-- NPE Language Styles
CREATE TABLE IF NOT EXISTS npe_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    style_prompt TEXT NOT NULL
);

-- Transformation history
CREATE TABLE IF NOT EXISTS transformations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('allegorical', 'round_trip', 'maieutic')),
    source_text TEXT NOT NULL,
    result_text TEXT,
    parameters TEXT, -- JSON blob
    trm_evaluation TEXT, -- JSON blob (optional TRM measurements)
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_transformations_user ON transformations(user_id);
CREATE INDEX idx_transformations_type ON transformations(type);
CREATE INDEX idx_transformations_created ON transformations(created_at);

-- Allegorical projections (5-stage pipeline)
CREATE TABLE IF NOT EXISTS allegorical_projections (
    id TEXT PRIMARY KEY,
    transformation_id TEXT NOT NULL UNIQUE,
    persona_id INTEGER NOT NULL,
    namespace_id INTEGER NOT NULL,
    style_id INTEGER NOT NULL,
    stage_1_deconstruct TEXT,
    stage_2_map TEXT,
    stage_3_reconstruct TEXT,
    stage_4_stylize TEXT,
    stage_5_reflect TEXT,
    FOREIGN KEY (transformation_id) REFERENCES transformations(id) ON DELETE CASCADE,
    FOREIGN KEY (persona_id) REFERENCES npe_personas(id),
    FOREIGN KEY (namespace_id) REFERENCES npe_namespaces(id),
    FOREIGN KEY (style_id) REFERENCES npe_styles(id)
);

-- Round-trip translations
CREATE TABLE IF NOT EXISTS round_trip_translations (
    id TEXT PRIMARY KEY,
    transformation_id TEXT NOT NULL UNIQUE,
    intermediate_language TEXT NOT NULL,
    forward_translation TEXT,
    backward_translation TEXT,
    semantic_drift REAL,
    preserved_elements TEXT, -- JSON array
    lost_elements TEXT, -- JSON array
    gained_elements TEXT, -- JSON array
    FOREIGN KEY (transformation_id) REFERENCES transformations(id) ON DELETE CASCADE
);

-- Maieutic dialogue sessions (Socratic questioning)
CREATE TABLE IF NOT EXISTS maieutic_sessions (
    id TEXT PRIMARY KEY,
    transformation_id TEXT NOT NULL UNIQUE,
    goal TEXT NOT NULL,
    final_understanding TEXT,
    extracted_elements TEXT, -- JSON array
    created_at INTEGER NOT NULL,
    FOREIGN KEY (transformation_id) REFERENCES transformations(id) ON DELETE CASCADE
);

-- Maieutic dialogue turns
CREATE TABLE IF NOT EXISTS maieutic_turns (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    depth_level INTEGER NOT NULL CHECK(depth_level >= 0 AND depth_level <= 4),
    question TEXT NOT NULL,
    answer TEXT,
    insights TEXT, -- JSON array
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES maieutic_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_maieutic_turns_session ON maieutic_turns(session_id);
CREATE INDEX idx_maieutic_turns_number ON maieutic_turns(turn_number);
