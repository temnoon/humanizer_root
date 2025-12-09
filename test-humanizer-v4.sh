#!/bin/bash
# Test Humanizer with Different Source Texts + GPTZero Comparison v4
# December 7, 2025

API_URL="http://localhost:8787"

echo "============================================================"
echo "HUMANIZER TEST: MULTIPLE SOURCES + GPTZero COMPARISON"
echo "============================================================"
echo "Date: $(date)"
echo ""

# Test function
test_text() {
  local name="$1"
  local text="$2"

  echo ""
  echo "============================================================"
  echo "SOURCE: $name"
  echo "============================================================"
  echo ""
  echo "Original ($(echo "$text" | wc -w | tr -d ' ') words):"
  echo "$text" | fold -s -w 76 | sed 's/^/  /'
  echo ""

  # Original analysis
  echo "--- Original Analysis ---"
  curl -s -X POST "$API_URL/ai-detection/lite" \
    -H "Content-Type: application/json" \
    -d "{\"text\": $(echo "$text" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
det = d.get('detection', d)
print(f'  AI Confidence: {det.get(\"confidence\", \"N/A\")}% | Burstiness: {det.get(\"signals\", {}).get(\"burstiness\", \"N/A\")} | Tell Words: {len(det.get(\"detectedTellWords\", []))}')" 2>/dev/null || echo "  (parse error)"

  # Standard humanization (no GPTZero)
  echo ""
  echo "--- Standard Humanization ---"
  STANDARD_RESULT=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": $(echo "$text" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
      \"intensity\": \"moderate\",
      \"enableLLMPolish\": true,
      \"model\": \"@cf/meta/llama-3.1-70b-instruct\",
      \"useGPTZeroTargeting\": false
    }")

  echo "$STANDARD_RESULT" | python3 -c "
import sys, json, textwrap
d = json.load(sys.stdin)
if 'error' in d:
    print(f'  ERROR: {d[\"error\"]}')
    sys.exit(0)
baseline = d.get('baseline', {}).get('detection', {})
final = d.get('final', {}).get('detection', {})
improvement = d.get('improvement', {})
humanized = d.get('humanizedText', '')
processing = d.get('processing', {})

print(f'  Time: {processing.get(\"totalDurationMs\", \"?\")}ms')
print(f'  AI: {baseline.get(\"confidence\", \"?\")}% → {final.get(\"confidence\", \"?\")}% (Δ-{improvement.get(\"aiConfidenceDrop\", 0)})')
print(f'  Burstiness: {baseline.get(\"signals\", {}).get(\"burstiness\", \"?\")} → {final.get(\"signals\", {}).get(\"burstiness\", \"?\")} (Δ+{improvement.get(\"burstinessIncrease\", 0)})')
print(f'  Tell words removed: {improvement.get(\"tellWordsRemoved\", 0)}')
print(f'  Verdict: {final.get(\"verdict\", \"?\")}')
print()
print('  Result:')
for line in textwrap.fill(humanized, width=72).split('\\n'):
    print(f'    {line}')
" 2>/dev/null || echo "  (parse error)"

  # GPTZero-targeted humanization
  echo ""
  echo "--- GPTZero-Targeted Humanization ---"
  GPTZERO_RESULT=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": $(echo "$text" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
      \"intensity\": \"moderate\",
      \"enableLLMPolish\": true,
      \"model\": \"@cf/meta/llama-3.1-70b-instruct\",
      \"useGPTZeroTargeting\": true
    }")

  echo "$GPTZERO_RESULT" | python3 -c "
import sys, json, textwrap
d = json.load(sys.stdin)
if 'error' in d:
    print(f'  ERROR: {d[\"error\"]}')
    sys.exit(0)
baseline = d.get('baseline', {}).get('detection', {})
final = d.get('final', {}).get('detection', {})
improvement = d.get('improvement', {})
humanized = d.get('humanizedText', '')
processing = d.get('processing', {})
gptz = d.get('gptzeroAnalysis', {})

print(f'  Time: {processing.get(\"totalDurationMs\", \"?\")}ms')
if gptz:
    print(f'  GPTZero: {gptz.get(\"flaggedCount\", 0)}/{gptz.get(\"totalCount\", 0)} sentences flagged ({gptz.get(\"overallConfidence\", 0):.1f}% AI)')
print(f'  AI: {baseline.get(\"confidence\", \"?\")}% → {final.get(\"confidence\", \"?\")}% (Δ-{improvement.get(\"aiConfidenceDrop\", 0)})')
print(f'  Burstiness: {baseline.get(\"signals\", {}).get(\"burstiness\", \"?\")} → {final.get(\"signals\", {}).get(\"burstiness\", \"?\")} (Δ+{improvement.get(\"burstinessIncrease\", 0)})')
print(f'  Tell words removed: {improvement.get(\"tellWordsRemoved\", 0)}')
print(f'  Verdict: {final.get(\"verdict\", \"?\")}')
print()
print('  Result:')
for line in textwrap.fill(humanized, width=72).split('\\n'):
    print(f'    {line}')
" 2>/dev/null || echo "  (parse error)"
}

# Test 1: Academic/Formal
test_text "Academic/Formal" "The implementation of sustainable development practices necessitates a comprehensive understanding of environmental, economic, and social factors. Research indicates that organizations adopting holistic approaches to sustainability demonstrate improved long-term performance metrics. Furthermore, stakeholder engagement plays a crucial role in ensuring the successful execution of sustainability initiatives. It is essential to recognize that these efforts require continuous monitoring and evaluation to achieve desired outcomes."

# Test 2: Blog/Marketing
test_text "Blog/Marketing" "In today's digital age, content creation has become more important than ever. Whether you're a business owner or a creative professional, understanding how to leverage social media platforms is crucial for success. Additionally, the rise of artificial intelligence tools has transformed the content landscape significantly. It's worth noting that authenticity remains a key factor in building meaningful connections with your audience."

# Test 3: Technical Documentation
test_text "Technical Docs" "The system architecture employs a microservices-based approach to ensure scalability and maintainability. Each service communicates through RESTful APIs, facilitating seamless integration between components. Moreover, the implementation utilizes containerization technologies to streamline deployment processes. It should be noted that proper error handling and logging mechanisms are essential for maintaining system reliability."

# Test 4: Essay/Opinion
test_text "Essay/Opinion" "Climate change represents one of the most pressing challenges facing humanity today. The scientific consensus clearly demonstrates that human activities have significantly contributed to global warming. Consequently, immediate action is required to mitigate these effects and protect future generations. It is imperative that governments, corporations, and individuals work collaboratively to address this existential threat."

echo ""
echo "============================================================"
echo "Test completed at $(date)"
echo "============================================================"
