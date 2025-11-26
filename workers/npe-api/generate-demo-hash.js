#!/usr/bin/env node
/**
 * Generate PBKDF2 password hash for demo user
 * Run: node generate-demo-hash.js
 */

const crypto = require('crypto');

const DEMO_PASSWORD = "WeDidn'tKn0w!!";
const ITERATIONS = 100000;

async function generateHash() {
  // Generate random salt
  const salt = crypto.randomBytes(16);
  
  // Derive key using PBKDF2
  const hash = crypto.pbkdf2Sync(
    DEMO_PASSWORD,
    salt,
    ITERATIONS,
    32, // 256 bits
    'sha256'
  );
  
  // Convert to hex
  const saltHex = salt.toString('hex');
  const hashHex = hash.toString('hex');
  
  // Format: pbkdf2$iterations$salt$hash
  const fullHash = `pbkdf2$${ITERATIONS}$${saltHex}$${hashHex}`;
  
  console.log('='.repeat(80));
  console.log('DEMO USER PASSWORD HASH GENERATED');
  console.log('='.repeat(80));
  console.log('');
  console.log('Email:', 'demo@humanizer.com');
  console.log('Password:', DEMO_PASSWORD);
  console.log('');
  console.log('Full Hash:');
  console.log(fullHash);
  console.log('');
  console.log('='.repeat(80));
  console.log('Copy the hash above and replace the placeholder in:');
  console.log('migrations/0019_add_demo_user.sql');
  console.log('');
  console.log('Or run this SQL directly:');
  console.log('='.repeat(80));
  console.log(`
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
VALUES (
  'demo-user-id',
  'demo@humanizer.com',
  '${fullHash}',
  'pro',
  ${Date.now()},
  0,
  0,
  ${Date.now()}
)
ON CONFLICT(email) DO UPDATE SET
  password_hash = '${fullHash}',
  role = 'pro';
`);
  console.log('='.repeat(80));
}

generateHash().catch(console.error);
