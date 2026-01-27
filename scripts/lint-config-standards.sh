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
FALLBACK_EXCLUDE="[Ff]allback|FALLBACK|// Default|// default|getDefaultSync|\.getDefault"

# Exclude source format identifiers (not model names)
# These patterns match content type IDs, parser names, source tags - NOT model names
SOURCE_ID_EXCLUDE="name: 'claude-|source = 'claude-|source === 'claude-|source: 'claude|'claude-export'|'claude-single'|'claude-conversation'|'claude-message'|sourceType:|contentTypes"

# Exclude JSDoc comments (documentation examples)
JSDOC_EXCLUDE="\* .*e\.g\.,|\* Embedding model|@param|@example"

# Known debt file - entries here are warnings instead of errors
KNOWN_DEBT_FILE="scripts/config-standards-known-debt.txt"

# Function to check if a file:pattern is in known debt
is_known_debt() {
  local file_path="$1"
  local violation_type="$2"

  if [ ! -f "$KNOWN_DEBT_FILE" ]; then
    return 1
  fi

  # Try exact match first
  if grep -q "^${file_path}:${violation_type}$" "$KNOWN_DEBT_FILE" 2>/dev/null; then
    return 0
  fi

  # Try with false-positive tag for model names that are actually identifiers
  if [ "$violation_type" = "hardcoded-model" ]; then
    if grep -q "^${file_path}:false-positive-claude$" "$KNOWN_DEBT_FILE" 2>/dev/null; then
      return 0
    fi
  fi

  return 1
}

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
  matches=$(grep -rn "$pattern" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS" | grep -vE "$FALLBACK_EXCLUDE" | grep -vE "$SOURCE_ID_EXCLUDE" | grep -vE "$JSDOC_EXCLUDE" || true)
  if [ -n "$matches" ]; then
    # Check if all matches are known debt
    NEW_VIOLATIONS=0
    KNOWN_DEBT_COUNT=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if is_known_debt "$file_path" "hardcoded-model"; then
        ((KNOWN_DEBT_COUNT++))
      else
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found hardcoded model name: $pattern${NC}"
      echo "$matches" | grep -v "model-master.ts" | head -10
      ((VIOLATIONS++))
    elif [ $KNOWN_DEBT_COUNT -gt 0 ]; then
      echo -e "${YELLOW}⚠️  Known debt - hardcoded model name: $pattern (tracked in config-standards-known-debt.txt)${NC}"
      ((WARNINGS++))
    fi
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
    # Check if matches are known debt
    NEW_VIOLATIONS=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if ! is_known_debt "$file_path" "inline-prompt"; then
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found inline prompt (not tracked as debt): $pattern${NC}"
      echo "$matches" | head -5
      ((VIOLATIONS++))
    else
      echo -e "${YELLOW}⚠️  Known debt - inline prompt: $pattern (tracked)${NC}"
      ((WARNINGS++))
    fi
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
  matches=$(grep -rn "$pattern" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|\.env|config" | grep -vE "$FALLBACK_EXCLUDE" || true)
  if [ -n "$matches" ]; then
    # Check if matches are known debt
    NEW_VIOLATIONS=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if ! is_known_debt "$file_path" "hardcoded-url"; then
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found hardcoded URL (not tracked): $pattern${NC}"
      echo "$matches" | head -5
      ((VIOLATIONS++))
    else
      echo -e "${YELLOW}⚠️  Known debt - hardcoded URL: $pattern (tracked)${NC}"
      ((WARNINGS++))
    fi
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
    # Check if matches are known debt
    NEW_VIOLATIONS=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if ! is_known_debt "$file_path" "magic-threshold"; then
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found magic threshold (not tracked): $pattern${NC}"
      echo "$matches" | head -3
      ((VIOLATIONS++))
    else
      echo -e "${YELLOW}⚠️  Known debt - magic threshold: $pattern (tracked)${NC}"
      ((WARNINGS++))
    fi
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 6: Hardcoded Temperature Values
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "6. Checking for hardcoded temperature values..."

# Common temperature values that should be in config or prompt requirements
TEMP_PATTERNS=(
  "temperature: 0\.[0-9]"
  "temperature = 0\.[0-9]"
)

for pattern in "${TEMP_PATTERNS[@]}"; do
  matches=$(grep -rEn "$pattern" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|prompt-registry|\.test\.|benchmark" | grep -vE "$FALLBACK_EXCLUDE" || true)
  if [ -n "$matches" ]; then
    # Check if matches are known debt
    NEW_VIOLATIONS=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if ! is_known_debt "$file_path" "hardcoded-temperature"; then
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found hardcoded temperature (not tracked): $pattern${NC}"
      echo "$matches" | head -5
      ((VIOLATIONS++))
    else
      echo -e "${YELLOW}⚠️  Known debt - hardcoded temperature (tracked)${NC}"
      ((WARNINGS++))
    fi
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 7: Hardcoded maxTokens Values
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "7. Checking for hardcoded maxTokens values..."

MAXTOKENS_PATTERNS=(
  "maxTokens: [0-9]+"
  "max_tokens: [0-9]+"
)

for pattern in "${MAXTOKENS_PATTERNS[@]}"; do
  matches=$(grep -rEn "$pattern" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|prompt-registry|\.test\.|benchmark|embedding-config" | grep -vE "$FALLBACK_EXCLUDE" || true)
  if [ -n "$matches" ]; then
    # Check if matches are known debt
    NEW_VIOLATIONS=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if ! is_known_debt "$file_path" "hardcoded-maxtokens"; then
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found hardcoded maxTokens (not tracked): $pattern${NC}"
      echo "$matches" | head -5
      ((VIOLATIONS++))
    else
      echo -e "${YELLOW}⚠️  Known debt - hardcoded maxTokens (tracked)${NC}"
      ((WARNINGS++))
    fi
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 8: Hardcoded Similarity Thresholds
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "8. Checking for hardcoded similarity thresholds..."

SIMILARITY_PATTERNS=(
  "minSimilarity[:\s]*[=:][:\s]*0\.[0-9]"
  "similarityThreshold[:\s]*[=:][:\s]*0\.[0-9]"
  "threshold[:\s]*[=:][:\s]*0\.[0-9]"
)

for pattern in "${SIMILARITY_PATTERNS[@]}"; do
  matches=$(grep -rEn "$pattern" packages/core/src packages/npe/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|embedding-config|retrieval/constants|\.test\.|benchmark" | grep -vE "$FALLBACK_EXCLUDE" || true)
  if [ -n "$matches" ]; then
    # Check if matches are known debt
    NEW_VIOLATIONS=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if ! is_known_debt "$file_path" "hardcoded-similarity"; then
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found hardcoded similarity threshold (not tracked): $pattern${NC}"
      echo "$matches" | head -5
      ((VIOLATIONS++))
    else
      echo -e "${YELLOW}⚠️  Known debt - hardcoded similarity threshold (tracked)${NC}"
      ((WARNINGS++))
    fi
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 9: AI Detection Patterns Outside Config
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "9. Checking for hardcoded AI-tell patterns..."

AI_TELL_PATTERNS=(
  "/\\\\bdelve\\\\b/"
  "/\\\\bleverage\\\\b/"
  "/\\\\btapestry\\\\b/"
)

for pattern in "${AI_TELL_PATTERNS[@]}"; do
  matches=$(grep -rn "$pattern" packages/core/src 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS|ai-detection-config|benchmark" || true)
  if [ -n "$matches" ]; then
    # Check if matches are known debt
    NEW_VIOLATIONS=0
    while IFS= read -r match; do
      file_path=$(echo "$match" | cut -d: -f1)
      if ! is_known_debt "$file_path" "ai-tell-pattern"; then
        ((NEW_VIOLATIONS++))
      fi
    done <<< "$matches"

    if [ $NEW_VIOLATIONS -gt 0 ]; then
      echo -e "${RED}❌ Found hardcoded AI-tell pattern (not tracked)${NC}"
      echo "$matches" | head -3
      ((VIOLATIONS++))
    else
      echo -e "${YELLOW}⚠️  Known debt - hardcoded AI-tell pattern (tracked)${NC}"
      ((WARNINGS++))
    fi
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
