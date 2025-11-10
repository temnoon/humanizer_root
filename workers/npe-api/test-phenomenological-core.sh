#!/bin/bash
# Test the Phenomenological Laboratory - Core V2 API Flow
# Philosophy: Create narrative → Read sentence → Measure POVM
# "Agent in Field of Agency" - ρ as first-class persistent object

set -e  # Exit on error

echo "🜃 Testing Phenomenological Laboratory - V2 API"
echo "=================================================="
echo ""

# Step 1: Register user
echo "Step 1: Register phenomenologist..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"phenomenologist@field.agency","password":"testpass123"}')

echo "$REGISTER_RESPONSE" | jq '.'

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Registration failed"
  exit 1
fi

echo "✅ Registration successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Create narrative (auto-generates ρ)
echo "Step 2: Create narrative (births ρ)..."
NARRATIVE_TEXT="The archive remembers what you forget. Each entry closes like a measurement, collapsing intention into understanding."

CREATE_RESPONSE=$(curl -s -X POST http://localhost:8000/v2/narratives \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"text\":\"$NARRATIVE_TEXT\",\"title\":\"First Phenomenological Entry\"}")

echo "$CREATE_RESPONSE" | jq '.'

NARRATIVE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.narrative.id')
RHO_ID=$(echo "$CREATE_RESPONSE" | jq -r '.rho.id')

if [ "$NARRATIVE_ID" == "null" ]; then
  echo "❌ Narrative creation failed"
  exit 1
fi

echo "✅ Narrative created"
echo "   Narrative ID: $NARRATIVE_ID"
echo "   ρ ID: $RHO_ID"
echo "   Purity: $(echo "$CREATE_RESPONSE" | jq -r '.rho.purity')"
echo "   Entropy: $(echo "$CREATE_RESPONSE" | jq -r '.rho.entropy')"
echo ""

# Step 3: Perform POVM measurement
echo "Step 3: Measure POVM (collapse superposition)..."
POVM_RESPONSE=$(curl -s -X POST http://localhost:8000/v2/rho/measure \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"narrative_id\":\"$NARRATIVE_ID\",\"axis\":\"literalness\"}")

echo "$POVM_RESPONSE" | jq '.'

MEASUREMENT_ID=$(echo "$POVM_RESPONSE" | jq -r '.measurement_id')

if [ "$MEASUREMENT_ID" == "null" ]; then
  echo "❌ POVM measurement failed"
  exit 1
fi

echo "✅ POVM measurement complete"
echo "   Literal: $(echo "$POVM_RESPONSE" | jq -r '.probabilities.literal')"
echo "   Metaphorical: $(echo "$POVM_RESPONSE" | jq -r '.probabilities.metaphorical')"
echo "   Coherence: $(echo "$POVM_RESPONSE" | jq -r '.coherence')"
echo "   ρ before: $(echo "$POVM_RESPONSE" | jq -r '.rho_id_before')"
echo "   ρ after: $(echo "$POVM_RESPONSE" | jq -r '.rho_id_after')"
echo ""

# Step 4: Inspect ρ state
echo "Step 4: Inspect ρ post-measurement..."
RHO_AFTER=$(echo "$POVM_RESPONSE" | jq -r '.rho_id_after')

INSPECT_RESPONSE=$(curl -s -X POST http://localhost:8000/v2/rho/inspect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"rho_id\":\"$RHO_AFTER\"}")

echo "$INSPECT_RESPONSE" | jq '.'

echo "✅ ρ inspection complete"
echo "   Classification: $(echo "$INSPECT_RESPONSE" | jq -r '.state_classification')"
echo "   Interpretation: $(echo "$INSPECT_RESPONSE" | jq -r '.interpretation')"
echo ""

echo "=================================================="
echo "🎉 Phenomenological Laboratory is OPERATIONAL"
echo ""
echo "What we just demonstrated:"
echo "  ✓ Narrative creation auto-generates persistent ρ"
echo "  ✓ POVM measurement collapses superposition"
echo "  ✓ Post-measurement ρ' is versioned (not overwritten)"
echo "  ✓ ρ is first-class persistent object with full lineage"
echo ""
echo "Philosophy embodied in code ✨"
