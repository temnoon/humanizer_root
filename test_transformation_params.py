"""
Comprehensive Test Suite for Transformation Parameter Interpretation

Tests all 5 POVM packs with various stance configurations to ensure
the LLM correctly interprets semantic parameters.
"""

import pytest
import asyncio
from humanizer.services.transformation import TransformationService


class TestCase:
    """Single transformation test case."""

    def __init__(
        self,
        name: str,
        input_text: str,
        expected_changes: list[str],
        povm_pack: str,
        target_stance: dict,
        min_grade: float = 4.0,
    ):
        self.name = name
        self.input_text = input_text
        self.expected_changes = expected_changes
        self.povm_pack = povm_pack
        self.target_stance = target_stance
        self.min_grade = min_grade

    def grade(self, output_text: str) -> tuple[float, list[str]]:
        """
        Grade transformation output (0-5 scale).

        Returns:
            (grade, feedback_list)
        """
        score = 5.0
        feedback = []

        # Check each expected change
        for expected in self.expected_changes:
            if expected not in output_text.lower():
                score -= 0.5
                feedback.append(f"❌ Missing: {expected}")
            else:
                feedback.append(f"✅ Found: {expected}")

        # Check for common problems
        if "(A:" in output_text or "(notA:" in output_text:
            score -= 2.0
            feedback.append("❌ CRITICAL: Stance labels in output!")

        if "it's worth noting" in output_text.lower():
            score -= 0.5
            feedback.append("❌ Added AI hedging")

        if len(output_text) < len(self.input_text) * 0.8:
            score -= 1.0
            feedback.append("❌ Output too short (truncated)")

        return (max(0, min(5, score)), feedback)


# =============================================================================
# Test Cases by POVM Pack
# =============================================================================

TETRALEMMA_TESTS = [
    TestCase(
        name="Tetralemma_A_Definite",
        input_text="It could be argued that phenomenology marks a pivotal shift in philosophy.",
        expected_changes=[
            "phenomenology marks",
            "is a",
            "shift",
        ],
        povm_pack="tetralemma",
        target_stance={"A": 0.7, "¬A": 0.1, "both": 0.1, "neither": 0.1},
    ),
    TestCase(
        name="Tetralemma_NotA_Critical",
        input_text="Phenomenology is a revolutionary approach to philosophy.",
        expected_changes=[
            "isn't",
            "not really",
            "question",
        ],
        povm_pack="tetralemma",
        target_stance={"A": 0.1, "¬A": 0.7, "both": 0.1, "neither": 0.1},
    ),
    TestCase(
        name="Tetralemma_Both_Paradox",
        input_text="Consciousness is either fundamental or emergent.",
        expected_changes=[
            "both",
            "and",
            "paradox",
        ],
        povm_pack="tetralemma",
        target_stance={"A": 0.1, "¬A": 0.1, "both": 0.7, "neither": 0.1},
    ),
]

TONE_TESTS = [
    TestCase(
        name="Tone_Analytical",
        input_text="Husserl wanted to study how we think about things.",
        expected_changes=[
            "systematic",
            "investigate",
            "structures",
        ],
        povm_pack="tone",
        target_stance={
            "analytical": 0.7,
            "critical": 0.1,
            "empathic": 0.1,
            "playful": 0.05,
            "neutral": 0.05,
        },
    ),
    TestCase(
        name="Tone_Empathic",
        input_text="The phenomenological method examines consciousness systematically.",
        expected_changes=[
            "we",
            "you",
            "understand",
        ],
        povm_pack="tone",
        target_stance={
            "analytical": 0.1,
            "critical": 0.1,
            "empathic": 0.7,
            "playful": 0.05,
            "neutral": 0.05,
        },
    ),
    TestCase(
        name="Tone_Playful",
        input_text="Transcendental phenomenology investigates the conditions of experience.",
        expected_changes=[
            "like",
            "imagine",
            "think of it as",
        ],
        povm_pack="tone",
        target_stance={
            "analytical": 0.1,
            "critical": 0.1,
            "empathic": 0.1,
            "playful": 0.6,
            "neutral": 0.1,
        },
    ),
]

