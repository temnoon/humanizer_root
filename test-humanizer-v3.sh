#!/bin/bash
# Test Humanizer with Different Source Texts + GPTZero Comparison
# December 7, 2025

API_URL="http://localhost:8787"

# Different source texts to test
declare -a TEST_TEXTS
declare -a TEXT_NAMES

# 1. Academic/formal AI text
TEST_TEXTS[0]="The implementation of sustainable development practices necessitates a comprehensive understanding of environmental, economic, and social factors. Research indicates that organizations adopting holistic approaches to sustainability demonstrate improved long-term performance metrics. Furthermore, stakeholder engagement plays a crucial role in ensuring the successful execution of sustainability initiatives. It is essential to recognize that these efforts require continuous monitoring and evaluation to achieve desired outcomes."
TEXT_NAMES[0]="Academic/Formal"

# 2. Blog-style AI text
TEST_TEXTS[1]="In today's digital age, content creation has become more important than ever. Whether you're a business owner or a creative professional, understanding how to leverage social media platforms is crucial for success. Additionally, the rise of artificial intelligence tools has transformed the content landscape significantly. It's worth noting that authenticity remains a key factor in building meaningful connections with your audience."
TEXT_NAMES[1]="Blog/Marketing"

# 3. Technical documentation style
TEST_TEXTS[2]="The system architecture employs a microservices-based approach to ensure scalability and maintainability. Each service communicates through RESTful APIs, facilitating seamless integration between components. Moreover, the implementation utilizes containerization technologies to streamline deployment processes. It should be noted that proper error handling and logging mechanisms are essential for maintaining system reliability."
TEXT_NAMES[2]="Technical Docs"

# 4. Essay/opinion style
TEST_TEXTS[3]="Climate change represents one of the most pressing challenges facing humanity today. The scientific consensus clearly demonstrates that human activities have significantly contributed to global warming. Consequently, immediate action is required to mitigate these effects and protect future generations. It is imperative that governments, corporations, and individuals work collaboratively to address this existential threat."
TEXT_NAMES[3]="Essay/Opinion"

echo "============================================================"
echo "HUMANIZER TEST: MULTIPLE SOURCES + GPTZero COMPARISON"
echo "============================================================"
echo "Date: $(date)"
echo "Model: @cf/meta/llama-3.1-70b-instruct (default)"
echo ""

# Function to run humanizer and parse results
run_humanizer() {
  local text="$1"
  local use_gptzero="$2"
  local label="$3"

  local response=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"$text\",
      \"intensity\": \"moderate\",
      \"enableLLMPolish\": true,
      \"model\": \"@cf/meta/llama-3.1-70b-instruct\",
      \"useGPTZeroTargeting\": $use_gptzero
    }")

  echo "$response" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print(f'  ERROR: {d[\"error\"]}')
        return

    baseline = d.get('baseline', {}).get('detection', {})
    final = d.get('final', {}).get('detection', {})
    improvement = d.get('improvement', {})
    humanized = d.get('humanizedText', 'N/A')
    processing = d.get('processing', {})
    gptz = d.get('gptzeroAnalysis', {})

    print(f'  Duration: {processing.get(\"totalDurationMs\", \"N/A\")}ms')
    print(f'  Baseline AI: {baseline.get(\"confidence\", \"N/A\")}% ({baseline.get(\"verdict\", \"N/A\")})')
    print(f'  Final AI: {final.get(\"confidence\", \"N/A\")}% ({final.get(\"verdict\", \"N/A\")})')
    print(f'  Improvement: -{improvement.get(\"aiConfidenceDrop\", 0)} confidence, +{improvement.get(\"burstinessIncrease\", 0)} burstiness')

    if gptz:
        print(f'  GPTZero: {gptz.get(\"flaggedCount\", 0)}/{gptz.get(\"totalCount\", 0)} flagged ({gptz.get(\"overallConfidence\", 0):.1f}% AI)')

    print()
    print('  Result:')
    import textwrap
    wrapped = textwrap.fill(humanized, width=72)
    for line in wrapped.split('\\n'):
        print(f'    {line}')
