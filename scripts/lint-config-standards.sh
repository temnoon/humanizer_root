#!/bin/bash
#
# Configuration Standards Linter
#
# Checks for violations of the configuration centralization standards.
# Run this as a pre-commit hook or in CI.
#
# Exit codes:
#   0 - All checks passed
#   1 - Violations found
#
# Usage:
#   ./scripts/lint-config-standards.sh [--fix]
#

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

VIOLATIONS=0
WARNINGS=0

# Directories to check (exclude test files, registry files, config files, and documented fallbacks)
EXCLUDE_PATTERNS="\.test\.ts|\.spec\.ts|model-registry\.ts|default-model-registry\.ts|prompt-registry\.ts|constants\.ts|default-prompts\.ts|embedding-config\.ts|storage-config\.ts|ai-detection-config\.ts|model-id\.ts"

# Also exclude lines with "Fallback" or "fallback" comments (intentional)
FALLBACK_EXCLUDE="[Ff]allback|FALLBACK|// Default|// default"

echo "🔍 Checking configuration standards..."
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 1: Hardcoded Model Names
# ═══════════════════════════════════════════════════════════════════════════════

echo "1. Checking for hardcoded model names..."

# Patterns that indicate hardcoded model references
MODEL_PATTERNS=(
  "'llama"
  "\"llama"
  "'gpt-"
  "\"gpt-"
  "'claude-"
  "\"claude-"
  "'nomic-embed"
  "\"nomic-embed"
  "'text-embedding"
  "\"text-embedding"
  "':latest'"
  "\":latest\""
)

for pattern in "${MODEL_PATTERNS[@]}"; do
  matches=$(grep -rn "$pattern" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS" | grep -vE "$FALLBACK_EXCLUDE" || true)
  if [ -n "$matches" ]; then
    echo -e "${RED}❌ Found hardcoded model name: $pattern${NC}"
    echo "$matches" | head -10
    ((VIOLATIONS++))
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 2: Hardcoded Embedding Dimensions
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "2. Checking for hardcoded embedding dimensions..."

# Look for the magic number 768 (common embedding dimension)
matches=$(grep -rn "= 768" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|EmbeddingDimension" || true)
if [ -n "$matches" ]; then
  echo -e "${RED}❌ Found hardcoded embedding dimension (768)${NC}"
  echo "$matches" | head -10
  ((VIOLATIONS++))
fi

# Also check for 1536 (OpenAI large)
matches=$(grep -rn "= 1536" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS" | grep -vE "$FALLBACK_EXCLUDE" || true)
if [ -n "$matches" ]; then
  echo -e "${RED}❌ Found hardcoded embedding dimension (1536)${NC}"
  echo "$matches" | head -10
  ((VIOLATIONS++))
fi

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 3: Inline System Prompts
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "3. Checking for inline system prompts..."

# Look for common prompt patterns outside of registry
PROMPT_PATTERNS=(
  "systemPrompt:"
  "'You are a"
  "\"You are a"
  "'You are an"
  "\"You are an"
  "role: 'system'"
  "role: \"system\""
)

for pattern in "${PROMPT_PATTERNS[@]}"; do
  matches=$(grep -rn "$pattern" packages/core/src/houses packages/core/src/aui 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|prompt-registry|prompt-types" || true)
  if [ -n "$matches" ]; then
    echo -e "${YELLOW}⚠️  Found potential inline prompt: $pattern${NC}"
    echo "$matches" | head -5
    ((WARNINGS++))
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 4: Direct Ollama URLs
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "4. Checking for hardcoded service URLs..."

URL_PATTERNS=(
  "localhost:11434"
  "127.0.0.1:11434"
  "http://ollama"
)

for pattern in "${URL_PATTERNS[@]}"; do
  matches=$(grep -rn "$pattern" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|\.env|config" || true)
  if [ -n "$matches" ]; then
    echo -e "${YELLOW}⚠️  Found hardcoded URL: $pattern${NC}"
    echo "$matches" | head -5
    ((WARNINGS++))
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 5: Magic Threshold Numbers
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "5. Checking for magic threshold numbers..."

# Common thresholds that should be in config
THRESHOLD_PATTERNS=(
  "> 0\.7[^0-9]"
  "< 0\.3[^0-9]"
  ">= 0\.8[^0-9]"
  "<= 0\.2[^0-9]"
)

for pattern in "${THRESHOLD_PATTERNS[@]}"; do
  matches=$(grep -rEn "$pattern" packages/core/src/houses packages/core/src/aui 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|\.test\.|benchmark" || true)
  if [ -n "$matches" ]; then
    echo -e "${YELLOW}⚠️  Found potential magic threshold: $pattern${NC}"
    echo "$matches" | head -3
    ((WARNINGS++))
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 6: AI Detection Patterns Outside Config
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "6. Checking for hardcoded AI-tell patterns..."

AI_TELL_PATTERNS=(
  "/\\\\bdelve\\\\b/"
  "/\\\\bleverage\\\\b/"
  "/\\\\btapestry\\\\b/"
)

for pattern in "${AI_TELL_PATTERNS[@]}"; do
  matches=$(grep -rn "$pattern" packages/core/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|ai-detection-config|benchmark" || true)
  if [ -n "$matches" ]; then
    echo -e "${YELLOW}⚠️  Found hardcoded AI-tell pattern outside config${NC}"
    echo "$matches" | head -3
    ((WARNINGS++))
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""

if [ $VIOLATIONS -gt 0 ]; then
  echo -e "${RED}❌ FAILED: Found $VIOLATIONS violation(s) and $WARNINGS warning(s)${NC}"
  echo ""
  echo "To fix violations:"
  echo "  - Use getModelRegistry().getDefault('capability') instead of hardcoded model names"
  echo "  - Use registry.getEmbeddingDimensions() instead of hardcoded 768/1536"
  echo "  - Use getPrompt('PROMPT_ID') from prompt-registry instead of inline prompts"
  echo "  - Use EMBEDDING_CONFIG_KEYS or STORAGE_CONFIG_KEYS for URLs and thresholds"
  echo ""
  echo "See: packages/core/docs/CONFIGURATION_REMEDIATION_PLAN.md"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  PASSED with $WARNINGS warning(s)${NC}"
  echo "Consider addressing warnings to improve maintainability."
  exit 0
else
  echo -e "${GREEN}✅ PASSED: All configuration standards checks passed${NC}"
  exit 0
fi
