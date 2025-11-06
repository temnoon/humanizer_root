-- Migration 0008: API Keys and Model Preferences
-- Created: Nov 6, 2025
-- Purpose: Enable user-specific LLM model selection and secure API key storage for external providers

-- Add encrypted API key columns for external providers (PRO+ users only)
ALTER TABLE users ADD COLUMN openai_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN anthropic_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN google_api_key_encrypted TEXT;

-- Add model and length preferences
ALTER TABLE users ADD COLUMN preferred_model TEXT DEFAULT '@cf/meta/llama-3.1-8b-instruct';
ALTER TABLE users ADD COLUMN preferred_length TEXT DEFAULT 'same'
  CHECK(preferred_length IN ('shorter', 'same', 'longer', 'much_longer'));

-- Add audit timestamp for API key updates
ALTER TABLE users ADD COLUMN api_keys_updated_at INTEGER;

-- Note: API keys are encrypted using AES-GCM with key derived from SHA-256(JWT_SECRET + user_id)
-- Storage format: base64(iv):base64(encrypted_data)
-- Access restricted to PRO, PREMIUM, and ADMIN tiers (enforced in application layer)
