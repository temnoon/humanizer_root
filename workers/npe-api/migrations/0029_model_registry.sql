-- Migration 0029: Model Registry and Enhanced LLM Abstraction
-- Created: Dec 12, 2025
-- Purpose: Dynamic model configuration, per-use-case preferences, Groq provider support

-- Add Groq API key column to users table
ALTER TABLE users ADD COLUMN groq_api_key_encrypted TEXT;

-- Model Registry: Central repository of all available LLM models
CREATE TABLE IF NOT EXISTS model_registry (
    id TEXT PRIMARY KEY,                              -- e.g., 'cf-llama-3.1-70b', 'openai-gpt-4o'
    provider TEXT NOT NULL,                           -- cloudflare, openai, anthropic, google, groq, ollama
    model_id TEXT NOT NULL,                           -- Actual model identifier: @cf/meta/llama-3.1-70b-instruct, gpt-4o, etc.
    display_name TEXT NOT NULL,                       -- Human-readable name
    capabilities TEXT NOT NULL DEFAULT '[]',          -- JSON array: ["persona", "style", "translation", "embedding", "detection"]
    context_window INTEGER DEFAULT 8192,              -- Maximum context size in tokens
    cost_per_1k_input REAL DEFAULT 0,                 -- Cost per 1000 input tokens (0 for Cloudflare/Ollama)
    cost_per_1k_output REAL DEFAULT 0,                -- Cost per 1000 output tokens
    requires_api_key INTEGER DEFAULT 0,               -- 1 if user must provide API key, 0 for Cloudflare models
    tier_required TEXT DEFAULT 'free',                -- Minimum tier: free, pro, premium, admin
    status TEXT DEFAULT 'active',                     -- active, beta, deprecated, disabled
    output_filter_strategy TEXT DEFAULT 'heuristic',  -- Model vetting strategy: heuristic, xml-tags, structured, none
    notes TEXT,                                       -- Admin notes about model behavior
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for common queries
CREATE INDEX idx_model_registry_provider ON model_registry(provider);
CREATE INDEX idx_model_registry_status ON model_registry(status);
CREATE INDEX idx_model_registry_tier ON model_registry(tier_required);

-- User Model Preferences: Per-use-case model selection
CREATE TABLE IF NOT EXISTS user_model_preferences (
    user_id TEXT NOT NULL,
    use_case TEXT NOT NULL,                           -- persona, style, translation, round_trip, detection, general
    model_id TEXT NOT NULL,                           -- References model_registry.id
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, use_case),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed default models in registry

-- Cloudflare models (free, no API key required)
INSERT INTO model_registry (id, provider, model_id, display_name, capabilities, context_window, requires_api_key, tier_required, status, output_filter_strategy)
VALUES
    ('cf-llama-3.1-70b', 'cloudflare', '@cf/meta/llama-3.1-70b-instruct', 'Llama 3.1 70B (Cloudflare)', '["persona", "style", "translation", "general"]', 128000, 0, 'free', 'active', 'heuristic'),
    ('cf-llama-3.1-8b', 'cloudflare', '@cf/meta/llama-3.1-8b-instruct', 'Llama 3.1 8B (Cloudflare)', '["detection", "general"]', 128000, 0, 'free', 'active', 'heuristic'),
    ('cf-llama-3.3-70b', 'cloudflare', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Llama 3.3 70B Fast (Cloudflare)', '["persona", "style", "translation", "general"]', 128000, 0, 'free', 'active', 'heuristic');

-- OpenAI models (requires API key)
INSERT INTO model_registry (id, provider, model_id, display_name, capabilities, context_window, cost_per_1k_input, cost_per_1k_output, requires_api_key, tier_required, status, output_filter_strategy)
VALUES
    ('openai-gpt-4o', 'openai', 'gpt-4o', 'GPT-4o', '["persona", "style", "translation", "detection", "general"]', 128000, 0.0025, 0.01, 1, 'pro', 'active', 'none'),
    ('openai-gpt-4o-mini', 'openai', 'gpt-4o-mini', 'GPT-4o Mini', '["persona", "style", "translation", "detection", "general"]', 128000, 0.00015, 0.0006, 1, 'pro', 'active', 'none'),
    ('openai-o1', 'openai', 'o1', 'o1 (Reasoning)', '["persona", "style", "general"]', 200000, 0.015, 0.06, 1, 'premium', 'active', 'none');

-- Anthropic models (requires API key)
INSERT INTO model_registry (id, provider, model_id, display_name, capabilities, context_window, cost_per_1k_input, cost_per_1k_output, requires_api_key, tier_required, status, output_filter_strategy)
VALUES
    ('anthropic-claude-4-sonnet', 'anthropic', 'claude-sonnet-4-20250514', 'Claude 4 Sonnet', '["persona", "style", "translation", "detection", "general"]', 200000, 0.003, 0.015, 1, 'pro', 'active', 'none'),
    ('anthropic-claude-4-opus', 'anthropic', 'claude-opus-4-20250514', 'Claude 4 Opus', '["persona", "style", "translation", "general"]', 200000, 0.015, 0.075, 1, 'premium', 'active', 'none'),
    ('anthropic-claude-3.5-sonnet', 'anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', '["persona", "style", "translation", "detection", "general"]', 200000, 0.003, 0.015, 1, 'pro', 'active', 'none'),
    ('anthropic-claude-3.5-haiku', 'anthropic', 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', '["detection", "translation", "general"]', 200000, 0.0008, 0.004, 1, 'pro', 'active', 'none');

-- Google models (requires API key)
INSERT INTO model_registry (id, provider, model_id, display_name, capabilities, context_window, cost_per_1k_input, cost_per_1k_output, requires_api_key, tier_required, status, output_filter_strategy)
VALUES
    ('google-gemini-2.5-pro', 'google', 'gemini-2.5-pro-preview-06-05', 'Gemini 2.5 Pro', '["persona", "style", "translation", "detection", "general"]', 2000000, 0.00125, 0.01, 1, 'pro', 'active', 'none'),
    ('google-gemini-2.0-flash', 'google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', '["persona", "style", "translation", "detection", "general"]', 1000000, 0.0001, 0.0004, 1, 'pro', 'active', 'none');

-- Groq models (requires API key, ultra-fast inference)
INSERT INTO model_registry (id, provider, model_id, display_name, capabilities, context_window, cost_per_1k_input, cost_per_1k_output, requires_api_key, tier_required, status, output_filter_strategy)
VALUES
    ('groq-llama-3.3-70b', 'groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B (Groq)', '["persona", "style", "translation", "general"]', 128000, 0.00059, 0.00079, 1, 'pro', 'active', 'heuristic'),
    ('groq-llama-3.1-8b', 'groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant (Groq)', '["detection", "general"]', 128000, 0.00005, 0.00008, 1, 'pro', 'active', 'heuristic'),
    ('groq-mixtral-8x7b', 'groq', 'mixtral-8x7b-32768', 'Mixtral 8x7B (Groq)', '["persona", "style", "translation", "general"]', 32768, 0.00024, 0.00024, 1, 'pro', 'active', 'heuristic');

-- Ollama models (local, no API key)
INSERT INTO model_registry (id, provider, model_id, display_name, capabilities, context_window, requires_api_key, tier_required, status, output_filter_strategy, notes)
VALUES
    ('ollama-mistral-7b', 'ollama', 'ollama/mistral:7b', 'Mistral 7B (Local)', '["persona", "style", "translation", "general"]', 32768, 0, 'free', 'active', 'heuristic', 'Default local model - clean output'),
    ('ollama-llama3.2-3b', 'ollama', 'ollama/llama3.2:3b', 'Llama 3.2 3B (Local)', '["detection", "general"]', 128000, 0, 'free', 'active', 'heuristic', 'Fast local model for detection'),
    ('ollama-qwen2.5-7b', 'ollama', 'ollama/qwen2.5:7b', 'Qwen 2.5 7B (Local)', '["persona", "style", "translation", "general"]', 32768, 0, 'free', 'active', 'xml-tags', 'Uses <think> tags for reasoning');

-- Default model settings: Map use cases to default models
CREATE TABLE IF NOT EXISTS default_model_settings (
    use_case TEXT PRIMARY KEY,                        -- persona, style, translation, round_trip, detection, general
    cloud_model_id TEXT NOT NULL,                     -- Default model for cloud/production
    local_model_id TEXT NOT NULL,                     -- Default model for local/development
    description TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Seed default model settings (replaces hardcoded MODEL_CONFIGS)
INSERT INTO default_model_settings (use_case, cloud_model_id, local_model_id, description)
VALUES
    ('persona', 'cf-llama-3.1-70b', 'ollama-mistral-7b', 'Persona transformation - changes narrative voice/perspective'),
    ('style', 'cf-llama-3.1-70b', 'ollama-mistral-7b', 'Style transformation - changes writing patterns'),
    ('translation', 'cf-llama-3.1-70b', 'ollama-mistral-7b', 'Translation between languages'),
    ('round_trip', 'cf-llama-3.1-70b', 'ollama-mistral-7b', 'Round-trip translation - semantic drift analysis'),
    ('detection', 'cf-llama-3.1-8b', 'ollama-llama3.2-3b', 'AI content detection'),
    ('general', 'cf-llama-3.1-8b', 'ollama-mistral-7b', 'General purpose LLM operations'),
    ('extraction', 'cf-llama-3.1-70b', 'ollama-mistral-7b', 'Profile and attribute extraction');

-- API Key usage tracking (for cost monitoring)
CREATE TABLE IF NOT EXISTS api_key_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,                           -- openai, anthropic, google, groq
    model_id TEXT NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0,
    use_case TEXT,                                    -- What the call was for
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_key_usage_user ON api_key_usage(user_id);
CREATE INDEX idx_api_key_usage_date ON api_key_usage(created_at);
CREATE INDEX idx_api_key_usage_provider ON api_key_usage(provider);

-- Monthly usage aggregates for billing display
CREATE TABLE IF NOT EXISTS api_key_usage_monthly (
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    year_month TEXT NOT NULL,                         -- Format: '2025-12'
    total_tokens_input INTEGER DEFAULT 0,
    total_tokens_output INTEGER DEFAULT 0,
    total_estimated_cost REAL DEFAULT 0,
    call_count INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, provider, year_month),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
