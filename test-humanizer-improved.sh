#!/bin/bash
# Comprehensive Humanizer Test Suite - After Improvements
# December 7, 2025
#
# Tests the improved humanizer with:
# - Intensity-aware prompts
# - Tell-word replacement (not removal)
# - New default model (GPT-OSS 20B)

API_URL="http://localhost:8787"

echo "============================================================"
echo "HUMANIZER IMPROVEMENT TEST SUITE"
echo "============================================================"
echo "Date: $(date)"
echo "Testing improvements from Dec 7, 2025"
echo ""

# Test function
test_humanizer() {
  local name="$1"
  local text="$2"
  local intensity="$3"

  local result=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": $(echo "$text" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
      \"intensity\": \"$intensity\",
      \"enableLLMPolish\": true
    }")

  echo "$result" | python3 -c "
import sys, json, textwrap
d = json.load(sys.stdin)
if 'error' in d:
    print(f'  ERROR: {d[\"error\"]}')
    return
baseline = d.get('baseline', {}).get('detection', {})
final = d.get('final', {}).get('detection', {})
improvement = d.get('improvement', {})
humanized = d.get('humanizedText', '')
processing = d.get('processing', {})
model = d.get('model_used', d.get('modelUsed', 'unknown'))

b_conf = baseline.get('confidence', 0)
f_conf = final.get('confidence', 0)
drop = improvement.get('aiConfidenceDrop', 0)
burst_inc = improvement.get('burstinessIncrease', 0)

print(f'  Model: {model}')
print(f'  Time: {processing.get(\"totalDurationMs\", \"?\")}ms')
print(f'  AI Confidence: {b_conf}% → {f_conf}% (Δ{-drop:+d})')
print(f'  Verdict: {baseline.get(\"verdict\", \"?\")} → {final.get(\"verdict\", \"?\")}')
print(f'  Burstiness: {baseline.get(\"signals\", {}).get(\"burstiness\", \"?\")} → {final.get(\"signals\", {}).get(\"burstiness\", \"?\")} (Δ{burst_inc:+d})')
print(f'  Tell words: {len(baseline.get(\"detectedTellWords\", []))} → {len(final.get(\"detectedTellWords\", []))}')

# Check for quality issues
issues = []
if f_conf > 40:
    issues.append(f'AI conf still high ({f_conf}%)')
if len(final.get('detectedTellWords', [])) > 0:
    issues.append(f'Tell words remain: {[w[\"word\"] for w in final.get(\"detectedTellWords\", [])]}')
if burst_inc < 5:
    issues.append(f'Low burstiness gain ({burst_inc})')

if issues:
    print(f'  ⚠️  Issues: {issues}')
else:
    print(f'  ✅ Quality OK')

print()
print(f'  Result ({len(humanized.split())} words):')
for line in textwrap.fill(humanized, width=72).split('\\n'):
    print(f'    {line}')
" 2>/dev/null
}

# ============================================================
# TEST 1: Academic/Formal Text
# ============================================================
echo ""
echo "============================================================"
echo "TEST 1: Academic/Formal"
echo "============================================================"

TEXT1="The implementation of sustainable development practices necessitates a comprehensive understanding of environmental, economic, and social factors. Research indicates that organizations adopting holistic approaches to sustainability demonstrate improved long-term performance metrics. Furthermore, stakeholder engagement plays a crucial role in ensuring the successful execution of sustainability initiatives. It is essential to recognize that these efforts require continuous monitoring and evaluation to achieve desired outcomes."

echo ""
echo "Original text:"
echo "$TEXT1" | fold -s -w 76 | sed 's/^/  /'
echo ""

echo "--- LIGHT ---"
test_humanizer "Academic" "$TEXT1" "light"
echo ""

echo "--- MODERATE ---"
test_humanizer "Academic" "$TEXT1" "moderate"
echo ""

echo "--- AGGRESSIVE ---"
test_humanizer "Academic" "$TEXT1" "aggressive"

# ============================================================
# TEST 2: Blog/Marketing Text
# ============================================================
echo ""
echo "============================================================"
echo "TEST 2: Blog/Marketing"
echo "============================================================"

