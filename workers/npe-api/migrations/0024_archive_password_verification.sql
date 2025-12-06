-- Migration 0024: Archive Password Verification
-- Created: 2025-12-01
-- Purpose: Store encrypted verification data to validate archive passwords

-- Add verification_data column to user_encryption_settings
ALTER TABLE user_encryption_settings ADD COLUMN verification_data TEXT;
