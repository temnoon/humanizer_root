// Add demo user to npe-api database
// Run: npx tsx add-demo-user.ts

import { hashPassword } from './src/middleware/auth';

const DEMO_EMAIL = 'demo@humanizer.com';
const DEMO_PASSWORD = 'WeDidn\'tKn0w!!';

async function addDemoUser() {
  console.log('Hashing demo password...');
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  
  console.log('\nDemo User Credentials:');
  console.log('Email:', DEMO_EMAIL);
  console.log('Password:', DEMO_PASSWORD);
  console.log('\nPassword Hash:', passwordHash);
  
  console.log('\n=== SQL to insert demo user ===');
  console.log(`
INSERT INTO users (id, email, password_hash, role, created_at, monthly_transformations, monthly_tokens_used, last_reset_date)
VALUES (
  'demo-user-id',
  '${DEMO_EMAIL}',
  '${passwordHash}',
  'pro',
  ${Date.now()},
  0,
  0,
  ${Date.now()}
);
`);
}

addDemoUser().catch(console.error);
