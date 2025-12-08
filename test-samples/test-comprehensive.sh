#!/bin/bash
# Comprehensive Humanizer Test Suite
# Tests diverse content types across all intensity levels
# Created: Dec 7, 2025

API_URL="http://localhost:8787"
RESULTS_FILE="/tmp/humanizer_test_results_$(date +%Y%m%d_%H%M%S).json"

echo "========================================"
echo "Humanizer Comprehensive Test Suite"
echo "========================================"
echo "API: $API_URL"
echo "Results: $RESULTS_FILE"
echo ""

# Initialize results array
echo '{"tests": [], "summary": {}}' > "$RESULTS_FILE"

# Test function
run_test() {
    local name="$1"
    local text="$2"
    local intensity="$3"
    local category="$4"

    echo "Testing: $name ($intensity)..."

    # Create temp payload file
    local payload_file="/tmp/test_payload_$$.json"

    # Escape the text for JSON
    local escaped_text=$(echo "$text" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')

    cat > "$payload_file" << EOF
{
  "text": $escaped_text,
  "intensity": "$intensity",
  "enableLLMPolish": true
}
EOF

    # Run the test
    local start_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
    local response=$(curl -s -X POST "$API_URL/transformations/computer-humanizer" \
        -H "Content-Type: application/json" \
        -d @"$payload_file" 2>/dev/null)
    local end_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
    local duration=$((end_time - start_time))

    rm -f "$payload_file"

    # Parse response
    if [ -z "$response" ]; then
        echo "  ERROR: No response"
        return 1
    fi

    # Extract metrics using Python for reliable JSON parsing
    local metrics=$(echo "$response" | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    baseline = data.get("baseline", {}).get("detection", {})
    final = data.get("final", {}).get("detection", {})
    improvement = data.get("improvement", {})

    result = {
        "original_confidence": baseline.get("confidence", -1),
        "final_confidence": final.get("confidence", -1),
        "confidence_drop": improvement.get("aiConfidenceDrop", 0),
        "original_tellwords": len(baseline.get("detectedTellWords", [])),
        "final_tellwords": len(final.get("detectedTellWords", [])),
        "tellwords_removed": improvement.get("tellWordsRemoved", 0),
        "original_verdict": baseline.get("verdict", "unknown"),
        "final_verdict": final.get("verdict", "unknown"),
        "burstiness_increase": improvement.get("burstinessIncrease", 0),
        "original_burstiness": baseline.get("signals", {}).get("burstiness", 0),
        "final_burstiness": final.get("signals", {}).get("burstiness", 0)
    }
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
' 2>/dev/null)

    if [ -z "$metrics" ]; then
        echo "  ERROR: Failed to parse response"
        return 1
    fi

    # Extract values
    local orig_conf=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("original_confidence", -1))')
    local final_conf=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("final_confidence", -1))')
    local conf_drop=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("confidence_drop", 0))')
    local orig_tell=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("original_tellwords", 0))')
    local final_tell=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("final_tellwords", 0))')
    local orig_verdict=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("original_verdict", "unknown"))')
    local final_verdict=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("final_verdict", "unknown"))')
    local burst_inc=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("burstiness_increase", 0))')

    # Print results
    echo "  Confidence: $orig_conf% -> $final_conf% (drop: $conf_drop)"
    echo "  Tell-words: $orig_tell -> $final_tell"
    echo "  Verdict: $orig_verdict -> $final_verdict"
    echo "  Duration: ${duration}ms"

    # Determine pass/fail
    local passed="false"
    if [ "$conf_drop" -gt 10 ] || [ "$final_verdict" = "human" ]; then
        passed="true"
        echo "  Result: PASS"
    else
        echo "  Result: NEEDS IMPROVEMENT"
    fi
    echo ""

    # Append to results (using temp file to avoid issues)
    local test_result=$(cat << EOF
{
    "name": "$name",
    "category": "$category",
    "intensity": "$intensity",
    "original_confidence": $orig_conf,
    "final_confidence": $final_conf,
    "confidence_drop": $conf_drop,
    "original_tellwords": $orig_tell,
    "final_tellwords": $final_tell,
    "original_verdict": "$orig_verdict",
    "final_verdict": "$final_verdict",
    "burstiness_increase": $burst_inc,
    "duration_ms": $duration,
    "passed": $passed
}
EOF
)

    # Update results file
    python3 << PYEOF
import json
with open("$RESULTS_FILE", "r") as f:
    data = json.load(f)
data["tests"].append($test_result)
with open("$RESULTS_FILE", "w") as f:
    json.dump(data, f, indent=2)
PYEOF

    return 0
}

# ========================================
# TEST SAMPLES BY CATEGORY
# ========================================

echo "Category 1: ACADEMIC/SCIENTIFIC"
echo "----------------------------------------"

run_test "Academic_Research" \
"The implementation of sustainable development practices necessitates a comprehensive understanding of environmental factors. Furthermore, stakeholder engagement plays a crucial role in ensuring the success of conservation initiatives. It is worth noting that interdisciplinary collaboration has become increasingly vital in addressing complex ecological challenges." \
"moderate" "academic"

