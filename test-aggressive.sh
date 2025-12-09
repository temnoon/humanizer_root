#!/bin/bash
# Test Aggressive Intensity Humanization
# December 7, 2025

API_URL="http://localhost:8787"

echo "============================================================"
echo "AGGRESSIVE INTENSITY TEST"
echo "============================================================"
echo ""

test_intensity() {
  local name="$1"
  local text="$2"
  local intensity="$3"

  local result=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": $(echo "$text" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
      \"intensity\": \"$intensity\",
      \"enableLLMPolish\": true,
      \"model\": \"@cf/meta/llama-3.1-70b-instruct\"
    }")

  echo "$result" | python3 -c "
import sys, json, textwrap
d = json.load(sys.stdin)
if 'error' in d:
    print(f'ERROR: {d[\"error\"]}')
    sys.exit(0)
baseline = d.get('baseline', {}).get('detection', {})
final = d.get('final', {}).get('detection', {})
improvement = d.get('improvement', {})
humanized = d.get('humanizedText', '')
processing = d.get('processing', {})

print(f'  {\"$intensity\".upper()}: {baseline.get(\"confidence\", \"?\")}% → {final.get(\"confidence\", \"?\")}% (Δ{-improvement.get(\"aiConfidenceDrop\", 0):+d}) | Burst: {baseline.get(\"signals\", {}).get(\"burstiness\", \"?\")} → {final.get(\"signals\", {}).get(\"burstiness\", \"?\")} | Time: {processing.get(\"totalDurationMs\", \"?\")}ms')
print(f'    Result: {humanized[:120]}...')
"
}

# Academic text
TEXT1="The implementation of sustainable development practices necessitates a comprehensive understanding of environmental, economic, and social factors. Research indicates that organizations adopting holistic approaches to sustainability demonstrate improved long-term performance metrics. Furthermore, stakeholder engagement plays a crucial role in ensuring the successful execution of sustainability initiatives."

echo "SOURCE: Academic/Formal"
echo "Original: $TEXT1" | fold -s -w 80
echo ""
test_intensity "Academic" "$TEXT1" "light"
test_intensity "Academic" "$TEXT1" "moderate"
test_intensity "Academic" "$TEXT1" "aggressive"

echo ""
echo "------------------------------------------------------------"
echo ""

# Blog text
TEXT2="In today's digital age, content creation has become more important than ever. Whether you're a business owner or a creative professional, understanding how to leverage social media platforms is crucial for success. Additionally, the rise of artificial intelligence tools has transformed the content landscape significantly."

echo "SOURCE: Blog/Marketing"
echo "Original: $TEXT2" | fold -s -w 80
echo ""
test_intensity "Blog" "$TEXT2" "light"
test_intensity "Blog" "$TEXT2" "moderate"
test_intensity "Blog" "$TEXT2" "aggressive"

echo ""
echo "============================================================"
echo "Test completed at $(date)"
