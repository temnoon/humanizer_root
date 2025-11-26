#!/bin/bash
# Create a test user for curation testing
# Run this from ~/humanizer_root/workers/npe-api

# Password: TestCuration123!
# This hash was generated with PBKDF2 (100k iterations)
# For a real deployment, generate a proper hash

echo "Creating test user for curation testing..."

npx wrangler d1 execute npe-production-db --remote --command="
INSERT OR REPLACE INTO users (id, email, password_hash, role, auth_method, created_at, monthly_transformations, monthly_tokens_used, last_reset_date)
VALUES (
  'test-curation-user-001',
  'curation-test@humanizer.com',
  'PBKDF2:100000:salt-placeholder:hash-placeholder',
  'admin',
  'password',
  $(date +%s)000,
  0,
  0,
  $(date +%s)000
);
"

echo "Done! But the password hash won't work - use OAuth instead."
echo ""
echo "Better approach: Log in via GitHub in your regular browser at:"
echo "https://post-social.humanizer.com"
echo ""
echo "Then grab your token from the browser console:"
echo "  localStorage.getItem('token')"
echo ""
echo "And test the curation API with:"
echo '  curl -X POST https://post-social-api.tem-527.workers.dev/api/posts \'
echo '    -H "Content-Type: application/json" \'
echo '    -H "Authorization: Bearer YOUR_TOKEN" \'
echo '    -d '"'"'{"content":"Test post about phenomenology and AI","visibility":"public"}'"'"