run_test "Scientific_Method" \
"Our research methodology employs a robust framework for analyzing climate data. The comprehensive analysis reveals significant correlations between anthropogenic activities and temperature variations. Subsequently, these findings demonstrate the pivotal importance of immediate policy interventions." \
"aggressive" "academic"

run_test "Medical_Research" \
"The clinical trial demonstrated that the novel therapeutic approach yields comprehensive improvements in patient outcomes. Furthermore, longitudinal studies indicate sustained efficacy over extended treatment periods. It is crucial to note that adverse effects remained minimal throughout the observation phase." \
"moderate" "academic"

echo "Category 2: TECHNICAL/ENGINEERING"
echo "----------------------------------------"

run_test "Software_Architecture" \
"The system architecture employs a microservices-based approach to ensure scalability. Moreover, the implementation utilizes containerization technologies for robust deployment strategies. Subsequently, comprehensive monitoring frameworks facilitate efficient debugging and maintenance procedures." \
"moderate" "technical"

run_test "Data_Engineering" \
"Our data pipeline leverages distributed computing frameworks to process large-scale datasets efficiently. Furthermore, the comprehensive ETL processes ensure data quality and consistency. It is worth noting that real-time analytics capabilities enable timely decision-making." \
"aggressive" "technical"

run_test "Cybersecurity" \
"The security framework implements a holistic approach to threat mitigation. Consequently, comprehensive vulnerability assessments are conducted regularly to ensure system integrity. Moreover, robust authentication mechanisms safeguard against unauthorized access attempts." \
"moderate" "technical"

echo "Category 3: BUSINESS/MARKETING"
echo "----------------------------------------"

run_test "Marketing_Strategy" \
"In today's competitive landscape, comprehensive marketing strategies are crucial for business success. Furthermore, leveraging digital platforms enables organizations to navigate complex consumer behaviors effectively. It is important to understand that customer engagement remains pivotal in driving brand loyalty." \
"aggressive" "business"

run_test "Financial_Analysis" \
"The quarterly financial report demonstrates robust revenue growth across all market segments. Subsequently, strategic investments in emerging technologies have yielded comprehensive returns. Moreover, operational efficiency improvements continue to drive sustainable profitability." \
"moderate" "business"

run_test "Management_Consulting" \
"Our comprehensive analysis reveals significant opportunities for organizational transformation. Furthermore, implementing agile methodologies will enhance operational efficiency. It is crucial to leverage cross-functional collaboration to navigate the complexities of digital transformation." \
"moderate" "business"

echo "Category 4: JOURNALISM/CONTENT"
echo "----------------------------------------"

run_test "News_Article" \
"Climate scientists have issued warnings about the accelerating pace of global warming. Consequently, coastal communities face unprecedented challenges in adapting to rising sea levels. Furthermore, international cooperation has become increasingly vital in addressing these environmental concerns." \
"moderate" "journalism"

run_test "Blog_Post" \
"In today's digital age, content creation has become more important than ever. It's worth noting that authenticity remains a key factor in audience engagement. Additionally, the rise of artificial intelligence tools has transformed the content landscape significantly." \
"aggressive" "journalism"

run_test "Opinion_Piece" \
"The current political landscape presents multifaceted challenges for democratic institutions. Furthermore, comprehensive electoral reforms are crucial for ensuring fair representation. It is worth noting that civic engagement plays a pivotal role in strengthening democratic processes." \
"moderate" "journalism"

echo "Category 5: EDUCATIONAL"
echo "----------------------------------------"

run_test "Textbook_Excerpt" \
"Understanding cellular biology requires a comprehensive examination of molecular processes. Furthermore, the intricate mechanisms of protein synthesis demonstrate the complexity of living systems. Subsequently, students must grasp these fundamental concepts to navigate advanced topics effectively." \
"moderate" "educational"

run_test "Tutorial_Guide" \
"This comprehensive guide will help you navigate the complexities of machine learning. Furthermore, understanding the fundamental algorithms is crucial for building robust models. It is worth noting that practical implementation requires extensive experimentation and iteration." \
"aggressive" "educational"

run_test "Course_Description" \
"This course provides a holistic understanding of modern economics principles. Moreover, comprehensive case studies demonstrate real-world applications of theoretical concepts. Subsequently, students will develop pivotal analytical skills for navigating complex market dynamics." \
"light" "educational"

echo "Category 6: CREATIVE/NARRATIVE"
echo "----------------------------------------"

run_test "Story_Intro" \
"The ancient forest harbored secrets that only the most intrepid explorers could comprehend. Furthermore, the tapestry of wildlife within created an intricate ecosystem of interconnected relationships. It was crucial to understand that every element played a vital role in maintaining this delicate balance." \
"aggressive" "creative"

run_test "Product_Description" \
"Our comprehensive solution addresses the multifaceted needs of modern consumers. Furthermore, the robust design ensures longevity and reliability in various conditions. It is worth noting that customer satisfaction remains our pivotal priority in product development." \
"moderate" "creative"

echo "Category 7: EDGE CASES"
echo "----------------------------------------"

