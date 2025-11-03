-- Migration: Add user roles and usage quotas
-- Created: 2025-11-03

-- Add role field to users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'free'
  CHECK(role IN ('admin', 'premium', 'pro', 'member', 'free'));

-- Add usage tracking fields
ALTER TABLE users ADD COLUMN monthly_transformations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN monthly_tokens_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_reset_date INTEGER; -- Unix timestamp of last monthly reset

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing users to have admin role (for demo@humanizer.com)
-- This assumes demo@humanizer.com is the first/only user during initial testing
UPDATE users SET role = 'admin', last_reset_date = strftime('%s', 'now') * 1000
WHERE email = 'demo@humanizer.com';
