#!/bin/bash
# Test Humanizer Effectiveness with Different LLMs
# December 7, 2025

API_URL="http://localhost:8787"

# Test text - typical AI-generated content
TEST_TEXT="Artificial intelligence has revolutionized the way we interact with technology. Machine learning algorithms have enabled unprecedented advances in natural language processing, computer vision, and predictive analytics. These innovations are fundamentally transforming industries across the globe. Furthermore, the integration of AI systems into everyday applications has created new opportunities for automation and efficiency. It is important to note that these developments come with significant implications for the workforce and society as a whole."

echo "========================================"
echo "HUMANIZER LLM COMPARISON TEST"
echo "========================================"
echo ""
echo "Test text ($(echo "$TEST_TEXT" | wc -w | tr -d ' ') words):"
echo "$TEST_TEXT"
echo ""

# Models to test
MODELS=(
  "@cf/meta/llama-3.1-70b-instruct"
  "@cf/openai/gpt-oss-120b"
  "@cf/openai/gpt-oss-20b"
)

MODEL_NAMES=(
  "Llama 3.1 70B"
  "GPT-OSS 120B"
  "GPT-OSS 20B"
)

# Store results
declare -a RESULTS
declare -a AI_SCORES

echo "========================================"
echo "STEP 1: AI ANALYSIS - ORIGINAL TEXT"
echo "========================================"

# Analyze original text first
ORIGINAL_ANALYSIS=$(curl -s -X POST "$API_URL/ai-detection/lite" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$TEST_TEXT\"}")

echo "Original AI Analysis:"
echo "$ORIGINAL_ANALYSIS" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'  AI Probability: {d.get(\"aiProbability\", \"N/A\")}'); print(f'  Human Probability: {d.get(\"humanProbability\", \"N/A\")}'); print(f'  Burstiness: {d.get(\"analysis\", {}).get(\"burstiness\", \"N/A\")}'); print(f'  Tell Words: {d.get(\"analysis\", {}).get(\"tellWordCount\", \"N/A\")}')" 2>/dev/null || echo "  (Failed to parse)"
echo ""

echo "========================================"
echo "STEP 2: HUMANIZE WITH EACH MODEL"
echo "========================================"

for i in "${!MODELS[@]}"; do
  MODEL="${MODELS[$i]}"
  NAME="${MODEL_NAMES[$i]}"

  echo ""
  echo "----------------------------------------"
  echo "Testing: $NAME"
  echo "Model ID: $MODEL"
  echo "----------------------------------------"

  # Call humanizer
  START_TIME=$(date +%s%N)
  RESPONSE=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"$TEST_TEXT\",
      \"intensity\": \"moderate\",
      \"enableLLMPolish\": true,
      \"model\": \"$MODEL\"
    }")
  END_TIME=$(date +%s%N)
  DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

  # Parse result
  TRANSFORMED=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('transformed', d.get('error', 'ERROR')))" 2>/dev/null)
  MODEL_USED=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('modelUsed', 'unknown'))" 2>/dev/null)

  if [[ "$TRANSFORMED" == "ERROR" || -z "$TRANSFORMED" ]]; then
    echo "  ERROR: Transformation failed"
    echo "  Response: $RESPONSE"
    RESULTS[$i]="ERROR"
    continue
  fi

  RESULTS[$i]="$TRANSFORMED"

  echo "  Duration: ${DURATION}ms"
  echo "  Model Used: $MODEL_USED"
  echo ""
  echo "  Transformed Text:"
  echo "  $TRANSFORMED" | fold -s -w 80 | sed 's/^/    /'
  echo ""

  # Analyze transformed text
  ANALYSIS=$(curl -s -X POST "$API_URL/ai-detection/lite" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$TRANSFORMED\"}")

  AI_PROB=$(echo "$ANALYSIS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('aiProbability', 'N/A'))" 2>/dev/null)
  HUMAN_PROB=$(echo "$ANALYSIS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('humanProbability', 'N/A'))" 2>/dev/null)
  BURSTINESS=$(echo "$ANALYSIS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('analysis', {}).get('burstiness', 'N/A'))" 2>/dev/null)
  TELL_WORDS=$(echo "$ANALYSIS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('analysis', {}).get('tellWordCount', 'N/A'))" 2>/dev/null)

  AI_SCORES[$i]="$AI_PROB"

  echo "  AI Analysis of Transformed:"
  echo "    AI Probability: $AI_PROB"
  echo "    Human Probability: $HUMAN_PROB"
  echo "    Burstiness: $BURSTINESS"
  echo "    Tell Words: $TELL_WORDS"
done

echo ""
echo "========================================"
echo "STEP 3: GPTZero TARGETING TEST (PRO+)"
echo "========================================"

# Test GPTZero targeting
GPT_RESPONSE=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"$TEST_TEXT\",
    \"intensity\": \"moderate\",
    \"enableLLMPolish\": true,
    \"model\": \"@cf/meta/llama-3.1-70b-instruct\",
    \"useGPTZeroTargeting\": true
  }")

GPT_ERROR=$(echo "$GPT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', ''))" 2>/dev/null)
GPT_ANALYSIS=$(echo "$GPT_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); ga=d.get('gptzeroAnalysis', {}); print(f'Flagged: {ga.get(\"flaggedCount\", \"N/A\")}/{ga.get(\"totalCount\", \"N/A\")}') if ga else print('Not available')" 2>/dev/null)

if [[ -n "$GPT_ERROR" ]]; then
  echo "GPTZero Targeting: $GPT_ERROR"
else
  echo "GPTZero Targeting: $GPT_ANALYSIS"
  GPTZ_TRANSFORMED=$(echo "$GPT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('transformed', 'N/A'))" 2>/dev/null)
  echo ""
  echo "GPTZero-Targeted Result:"
  echo "$GPTZ_TRANSFORMED" | fold -s -w 80 | sed 's/^/  /'
fi

echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo ""
echo "Original Text AI Probability: (see above)"
echo ""
echo "Model Comparison:"
for i in "${!MODELS[@]}"; do
  echo "  ${MODEL_NAMES[$i]}: AI Probability = ${AI_SCORES[$i]:-N/A}"
done
echo ""
echo "Test completed at $(date)"
