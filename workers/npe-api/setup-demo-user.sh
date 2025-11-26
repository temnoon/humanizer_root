#!/bin/bash
# Setup script for demo user
# Run from: ~/humanizer_root/workers/npe-api

set -e

echo "======================================"
echo "Creating Demo User in npe-api"
echo "======================================"
echo ""
echo "Credentials:"
echo "  Email: demo@humanizer.com"
echo "  Password: WeDidn'tKn0w!!"
echo "  Role: pro"
echo ""

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo "Error: Must run from npe-api directory"
    echo "cd ~/humanizer_root/workers/npe-api && ./setup-demo-user.sh"
    exit 1
fi

# Apply migration
echo "Applying migration 0019_add_demo_user.sql..."
wrangler d1 migrations apply npe-production-db --remote

echo ""
echo "======================================"
echo "✅ Demo user created successfully!"
echo "======================================"
echo ""
echo "Test login:"
echo '  curl -X POST https://npe-api.humanizer.com/auth/login \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"email":"demo@humanizer.com","password":"WeDidn'"'"'tKn0w!!"}'"'"
echo ""
