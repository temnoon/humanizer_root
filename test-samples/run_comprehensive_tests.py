#!/usr/bin/env python3
"""
Comprehensive Humanizer Test Suite
Loads samples from samples.json and runs tests against the humanizer API

Usage:
    python3 run_comprehensive_tests.py [--category CATEGORY] [--limit N] [--parallel N]

Options:
    --category    Only run tests for specific category (academic, technical, business, creative, educational, edge-cases)
    --limit       Limit number of tests to run
    --parallel    Number of parallel workers (default: 1 for sequential)
    --output      Output file path (default: results_{timestamp}.json)
"""

import argparse
import json
import subprocess
import sys
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

# Configuration
API_URL = "http://localhost:8787/transformations/computer-humanizer"
SAMPLES_FILE = Path(__file__).parent / "samples.json"
DEFAULT_TIMEOUT = 120  # seconds

# Success criteria from the plan
SUCCESS_CRITERIA = {
    "pass_rate_target": 90,
    "pass_rate_minimum": 80,
    "avg_confidence_drop_target": 30,
    "avg_confidence_drop_minimum": 25,
    "tellword_elimination_target": 100,
    "tellword_elimination_minimum": 90,
    "verdict_flip_target": 30,
    "verdict_flip_minimum": 20,
    "max_duration_target": 30000,  # 30s
    "max_duration_limit": 60000,   # 60s
}


def load_samples(samples_file: Path, category: str = None, limit: int = None) -> list:
    """Load test samples from JSON file"""
    with open(samples_file) as f:
        data = json.load(f)

    samples = data.get("samples", [])

    if category:
        samples = [s for s in samples if s.get("category") == category]

    if limit:
        samples = samples[:limit]

    return samples