except Exception as e:
    print(f'  Parse error: {e}')
"
}

# Test each text type
for i in "${!TEST_TEXTS[@]}"; do
  TEXT="${TEST_TEXTS[$i]}"
  NAME="${TEXT_NAMES[$i]}"

  echo ""
  echo "============================================================"
  echo "SOURCE ${i}: ${NAME}"
  echo "============================================================"
  echo ""
  echo "Original text ($(echo "$TEXT" | wc -w | tr -d ' ') words):"
  echo "$TEXT" | fold -s -w 76 | sed 's/^/  /'
  echo ""

  # First analyze original
  echo "--- Original AI Analysis ---"
  curl -s -X POST "$API_URL/ai-detection/lite" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$TEXT\"}" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    det = d.get('detection', d)
    print(f'  Verdict: {det.get(\"verdict\", \"N/A\")}')
    print(f'  AI Confidence: {det.get(\"confidence\", \"N/A\")}')
    signals = det.get('signals', {})
    print(f'  Burstiness: {signals.get(\"burstiness\", \"N/A\")}')
    print(f'  Tell Words: {len(det.get(\"detectedTellWords\", []))}')
    tell_words = det.get('detectedTellWords', [])
    if tell_words:
        words = [w['word'] for w in tell_words]
        print(f'  Found: {words}')
except Exception as e:
    print(f'  Error: {e}')
"
  echo ""

  # Run without GPTZero
  echo "--- WITHOUT GPTZero Targeting ---"
  run_humanizer "$TEXT" "false" "Standard"
  echo ""

  # Run with GPTZero
  echo "--- WITH GPTZero Targeting ---"
  run_humanizer "$TEXT" "true" "GPTZero"
  echo ""
done

echo ""
echo "============================================================"
echo "SUMMARY TABLE"
echo "============================================================"
echo ""
echo "Running summary analysis..."
echo ""

# Generate summary
python3 << 'PYTHON'
import subprocess
import json

API_URL = "http://localhost:8787"

texts = [
    ("Academic/Formal", "The implementation of sustainable development practices necessitates a comprehensive understanding of environmental, economic, and social factors. Research indicates that organizations adopting holistic approaches to sustainability demonstrate improved long-term performance metrics. Furthermore, stakeholder engagement plays a crucial role in ensuring the successful execution of sustainability initiatives. It is essential to recognize that these efforts require continuous monitoring and evaluation to achieve desired outcomes."),
    ("Blog/Marketing", "In today's digital age, content creation has become more important than ever. Whether you're a business owner or a creative professional, understanding how to leverage social media platforms is crucial for success. Additionally, the rise of artificial intelligence tools has transformed the content landscape significantly. It's worth noting that authenticity remains a key factor in building meaningful connections with your audience."),
    ("Technical Docs", "The system architecture employs a microservices-based approach to ensure scalability and maintainability. Each service communicates through RESTful APIs, facilitating seamless integration between components. Moreover, the implementation utilizes containerization technologies to streamline deployment processes. It should be noted that proper error handling and logging mechanisms are essential for maintaining system reliability."),
    ("Essay/Opinion", "Climate change represents one of the most pressing challenges facing humanity today. The scientific consensus clearly demonstrates that human activities have significantly contributed to global warming. Consequently, immediate action is required to mitigate these effects and protect future generations. It is imperative that governments, corporations, and individuals work collaboratively to address this existential threat."),
]

print(f"{'Source Type':<16} | {'Original':<10} | {'Standard':<10} | {'GPTZero':<10} | {'Winner':<10}")
print("-" * 70)

for name, text in texts:
    # This is just a placeholder - actual data was collected above
    # For a real summary, we'd need to capture the outputs
    pass

print("\nNote: See detailed results above for full comparison.")
print("GPTZero targeting focuses LLM polish on AI-flagged sentences specifically.")
PYTHON

echo ""
echo "============================================================"
echo "Test completed at $(date)"
echo "============================================================"
