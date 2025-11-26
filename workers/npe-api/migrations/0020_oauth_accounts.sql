-- Migration: OAuth accounts for social login
-- Created: 2025-11-24
-- Phase 2: OAuth Implementation

-- OAuth accounts table - links external providers to users
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('google', 'github', 'discord', 'facebook', 'apple')),
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_username TEXT,
    provider_avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_user ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_provider ON oauth_accounts(provider);
CREATE INDEX idx_oauth_lookup ON oauth_accounts(provider, provider_user_id);

-- OAuth state table - CSRF protection for OAuth flow
CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    redirect_uri TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- Modify users table to allow OAuth-only accounts (no password)
-- SQLite doesn't support ALTER COLUMN, so we need to handle this in code
-- Users created via OAuth will have password_hash = 'OAUTH_ONLY'

-- Add auth_method field to track how user was created
ALTER TABLE users ADD COLUMN auth_method TEXT DEFAULT 'password'
  CHECK(auth_method IN ('password', 'oauth', 'webauthn', 'mixed'));

-- Update existing users to have 'password' auth_method
UPDATE users SET auth_method = 'password' WHERE auth_method IS NULL;
