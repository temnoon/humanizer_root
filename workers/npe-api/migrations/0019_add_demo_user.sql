-- Migration: Add demo user for testing
-- Created: 2025-11-23

-- Insert demo user with PBKDF2 hashed password
-- Email: demo@humanizer.com
-- Password: WeDidn'tKn0w!!
-- Role: pro (access to all features)

-- Note: The password hash was generated using PBKDF2 with 100,000 iterations
-- You can regenerate this by running: npx tsx generate-demo-hash.ts

INSERT INTO users (
  id, 
  email, 
  password_hash, 
  role, 
  created_at, 
  monthly_transformations, 
  monthly_tokens_used, 
  last_reset_date
) 
SELECT 
  'demo-user-id',
  'demo@humanizer.com',
  'pbkdf2$100000$9df185433f0c5313e2da192ba29a361f$dc7fdb2e3b5e18230f58b04d5c7f6dad1124a5216720b79c86a08c7db0124891',
  'pro',
  strftime('%s', 'now') * 1000,
  0,
  0,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'demo@humanizer.com'
);