AUDIENCE_TESTS = [
    TestCase(
        name="Audience_General",
        input_text="Transcendental phenomenology elucidates the eidetic structures underlying noetic-noematic correlations.",
        expected_changes=[
            "helps us understand",
            "essential patterns",
            "how",
        ],
        povm_pack="audience",
        target_stance={
            "expert": 0.1,
            "general": 0.7,
            "student": 0.1,
            "policy": 0.05,
            "editorial": 0.05,
        },
    ),
    TestCase(
        name="Audience_Expert",
        input_text="Phenomenology helps us understand consciousness and experience.",
        expected_changes=[
            "noetic",
            "eidetic",
            "transcendental",
        ],
        povm_pack="audience",
        target_stance={
            "expert": 0.7,
            "general": 0.1,
            "student": 0.1,
            "policy": 0.05,
            "editorial": 0.05,
        },
    ),
]

PRAGMATICS_TESTS = [
    TestCase(
        name="Pragmatics_Clarity",
        input_text="One might consider that, given various theoretical considerations and in light of diverse perspectives, phenomenology could potentially be understood as a method.",
        expected_changes=[
            "phenomenology is a method",
            "clear",
            "simple",
        ],
        povm_pack="pragmatics",
        target_stance={
            "clarity": 0.7,
            "coherence": 0.15,
            "evidence": 0.1,
            "charity": 0.05,
        },
    ),
    TestCase(
        name="Pragmatics_Evidence",
        input_text="Husserl's work changed philosophy.",
        expected_changes=[
            "studies",
            "research",
            "evidence",
        ],
        povm_pack="pragmatics",
        target_stance={
            "clarity": 0.1,
            "coherence": 0.1,
            "evidence": 0.7,
            "charity": 0.1,
        },
    ),
]

ALL_TESTS = (
    TETRALEMMA_TESTS + TONE_TESTS + AUDIENCE_TESTS + PRAGMATICS_TESTS
)


# =============================================================================
# Test Runner
# =============================================================================


async def run_test(test_case: TestCase, service: TransformationService) -> dict:
    """Run single test case."""
    print(f"\n{'='*60}")
    print(f"Test: {test_case.name}")
    print(f"Pack: {test_case.povm_pack}")
    print(f"Target: {test_case.target_stance}")
    print(f"Input: {test_case.input_text[:100]}...")

    try:
        result = await service.transform_trm(
            text=test_case.input_text,
            povm_pack_name=test_case.povm_pack,
            target_stance=test_case.target_stance,
            max_iterations=3,  # Faster for tests
        )

        output = result["transformed_text"]
        grade, feedback = test_case.grade(output)

        print(f"\nOutput: {output[:100]}...")
        print(f"\nGrade: {grade}/5.0")
        for line in feedback:
            print(f"  {line}")

        passed = grade >= test_case.min_grade
        print(f"\n{'✅ PASS' if passed else '❌ FAIL'}")

        return {
            "test": test_case.name,
            "passed": passed,
            "grade": grade,
            "output": output,
            "feedback": feedback,
        }

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return {
            "test": test_case.name,
            "passed": False,
            "grade": 0.0,
            "output": "",
            "feedback": [f"Error: {str(e)}"],
        }


async def run_all_tests():
    """Run full test suite."""
    print("="*60)
    print("TRANSFORMATION PARAMETER TEST SUITE")
    print("="*60)

    service = TransformationService()
    results = []

    for test in ALL_TESTS:
        result = await run_test(test, service)
        results.append(result)

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    avg_grade = sum(r["grade"] for r in results) / total if total > 0 else 0

    print(f"Passed: {passed}/{total} ({passed/total*100:.1f}%)")
    print(f"Average Grade: {avg_grade:.2f}/5.0")

    if avg_grade >= 4.5:
        print("\n🎉 EXCELLENT! All parameters interpreted correctly.")
    elif avg_grade >= 3.5:
        print("\n✅ GOOD! Most parameters working, some improvements needed.")
    elif avg_grade >= 2.5:
        print("\n⚠️  FAIR. Major improvements needed.")
    else:
        print("\n❌ POOR. System not interpreting parameters.")

    return results


if __name__ == "__main__":
    asyncio.run(run_all_tests())
