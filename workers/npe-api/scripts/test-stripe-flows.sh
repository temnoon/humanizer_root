#!/bin/bash
# Stripe Integration Test Script
# Tests: registration, subscription, trial, day pass, promo codes, cancellation

API_BASE="${API_BASE:-https://npe-api.tem-527.workers.dev}"
# For local testing: API_BASE="http://localhost:8787"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Stripe Integration Test Suite"
echo "API: $API_BASE"
echo "=========================================="
echo ""

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4

    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            curl -s -X "$method" "$API_BASE$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data"
        else
            curl -s -X "$method" "$API_BASE$endpoint" \
                -H "Authorization: Bearer $token"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X "$method" "$API_BASE$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X "$method" "$API_BASE$endpoint"
        fi
    fi
}

# Test 1: Check prices endpoint (no auth required)
echo -e "${YELLOW}Test 1: Get Prices (Public)${NC}"
echo "GET /stripe/prices"
PRICES=$(api_call GET "/stripe/prices")
echo "$PRICES" | jq '.'
echo ""

# Test 2: Check tax info (no auth required)
echo -e "${YELLOW}Test 2: Get Tax Info (Public)${NC}"
echo "GET /stripe/tax-info"
TAX_INFO=$(api_call GET "/stripe/tax-info")
echo "$TAX_INFO" | jq '.'
echo ""

# For authenticated tests, you need a valid JWT token
# Get one by logging in with demo@humanizer.com / testpass123

echo "=========================================="
echo "AUTHENTICATED TESTS"
echo "=========================================="
echo ""
echo "To run authenticated tests, set your JWT token:"
echo "  export TOKEN='your_jwt_token_here'"
echo ""
echo "Get a token by logging in:"
echo "  curl -X POST $API_BASE/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"demo@humanizer.com\",\"password\":\"testpass123\"}'"
echo ""

if [ -z "$TOKEN" ]; then
    echo -e "${RED}No TOKEN set, skipping authenticated tests${NC}"
    echo ""
    echo "Example authenticated test commands:"
    echo ""

    echo "# Check subscription status"
    echo "curl -s $API_BASE/stripe/subscription -H 'Authorization: Bearer \$TOKEN' | jq"
    echo ""

    echo "# Check access level"
    echo "curl -s $API_BASE/stripe/access -H 'Authorization: Bearer \$TOKEN' | jq"
    echo ""

    echo "# Create checkout session (Pro tier with trial)"
    echo "curl -s -X POST $API_BASE/stripe/checkout \\"
    echo "  -H 'Authorization: Bearer \$TOKEN' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"tier\":\"pro\",\"withTrial\":true}' | jq"
    echo ""

    echo "# Create checkout with promo code"
    echo "curl -s -X POST $API_BASE/stripe/checkout \\"
    echo "  -H 'Authorization: Bearer \$TOKEN' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"tier\":\"member\",\"promoCode\":\"LAUNCH50\"}' | jq"
    echo ""

    echo "# Purchase day pass"
    echo "curl -s -X POST $API_BASE/stripe/day-pass \\"
    echo "  -H 'Authorization: Bearer \$TOKEN' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{}' | jq"
    echo ""

    echo "# Check day pass status"
    echo "curl -s $API_BASE/stripe/day-pass -H 'Authorization: Bearer \$TOKEN' | jq"
    echo ""

    echo "# Validate promo code"
    echo "curl -s -X POST $API_BASE/stripe/validate-promo \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"code\":\"LAUNCH50\"}' | jq"
    echo ""

    echo "# Get payment history"
    echo "curl -s $API_BASE/stripe/history -H 'Authorization: Bearer \$TOKEN' | jq"
    echo ""

    echo "# Open billing portal"
    echo "curl -s -X POST $API_BASE/stripe/portal \\"
    echo "  -H 'Authorization: Bearer \$TOKEN' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{}' | jq"

    exit 0
fi

# Authenticated tests
echo -e "${GREEN}TOKEN found, running authenticated tests${NC}"
echo ""

echo -e "${YELLOW}Test 3: Check Subscription Status${NC}"
api_call GET "/stripe/subscription" "" "$TOKEN" | jq '.'
echo ""

echo -e "${YELLOW}Test 4: Check Access Level${NC}"
api_call GET "/stripe/access" "" "$TOKEN" | jq '.'
echo ""

echo -e "${YELLOW}Test 5: Check Day Pass Status${NC}"
api_call GET "/stripe/day-pass" "" "$TOKEN" | jq '.'
echo ""

echo -e "${YELLOW}Test 6: Get Payment History${NC}"
api_call GET "/stripe/history" "" "$TOKEN" | jq '.'
echo ""

echo -e "${YELLOW}Test 7: Validate Promo Code${NC}"
api_call POST "/stripe/validate-promo" '{"code":"LAUNCH50"}' | jq '.'
echo ""

echo "=========================================="
echo "CHECKOUT TESTS (will generate URLs)"
echo "=========================================="
echo ""

echo -e "${YELLOW}Test 8: Create Pro Checkout with 7-day Trial${NC}"
CHECKOUT=$(api_call POST "/stripe/checkout" '{"tier":"pro","withTrial":true}' "$TOKEN")
echo "$CHECKOUT" | jq '.'
URL=$(echo "$CHECKOUT" | jq -r '.url // empty')
if [ -n "$URL" ]; then
    echo -e "${GREEN}Checkout URL: $URL${NC}"
fi
echo ""

echo -e "${YELLOW}Test 9: Create Day Pass Checkout${NC}"
DAY_PASS=$(api_call POST "/stripe/day-pass" '{}' "$TOKEN")
echo "$DAY_PASS" | jq '.'
URL=$(echo "$DAY_PASS" | jq -r '.url // empty')
if [ -n "$URL" ]; then
    echo -e "${GREEN}Day Pass URL: $URL${NC}"
fi
echo ""

echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo ""
echo "Test card numbers for Stripe checkout:"
echo "  Success: 4242 4242 4242 4242"
echo "  Decline: 4000 0000 0000 0341"
echo "  3D Secure: 4000 0000 0000 3220"
echo ""
echo "Use any future expiry and any CVC."
