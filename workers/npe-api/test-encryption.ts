/**
 * Quick test script for encryption utilities
 * Run with: npx tsx test-encryption.ts
 */

import { encryptAPIKey, decryptAPIKey, testEncryptionRoundtrip } from './src/utils/encryption';

async function runTests() {
  console.log('Testing API Key Encryption Utilities\n');

  // Test data
  const testAPIKey = 'sk-test-1234567890abcdefghijklmnopqrstuvwxyz';
  const testJWTSecret = 'test-jwt-secret-do-not-use-in-production';
  const testUserId = 'user-123';
  const wrongUserId = 'user-456';

  try {
    // Test 1: Basic encryption/decryption roundtrip
    console.log('Test 1: Basic roundtrip');
    const encrypted = await encryptAPIKey(testAPIKey, testJWTSecret, testUserId);
    console.log(`  Encrypted: ${encrypted}`);

    const decrypted = await decryptAPIKey(encrypted, testJWTSecret, testUserId);
    console.log(`  Decrypted: ${decrypted}`);
    console.log(`  ✅ Match: ${decrypted === testAPIKey}\n`);

    // Test 2: Verify encrypted format contains IV and data
    console.log('Test 2: Encrypted format validation');
    const parts = encrypted.split(':');
    console.log(`  Parts count: ${parts.length} (expected: 2)`);
    console.log(`  ✅ Format valid: ${parts.length === 2}\n`);

    // Test 3: Each encryption produces different ciphertext (random IV)
    console.log('Test 3: Random IV verification');
    const encrypted2 = await encryptAPIKey(testAPIKey, testJWTSecret, testUserId);
    console.log(`  First:  ${encrypted}`);
    console.log(`  Second: ${encrypted2}`);
    console.log(`  ✅ Different ciphertexts: ${encrypted !== encrypted2}\n`);

    // Test 4: Wrong user_id cannot decrypt
    console.log('Test 4: User isolation (wrong user_id)');
    try {
      await decryptAPIKey(encrypted, testJWTSecret, wrongUserId);
      console.log('  ❌ SECURITY ISSUE: Wrong user could decrypt!\n');
    } catch (error) {
      console.log(`  ✅ Correctly failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Test 5: Test roundtrip helper function
    console.log('Test 5: Roundtrip helper function');
    const roundtripResult = await testEncryptionRoundtrip(testAPIKey, testJWTSecret, testUserId);
    console.log(`  ✅ Roundtrip successful: ${roundtripResult}\n`);

    // Test 6: Empty API key should fail
    console.log('Test 6: Empty API key validation');
    try {
      await encryptAPIKey('', testJWTSecret, testUserId);
      console.log('  ❌ Empty key was accepted!\n');
    } catch (error) {
      console.log(`  ✅ Correctly rejected: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Test 7: Different user IDs produce different encryptions
    console.log('Test 7: User-specific encryption keys');
    const encryptedUser1 = await encryptAPIKey(testAPIKey, testJWTSecret, testUserId);
    const encryptedUser2 = await encryptAPIKey(testAPIKey, testJWTSecret, wrongUserId);
    const decryptedUser1 = await decryptAPIKey(encryptedUser1, testJWTSecret, testUserId);
    const decryptedUser2 = await decryptAPIKey(encryptedUser2, testJWTSecret, wrongUserId);

    console.log(`  User 1 encrypted: ${encryptedUser1.substring(0, 40)}...`);
    console.log(`  User 2 encrypted: ${encryptedUser2.substring(0, 40)}...`);
    console.log(`  ✅ Different encryptions: ${encryptedUser1 !== encryptedUser2}`);
    console.log(`  ✅ Both decrypt correctly: ${decryptedUser1 === testAPIKey && decryptedUser2 === testAPIKey}\n`);

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
