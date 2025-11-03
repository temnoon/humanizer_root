-- Migration: Update admin accounts
-- Created: 2025-11-03
-- Change dreegle@gmail.com to admin, demo@humanizer.com to free tier

-- Set dreegle@gmail.com to admin role
UPDATE users SET role = 'admin'
WHERE email = 'dreegle@gmail.com';

-- Set demo@humanizer.com to free role (lowest privilege for testing)
UPDATE users SET role = 'free'
WHERE email = 'demo@humanizer.com';