run_test "Short_Text" \
"The implementation of machine learning algorithms is crucial for modern applications. Furthermore, comprehensive testing ensures reliable performance. Subsequently, organizations must leverage these technologies effectively." \
"light" "edge_case"

run_test "Long_Technical" \
"The comprehensive implementation of distributed systems architecture requires careful consideration of multiple factors including network latency, data consistency, and fault tolerance mechanisms. Furthermore, modern microservices approaches leverage containerization technologies to ensure scalable and robust deployment strategies across heterogeneous computing environments. Subsequently, implementing comprehensive monitoring and observability frameworks becomes crucial for maintaining system reliability and facilitating efficient debugging procedures. Moreover, the intricate nature of distributed consensus algorithms necessitates thorough understanding of theoretical foundations alongside practical implementation considerations. It is worth noting that security considerations must be holistically integrated throughout the development lifecycle rather than treated as an afterthought. Additionally, performance optimization strategies should leverage profiling tools to identify and address bottlenecks in the data processing pipeline." \
"aggressive" "edge_case"

run_test "Formal_Letter" \
"Dear Committee Members, it is with comprehensive consideration that we submit this proposal for your review. Furthermore, our organization has demonstrated robust commitment to the stated objectives. Subsequently, we believe this initiative will yield pivotal benefits for all stakeholders involved." \
"light" "edge_case"

# ========================================
# GENERATE SUMMARY
# ========================================

echo "========================================"
echo "GENERATING SUMMARY"
echo "========================================"

python3 << PYEOF
import json

with open("$RESULTS_FILE", "r") as f:
    data = json.load(f)

tests = data["tests"]
total = len(tests)
passed = sum(1 for t in tests if t.get("passed", False))
failed = total - passed

# Calculate averages
avg_conf_drop = sum(t.get("confidence_drop", 0) for t in tests) / total if total > 0 else 0
avg_duration = sum(t.get("duration_ms", 0) for t in tests) / total if total > 0 else 0
verdict_flips = sum(1 for t in tests if t.get("original_verdict") == "ai" and t.get("final_verdict") == "human")

# By category
categories = {}
for t in tests:
    cat = t.get("category", "unknown")
    if cat not in categories:
        categories[cat] = {"total": 0, "passed": 0, "avg_drop": []}
    categories[cat]["total"] += 1
    if t.get("passed"):
        categories[cat]["passed"] += 1
    categories[cat]["avg_drop"].append(t.get("confidence_drop", 0))

for cat in categories:
    drops = categories[cat]["avg_drop"]
    categories[cat]["avg_drop"] = sum(drops) / len(drops) if drops else 0

# By intensity
intensities = {}
for t in tests:
    intensity = t.get("intensity", "unknown")
    if intensity not in intensities:
        intensities[intensity] = {"total": 0, "passed": 0, "avg_drop": []}
    intensities[intensity]["total"] += 1
    if t.get("passed"):
        intensities[intensity]["passed"] += 1
    intensities[intensity]["avg_drop"].append(t.get("confidence_drop", 0))

for i in intensities:
    drops = intensities[i]["avg_drop"]
    intensities[i]["avg_drop"] = sum(drops) / len(drops) if drops else 0

# Update summary
data["summary"] = {
    "total_tests": total,
    "passed": passed,
    "failed": failed,
    "pass_rate": round(passed / total * 100, 1) if total > 0 else 0,
    "avg_confidence_drop": round(avg_conf_drop, 1),
    "avg_duration_ms": round(avg_duration, 0),
    "verdict_flips_ai_to_human": verdict_flips,
    "by_category": {cat: {"pass_rate": round(v["passed"]/v["total"]*100, 1) if v["total"] > 0 else 0, "avg_drop": round(v["avg_drop"], 1)} for cat, v in categories.items()},
    "by_intensity": {i: {"pass_rate": round(v["passed"]/v["total"]*100, 1) if v["total"] > 0 else 0, "avg_drop": round(v["avg_drop"], 1)} for i, v in intensities.items()}
}

with open("$RESULTS_FILE", "w") as f:
    json.dump(data, f, indent=2)

print("\n" + "="*50)
print("TEST SUMMARY")
print("="*50)
print(f"Total Tests: {total}")
print(f"Passed: {passed} ({data['summary']['pass_rate']}%)")
print(f"Failed: {failed}")
print(f"Average Confidence Drop: {data['summary']['avg_confidence_drop']} points")
print(f"Average Duration: {data['summary']['avg_duration_ms']}ms")
print(f"Verdict Flips (AI->Human): {verdict_flips}")
print()
print("By Category:")
for cat, stats in data["summary"]["by_category"].items():
    print(f"  {cat}: {stats['pass_rate']}% pass, avg drop {stats['avg_drop']} pts")
print()
print("By Intensity:")
for i, stats in data["summary"]["by_intensity"].items():
    print(f"  {i}: {stats['pass_rate']}% pass, avg drop {stats['avg_drop']} pts")
print()
print(f"Full results saved to: $RESULTS_FILE")
PYEOF

echo ""
echo "Done!"
