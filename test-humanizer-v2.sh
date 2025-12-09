#!/bin/bash
# Test Humanizer Effectiveness with Different LLMs - v2
# December 7, 2025

API_URL="http://localhost:8787"

# Test text - typical AI-generated content
TEST_TEXT="Artificial intelligence has revolutionized the way we interact with technology. Machine learning algorithms have enabled unprecedented advances in natural language processing, computer vision, and predictive analytics. These innovations are fundamentally transforming industries across the globe. Furthermore, the integration of AI systems into everyday applications has created new opportunities for automation and efficiency. It is important to note that these developments come with significant implications for the workforce and society as a whole."

echo "========================================"
echo "HUMANIZER LLM COMPARISON TEST v2"
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

echo "========================================"
echo "STEP 1: AI ANALYSIS - ORIGINAL TEXT"
echo "========================================"

# Analyze original text first
ORIGINAL_ANALYSIS=$(curl -s -X POST "$API_URL/ai-detection/lite" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$TEST_TEXT\"}")

echo "Original AI Analysis:"
echo "$ORIGINAL_ANALYSIS" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    det = d.get('detection', d)
    print(f'  Verdict: {det.get(\"verdict\", \"N/A\")}')
    print(f'  AI Confidence: {det.get(\"confidence\", \"N/A\")}%')
    signals = det.get('signals', {})
    print(f'  Burstiness: {signals.get(\"burstiness\", \"N/A\")}')
    print(f'  Tell Word Score: {signals.get(\"tellWordScore\", \"N/A\")}')
    print(f'  Lexical Diversity: {signals.get(\"lexicalDiversity\", \"N/A\")}')
    tell_words = det.get('detectedTellWords', [])
    if tell_words:
        print(f'  Tell Words Found: {[w[\"word\"] for w in tell_words]}')
except Exception as e:
    print(f'  Error parsing: {e}')
"
echo ""

echo "========================================"
echo "STEP 2: HUMANIZE WITH EACH MODEL"
echo "========================================"

for i in "${!MODELS[@]}"; do
  MODEL="${MODELS[$i]}"
  NAME="${MODEL_NAMES[$i]}"

  echo ""
  echo "========================================"
  echo "Testing: $NAME"
  echo "Model ID: $MODEL"
  echo "========================================"

  # Call humanizer
  START_TIME=$(python3 -c "import time; print(int(time.time()*1000))")
  RESPONSE=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"$TEST_TEXT\",
      \"intensity\": \"moderate\",
      \"enableLLMPolish\": true,
      \"model\": \"$MODEL\"
    }")
  END_TIME=$(python3 -c "import time; print(int(time.time()*1000))")
  DURATION=$((END_TIME - START_TIME))

  # Parse full result
  echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)

    # Check for error
    if 'error' in d:
        print(f'ERROR: {d[\"error\"]}')
        sys.exit(1)

    humanized = d.get('humanizedText', 'N/A')
    model_used = d.get('model_used', 'N/A')
    processing = d.get('processing', {})
    baseline = d.get('baseline', {}).get('detection', {})
    final = d.get('final', {}).get('detection', {})
    improvement = d.get('improvement', {})

    print(f'Duration: ${DURATION}ms (total: {processing.get(\"totalDurationMs\", \"N/A\")}ms)')
    print(f'Model Used: {model_used}')
    print()
    print('BASELINE (before):')
    print(f'  Verdict: {baseline.get(\"verdict\", \"N/A\")}')
    print(f'  AI Confidence: {baseline.get(\"confidence\", \"N/A\")}%')
    baseline_signals = baseline.get('signals', {})
    print(f'  Burstiness: {baseline_signals.get(\"burstiness\", \"N/A\")}')
    print(f'  Tell Words: {len(baseline.get(\"detectedTellWords\", []))}')

    print()
    print('FINAL (after):')
    print(f'  Verdict: {final.get(\"verdict\", \"N/A\")}')
    print(f'  AI Confidence: {final.get(\"confidence\", \"N/A\")}%')
    final_signals = final.get('signals', {})
    print(f'  Burstiness: {final_signals.get(\"burstiness\", \"N/A\")}')
    print(f'  Tell Words: {len(final.get(\"detectedTellWords\", []))}')

    print()
    print('IMPROVEMENT:')
    print(f'  AI Confidence Drop: {improvement.get(\"aiConfidenceDrop\", \"N/A\")} points')
    print(f'  Burstiness Increase: {improvement.get(\"burstinessIncrease\", \"N/A\")} points')
    print(f'  Tell Words Removed: {improvement.get(\"tellWordsRemoved\", \"N/A\")}')

    print()
    print('HUMANIZED TEXT:')
    # Wrap text at 80 chars
    import textwrap
    wrapped = textwrap.fill(humanized, width=76)
    for line in wrapped.split('\\n'):
        print(f'  {line}')

except Exception as e:
    print(f'Parse error: {e}')
    import traceback
    traceback.print_exc()
"
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

echo "$GPT_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)

    if 'error' in d:
        print(f'GPTZero Targeting: {d[\"error\"]}')
        sys.exit(0)

    gptz = d.get('gptzeroAnalysis', {})
    if gptz:
        flagged = gptz.get('flaggedCount', 0)
        total = gptz.get('totalCount', 0)
        confidence = gptz.get('overallConfidence', 'N/A')
        print(f'GPTZero Analysis:')
        print(f'  Sentences Flagged: {flagged}/{total}')
        print(f'  Overall Confidence: {confidence}')

        sentences = gptz.get('sentences', [])
        if sentences:
            print('  Sentence Details:')
            for s in sentences:
                flag = '🚨' if s.get('highlight_sentence_for_ai') else '✓'
                prob = s.get('completely_generated_prob', 0)
                text = s.get('sentence', '')[:50]
                print(f'    {flag} {prob:.1%}: \"{text}...\"')
    else:
        print('No GPTZero analysis in response')

    humanized = d.get('humanizedText', 'N/A')
    print()
    print('GPTZero-Targeted Result:')
    import textwrap
    wrapped = textwrap.fill(humanized, width=76)
    for line in wrapped.split('\\n'):
        print(f'  {line}')
except Exception as e:
    print(f'Parse error: {e}')
"

echo ""
echo "========================================"
echo "Test completed at $(date)"
echo "========================================"
