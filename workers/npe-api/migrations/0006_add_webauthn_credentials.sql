-- Migration: Add WebAuthn credentials for device-based admin authentication
-- Created: 2025-11-03

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_name TEXT NOT NULL,
  transports TEXT, -- JSON array: ['usb', 'nfc', 'ble', 'internal']
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);

-- Index for credential lookups during authentication
CREATE INDEX IF NOT EXISTS idx_webauthn_credential ON webauthn_credentials(credential_id);