def run_single_test(sample: dict, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Run a single test against the humanizer API"""
    start_time = time.time()

    payload = {
        "text": sample["text"],
        "intensity": sample.get("intensity", "moderate"),
        "enableLLMPolish": True
    }

    try:
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", API_URL,
             "-H", "Content-Type: application/json",
             "-d", json.dumps(payload)],
            capture_output=True,
            text=True,
            timeout=timeout
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        if result.returncode != 0:
            return {
                "id": sample.get("id", "unknown"),
                "name": sample.get("name", "unknown"),
                "category": sample.get("category", "unknown"),
                "intensity": sample.get("intensity", "unknown"),
                "error": f"curl failed with code {result.returncode}",
                "duration_ms": elapsed_ms
            }

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            return {
                "id": sample.get("id", "unknown"),
                "name": sample.get("name", "unknown"),
                "category": sample.get("category", "unknown"),
                "intensity": sample.get("intensity", "unknown"),
                "error": f"JSON parse error: {e}",
                "duration_ms": elapsed_ms
            }

        # Extract metrics
        baseline = data.get("baseline", {}).get("detection", {})
        final = data.get("final", {}).get("detection", {})
        improvement = data.get("improvement", {})
        processing = data.get("processing", {})

        original_confidence = baseline.get("confidence", -1)
        final_confidence = final.get("confidence", -1)
        confidence_drop = improvement.get("aiConfidenceDrop", 0)
        original_tellwords = baseline.get("detectedTellWords", [])
        final_tellwords = final.get("detectedTellWords", [])
        original_verdict = baseline.get("verdict", "unknown")
        final_verdict = final.get("verdict", "unknown")
        original_burstiness = baseline.get("signals", {}).get("burstiness", 0)
        final_burstiness = final.get("signals", {}).get("burstiness", 0)

        # Determine pass/fail
        # A test "passes" if confidence drop > 10 points OR final verdict is "human"
        passed = confidence_drop > 10 or final_verdict == "human"

        # Determine if tell-words were fully eliminated
        tellwords_eliminated = len(final_tellwords) == 0

        # Determine verdict flip
        verdict_flipped = original_verdict == "ai" and final_verdict == "human"

        return {
            "id": sample.get("id", "unknown"),
            "name": sample.get("name", "unknown"),
            "category": sample.get("category", "unknown"),
            "intensity": sample.get("intensity", "unknown"),
            "original_confidence": original_confidence,
            "final_confidence": final_confidence,
            "confidence_drop": confidence_drop,
            "original_tellwords": len(original_tellwords),
            "final_tellwords": len(final_tellwords),
            "tellwords_eliminated": tellwords_eliminated,
            "original_verdict": original_verdict,
            "final_verdict": final_verdict,
            "verdict_flipped": verdict_flipped,
            "original_burstiness": round(original_burstiness, 2),
            "final_burstiness": round(final_burstiness, 2),
            "burstiness_increase": round(final_burstiness - original_burstiness, 2),
            "duration_ms": processing.get("totalDurationMs", elapsed_ms),
            "passed": passed,
            "humanized_preview": data.get("humanizedText", "")[:100] + "..."
        }

    except subprocess.TimeoutExpired:
        return {
            "id": sample.get("id", "unknown"),
            "name": sample.get("name", "unknown"),
            "category": sample.get("category", "unknown"),
            "intensity": sample.get("intensity", "unknown"),
            "error": f"Timeout after {timeout}s",
            "duration_ms": timeout * 1000
        }
    except Exception as e:
        return {
            "id": sample.get("id", "unknown"),
            "name": sample.get("name", "unknown"),
            "category": sample.get("category", "unknown"),
            "intensity": sample.get("intensity", "unknown"),
            "error": str(e),
            "duration_ms": int((time.time() - start_time) * 1000)
        }


def run_tests(samples: list, parallel: int = 1) -> list:
    """Run all tests, optionally in parallel"""
    results = []
    total = len(samples)

    if parallel > 1:
        print(f"Running {total} tests with {parallel} parallel workers...")
        with ThreadPoolExecutor(max_workers=parallel) as executor:
            future_to_sample = {executor.submit(run_single_test, sample): sample for sample in samples}
            completed = 0
            for future in as_completed(future_to_sample):
                completed += 1
                result = future.result()
                results.append(result)

                # Print progress
                status = "PASS" if result.get("passed") else ("ERROR" if "error" in result else "FAIL")
                name = result.get("name", "unknown")
                print(f"[{completed}/{total}] {name}: {status}")
    else:
        print(f"Running {total} tests sequentially...")
        for i, sample in enumerate(samples, 1):
            result = run_single_test(sample)
            results.append(result)

            # Print detailed progress
            if "error" in result:
                print(f"[{i}/{total}] {result['name']}: ERROR - {result['error']}")
            else:
                status = "PASS" if result.get("passed") else "NEEDS WORK"
                drop = result.get("confidence_drop", 0)
                original = result.get("original_confidence", -1)
                final = result.get("final_confidence", -1)
                print(f"[{i}/{total}] {result['name']}: {original}% -> {final}% (drop: {drop}) [{status}]")

    return results


def compute_summary(results: list) -> dict:
    """Compute summary statistics from test results"""
    valid_results = [r for r in results if "error" not in r]
    error_results = [r for r in results if "error" in r]

    total = len(results)
    passed = sum(1 for r in valid_results if r.get("passed", False))
    failed = len(valid_results) - passed
    errors = len(error_results)

    # Calculate metrics from valid results
    if valid_results:
        confidence_drops = [r.get("confidence_drop", 0) for r in valid_results]
        durations = [r.get("duration_ms", 0) for r in valid_results]

        avg_confidence_drop = statistics.mean(confidence_drops)
        median_confidence_drop = statistics.median(confidence_drops)
        std_confidence_drop = statistics.stdev(confidence_drops) if len(confidence_drops) > 1 else 0

        avg_duration = statistics.mean(durations)
        max_duration = max(durations)

        tellword_elimination_rate = sum(1 for r in valid_results if r.get("tellwords_eliminated", False)) / len(valid_results) * 100
        verdict_flip_rate = sum(1 for r in valid_results if r.get("verdict_flipped", False)) / len(valid_results) * 100
    else:
        avg_confidence_drop = 0
        median_confidence_drop = 0
        std_confidence_drop = 0
        avg_duration = 0
        max_duration = 0
        tellword_elimination_rate = 0
        verdict_flip_rate = 0

    pass_rate = (passed / total * 100) if total > 0 else 0

    # Group by category
    by_category = {}
    for r in valid_results:
        cat = r.get("category", "unknown")
        if cat not in by_category:
            by_category[cat] = {"total": 0, "passed": 0, "drops": [], "durations": []}
        by_category[cat]["total"] += 1
        if r.get("passed"):
            by_category[cat]["passed"] += 1
        by_category[cat]["drops"].append(r.get("confidence_drop", 0))
        by_category[cat]["durations"].append(r.get("duration_ms", 0))

    category_stats = {}
    for cat, data in by_category.items():
        category_stats[cat] = {
            "total": data["total"],
            "passed": data["passed"],
            "pass_rate": round(data["passed"] / data["total"] * 100, 1) if data["total"] > 0 else 0,
            "avg_confidence_drop": round(statistics.mean(data["drops"]), 1) if data["drops"] else 0,
            "avg_duration_ms": round(statistics.mean(data["durations"]), 0) if data["durations"] else 0
        }

    # Group by intensity
    by_intensity = {}
    for r in valid_results:
        intensity = r.get("intensity", "unknown")
        if intensity not in by_intensity:
            by_intensity[intensity] = {"total": 0, "passed": 0, "drops": []}
        by_intensity[intensity]["total"] += 1
        if r.get("passed"):
            by_intensity[intensity]["passed"] += 1
        by_intensity[intensity]["drops"].append(r.get("confidence_drop", 0))

    intensity_stats = {}
    for intensity, data in by_intensity.items():
        intensity_stats[intensity] = {
            "total": data["total"],
            "passed": data["passed"],
            "pass_rate": round(data["passed"] / data["total"] * 100, 1) if data["total"] > 0 else 0,
            "avg_confidence_drop": round(statistics.mean(data["drops"]), 1) if data["drops"] else 0
        }

    # Evaluate against success criteria
    criteria_results = {
        "pass_rate": {
            "value": round(pass_rate, 1),
            "target": SUCCESS_CRITERIA["pass_rate_target"],
            "minimum": SUCCESS_CRITERIA["pass_rate_minimum"],
            "status": "TARGET" if pass_rate >= SUCCESS_CRITERIA["pass_rate_target"] else ("ACCEPTABLE" if pass_rate >= SUCCESS_CRITERIA["pass_rate_minimum"] else "BELOW MINIMUM")
        },
        "avg_confidence_drop": {
            "value": round(avg_confidence_drop, 1),
            "target": SUCCESS_CRITERIA["avg_confidence_drop_target"],
            "minimum": SUCCESS_CRITERIA["avg_confidence_drop_minimum"],
            "status": "TARGET" if avg_confidence_drop >= SUCCESS_CRITERIA["avg_confidence_drop_target"] else ("ACCEPTABLE" if avg_confidence_drop >= SUCCESS_CRITERIA["avg_confidence_drop_minimum"] else "BELOW MINIMUM")
        },
        "tellword_elimination": {
            "value": round(tellword_elimination_rate, 1),
            "target": SUCCESS_CRITERIA["tellword_elimination_target"],
            "minimum": SUCCESS_CRITERIA["tellword_elimination_minimum"],
            "status": "TARGET" if tellword_elimination_rate >= SUCCESS_CRITERIA["tellword_elimination_target"] else ("ACCEPTABLE" if tellword_elimination_rate >= SUCCESS_CRITERIA["tellword_elimination_minimum"] else "BELOW MINIMUM")
        },
        "verdict_flip_rate": {
            "value": round(verdict_flip_rate, 1),
            "target": SUCCESS_CRITERIA["verdict_flip_target"],
            "minimum": SUCCESS_CRITERIA["verdict_flip_minimum"],
            "status": "TARGET" if verdict_flip_rate >= SUCCESS_CRITERIA["verdict_flip_target"] else ("ACCEPTABLE" if verdict_flip_rate >= SUCCESS_CRITERIA["verdict_flip_minimum"] else "BELOW MINIMUM")
        },
        "max_duration": {
            "value": max_duration,
            "target": SUCCESS_CRITERIA["max_duration_target"],
            "limit": SUCCESS_CRITERIA["max_duration_limit"],
            "status": "TARGET" if max_duration <= SUCCESS_CRITERIA["max_duration_target"] else ("ACCEPTABLE" if max_duration <= SUCCESS_CRITERIA["max_duration_limit"] else "EXCEEDS LIMIT")
        }
    }

    return {
        "timestamp": datetime.now().isoformat(),
        "total_tests": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "pass_rate": round(pass_rate, 1),
        "avg_confidence_drop": round(avg_confidence_drop, 1),
        "median_confidence_drop": round(median_confidence_drop, 1),
        "std_confidence_drop": round(std_confidence_drop, 1),
        "tellword_elimination_rate": round(tellword_elimination_rate, 1),
        "verdict_flip_rate": round(verdict_flip_rate, 1),
        "avg_duration_ms": round(avg_duration, 0),
        "max_duration_ms": max_duration,
        "by_category": category_stats,
        "by_intensity": intensity_stats,
        "criteria_evaluation": criteria_results
    }


def print_summary(summary: dict):
    """Print formatted summary to console"""
    print("\n" + "=" * 70)
    print("HUMANIZER COMPREHENSIVE TEST RESULTS")
    print("=" * 70)
    print(f"Timestamp: {summary['timestamp']}")
    print()

    print("OVERALL METRICS")
    print("-" * 40)
    print(f"Total Tests:           {summary['total_tests']}")
    print(f"Passed:                {summary['passed']} ({summary['pass_rate']}%)")
    print(f"Failed:                {summary['failed']}")
    print(f"Errors:                {summary['errors']}")
    print()

    print("QUALITY METRICS")
    print("-" * 40)
    print(f"Avg Confidence Drop:   {summary['avg_confidence_drop']} pts")
    print(f"Median Confidence Drop: {summary['median_confidence_drop']} pts")
    print(f"Std Dev:               {summary['std_confidence_drop']} pts")
    print(f"Tell-word Elimination: {summary['tellword_elimination_rate']}%")
    print(f"Verdict Flip Rate:     {summary['verdict_flip_rate']}%")
    print()

    print("PERFORMANCE")
    print("-" * 40)
    print(f"Avg Duration:          {summary['avg_duration_ms']}ms")
    print(f"Max Duration:          {summary['max_duration_ms']}ms")
    print()

    print("SUCCESS CRITERIA EVALUATION")
    print("-" * 40)
    for metric, data in summary.get("criteria_evaluation", {}).items():
        status_icon = {"TARGET": "[OK]", "ACCEPTABLE": "[~]", "BELOW MINIMUM": "[X]", "EXCEEDS LIMIT": "[X]"}.get(data["status"], "[?]")
        print(f"{status_icon} {metric}: {data['value']} (target: {data.get('target', 'N/A')}, min: {data.get('minimum', data.get('limit', 'N/A'))})")
    print()

    print("BY CATEGORY")
    print("-" * 40)
    for cat, stats in summary.get("by_category", {}).items():
        print(f"  {cat:15} {stats['pass_rate']:5.1f}% pass | avg drop: {stats['avg_confidence_drop']:5.1f} pts | avg time: {stats['avg_duration_ms']:6.0f}ms")
    print()

    print("BY INTENSITY")
    print("-" * 40)
    for intensity, stats in summary.get("by_intensity", {}).items():
        print(f"  {intensity:12} {stats['pass_rate']:5.1f}% pass | avg drop: {stats['avg_confidence_drop']:5.1f} pts")
    print()


def main():
    parser = argparse.ArgumentParser(description="Run comprehensive humanizer tests")
    parser.add_argument("--category", help="Filter by category")
    parser.add_argument("--limit", type=int, help="Limit number of tests")
    parser.add_argument("--parallel", type=int, default=1, help="Number of parallel workers")
    parser.add_argument("--output", help="Output file path")
    args = parser.parse_args()

    # Load samples
    samples = load_samples(SAMPLES_FILE, args.category, args.limit)

    if not samples:
        print("No samples found!")
        sys.exit(1)

    print(f"Loaded {len(samples)} samples from {SAMPLES_FILE}")
    print()

    # Run tests
    results = run_tests(samples, args.parallel)

    # Compute summary
    summary = compute_summary(results)

    # Print summary
    print_summary(summary)

    # Save results
    output_file = args.output or f"results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    output_path = Path(__file__).parent / output_file

    output_data = {
        "metadata": {
            "generated": summary["timestamp"],
            "samples_file": str(SAMPLES_FILE),
            "total_samples": len(samples),
            "category_filter": args.category,
            "parallel_workers": args.parallel
        },
        "summary": summary,
        "tests": results
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"Full results saved to: {output_path}")

    # Exit with non-zero if below minimum pass rate
    if summary["pass_rate"] < SUCCESS_CRITERIA["pass_rate_minimum"]:
        print(f"\nWARNING: Pass rate {summary['pass_rate']}% is below minimum {SUCCESS_CRITERIA['pass_rate_minimum']}%")
        sys.exit(1)

    print("\nTest suite completed successfully!")


if __name__ == "__main__":
    main()