TEXT2="In today's digital age, content creation has become more important than ever. Whether you're a business owner or a creative professional, understanding how to leverage social media platforms is crucial for success. Additionally, the rise of artificial intelligence tools has transformed the content landscape significantly. It's worth noting that authenticity remains a key factor in building meaningful connections with your audience."

echo ""
echo "Original text:"
echo "$TEXT2" | fold -s -w 76 | sed 's/^/  /'
echo ""

echo "--- MODERATE ---"
test_humanizer "Blog" "$TEXT2" "moderate"
echo ""

echo "--- AGGRESSIVE ---"
test_humanizer "Blog" "$TEXT2" "aggressive"

# ============================================================
# TEST 3: Technical Documentation
# ============================================================
echo ""
echo "============================================================"
echo "TEST 3: Technical Documentation"
echo "============================================================"

TEXT3="The system architecture employs a microservices-based approach to ensure scalability and maintainability. Each service communicates through RESTful APIs, facilitating seamless integration between components. Moreover, the implementation utilizes containerization technologies to streamline deployment processes. It should be noted that proper error handling and logging mechanisms are essential for maintaining system reliability."

echo ""
echo "Original text:"
echo "$TEXT3" | fold -s -w 76 | sed 's/^/  /'
echo ""

echo "--- MODERATE ---"
test_humanizer "Technical" "$TEXT3" "moderate"

# ============================================================
# TEST 4: News/Journalism
# ============================================================
echo ""
echo "============================================================"
echo "TEST 4: News/Journalism"
echo "============================================================"

TEXT4="Climate scientists have issued new warnings about the accelerating pace of global warming. According to recent studies, average temperatures have risen significantly over the past decade. Consequently, many coastal communities are facing unprecedented challenges from rising sea levels. It is imperative that governments take immediate action to address these environmental concerns. Furthermore, international cooperation will be essential in mitigating the worst effects of climate change."

echo ""
echo "Original text:"
echo "$TEXT4" | fold -s -w 76 | sed 's/^/  /'
echo ""

echo "--- MODERATE ---"
test_humanizer "News" "$TEXT4" "moderate"

# ============================================================
# TEST 5: Product Description
# ============================================================
echo ""
echo "============================================================"
echo "TEST 5: Product Description"
echo "============================================================"

TEXT5="This innovative product represents a paradigm shift in personal productivity tools. The robust design ensures durability while maintaining an elegant aesthetic. Additionally, the comprehensive feature set addresses the multifaceted needs of modern professionals. It is worth noting that the intuitive interface significantly reduces the learning curve for new users. Furthermore, the seamless integration capabilities make it an invaluable addition to any workflow."

echo ""
echo "Original text:"
echo "$TEXT5" | fold -s -w 76 | sed 's/^/  /'
echo ""

echo "--- AGGRESSIVE ---"
test_humanizer "Product" "$TEXT5" "aggressive"

# ============================================================
# TEST 6: Educational Content
# ============================================================
echo ""
echo "============================================================"
echo "TEST 6: Educational Content"
echo "============================================================"

TEXT6="Understanding the fundamentals of machine learning requires a comprehensive grasp of statistical concepts. Neural networks, which form the backbone of deep learning, utilize complex mathematical operations to process information. Moreover, the training process involves iteratively adjusting model parameters to minimize prediction errors. It is essential to recognize that practical experience is crucial for developing proficiency in this field."

echo ""
echo "Original text:"
echo "$TEXT6" | fold -s -w 76 | sed 's/^/  /'
echo ""

echo "--- MODERATE ---"
test_humanizer "Educational" "$TEXT6" "moderate"

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "============================================================"
echo "TEST SUMMARY"
echo "============================================================"
echo ""
echo "Tests completed at $(date)"
echo ""
echo "Key improvements tested:"
echo "  1. Tell-word REPLACEMENT (not removal)"
echo "  2. Intensity-aware LLM prompts"
echo "  3. New default model: GPT-OSS 20B"
echo "  4. Better prompt structure with forbidden words list"
echo ""
echo "Success criteria:"
echo "  - AI confidence drop ≥ 20 points"
echo "  - Final AI confidence < 40%"
echo "  - No tell-words in output"
echo "  - Natural-sounding text"
echo ""
