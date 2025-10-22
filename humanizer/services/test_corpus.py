"""
Test Corpus for TRM Transformation Evaluation

Diverse test cases covering all POVM packs with known transformation patterns.

Structure:
- Each test case has: original text, target axis, POVM pack, expected characteristics
- Organized by difficulty: simple, moderate, complex
- Covers all 5 POVM packs: tetralemma, tone, ontology, pragmatics, audience

Usage:
    from humanizer.services.test_corpus import TEST_CORPUS, get_tests_by_difficulty

    # Get all simple tests
    simple_tests = get_tests_by_difficulty("simple")

    # Get all tone transformations
    tone_tests = get_tests_by_pack("tone")
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
from enum import Enum


class Difficulty(str, Enum):
    """Test difficulty levels."""
    SIMPLE = "simple"      # Single concept, clear transformation
    MODERATE = "moderate"  # Multiple concepts, some nuance
    COMPLEX = "complex"    # Abstract concepts, subtle shifts


@dataclass
class TestCase:
    """
    Test case for transformation evaluation.

    Attributes:
        id: Unique identifier
        text: Original text to transform
        povm_pack: POVM pack name (tetralemma, tone, etc.)
        target_axis: Target axis within pack
        difficulty: Test difficulty level
        expected_improvement: Minimum expected improvement (0-1)
        expected_keywords: Keywords that should appear in transformation
        notes: Additional context or expectations
    """
    id: str
    text: str
    povm_pack: str
    target_axis: str
    difficulty: Difficulty
    expected_improvement: float = 0.1  # Default: at least 10% improvement
    expected_keywords: Optional[List[str]] = None
    notes: Optional[str] = None


# ============================================================================
# TONE PACK TEST CASES
# ============================================================================

TONE_TESTS = [
    # Simple: analytical
    TestCase(
        id="tone_analytical_01",
        text="I think this is pretty cool and worth checking out.",
        povm_pack="tone",
        target_axis="analytical",
        difficulty=Difficulty.SIMPLE,
        expected_improvement=0.15,
        expected_keywords=["analysis", "examination", "evidence", "data"],
        notes="Informal → analytical should be straightforward"
    ),

    TestCase(
        id="tone_analytical_02",
        text="The weather today feels nice.",
        povm_pack="tone",
        target_axis="analytical",
        difficulty=Difficulty.SIMPLE,
        expected_improvement=0.12,
        expected_keywords=["temperature", "conditions", "measurements"],
        notes="Subjective feeling → objective observation"
    ),

    # Moderate: critical
    TestCase(
        id="tone_critical_01",
        text="The proposal suggests some interesting ideas that might work.",
        povm_pack="tone",
        target_axis="critical",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.12,
        expected_keywords=["however", "although", "limitations", "concerns"],
        notes="Neutral → critical requires identifying weaknesses"
    ),

    TestCase(
        id="tone_critical_02",
        text="This approach has been used successfully in similar cases.",
        povm_pack="tone",
        target_axis="critical",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.10,
        expected_keywords=["question", "examine", "assumptions", "risks"],
        notes="Positive → critical needs skeptical framing"
    ),

    # Complex: empathic
    TestCase(
        id="tone_empathic_01",
        text="The data shows a 15% decline in user retention over Q3.",
        povm_pack="tone",
        target_axis="empathic",
        difficulty=Difficulty.COMPLEX,
        expected_improvement=0.08,
        expected_keywords=["users", "experience", "challenges", "understand"],
        notes="Data-driven → empathic requires humanizing statistics"
    ),

    TestCase(
        id="tone_empathic_02",
        text="Systemic failures led to the observed inefficiencies.",
        povm_pack="tone",
        target_axis="empathic",
        difficulty=Difficulty.COMPLEX,
        expected_improvement=0.10,
        expected_keywords=["people", "impact", "affected", "struggle"],
        notes="Abstract systems → human impact"
    ),
]

# ============================================================================
# TETRALEMMA PACK TEST CASES
# ============================================================================

TETRALEMMA_TESTS = [
    # Simple: A (affirmation)
    TestCase(
        id="tetralemma_A_01",
        text="This might not be the best approach.",
        povm_pack="tetralemma",
        target_axis="A",
        difficulty=Difficulty.SIMPLE,
        expected_improvement=0.12,
        expected_keywords=["is", "clearly", "demonstrates", "affirm"],
        notes="Negation → affirmation"
    ),

    # Simple: not_A (negation)
    TestCase(
        id="tetralemma_notA_01",
        text="This solution works well for most cases.",
        povm_pack="tetralemma",
        target_axis="¬A",
        difficulty=Difficulty.SIMPLE,
        expected_improvement=0.12,
        expected_keywords=["not", "fails", "inadequate", "insufficient"],
        notes="Affirmation → negation"
    ),

    # Moderate: both (paradox)
    TestCase(
        id="tetralemma_both_01",
        text="The policy will either succeed or fail.",
        povm_pack="tetralemma",
        target_axis="both",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.10,
        expected_keywords=["simultaneously", "paradoxically", "both", "and yet"],
        notes="Binary → paradoxical (hold both)"
    ),

    # Complex: neither (transcendent)
    TestCase(
        id="tetralemma_neither_01",
        text="We must choose between efficiency and quality.",
        povm_pack="tetralemma",
        target_axis="neither",
        difficulty=Difficulty.COMPLEX,
        expected_improvement=0.08,
        expected_keywords=["beyond", "transcends", "false dichotomy", "reframe"],
        notes="Binary choice → neither/transcendent"
    ),
]

# ============================================================================
# ONTOLOGY PACK TEST CASES
# ============================================================================

ONTOLOGY_TESTS = [
    # Simple: objective
    TestCase(
        id="ontology_objective_01",
        text="I feel that this data is important.",
        povm_pack="ontology",
        target_axis="objective",
        difficulty=Difficulty.SIMPLE,
        expected_improvement=0.15,
        expected_keywords=["demonstrates", "indicates", "shows", "evidence"],
        notes="Subjective feeling → objective fact"
    ),

    # Moderate: subjective
    TestCase(
        id="ontology_subjective_01",
        text="The measurements indicate a 5% increase.",
        povm_pack="ontology",
        target_axis="subjective",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.12,
        expected_keywords=["appears", "seems", "perceive", "experience"],
        notes="Objective data → subjective experience"
    ),

    # Moderate: corporeal
    TestCase(
        id="ontology_corporeal_01",
        text="The concept of resilience emerged from the data.",
        povm_pack="ontology",
        target_axis="corporeal",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.10,
        expected_keywords=["physical", "tangible", "embodied", "material"],
        notes="Abstract concept → physical manifestation"
    ),
]

# ============================================================================
# PRAGMATICS PACK TEST CASES
# ============================================================================

PRAGMATICS_TESTS = [
    # Simple: clarity
    TestCase(
        id="pragmatics_clarity_01",
        text="There might be some potential issues with the thing we discussed.",
        povm_pack="pragmatics",
        target_axis="clarity",
        difficulty=Difficulty.SIMPLE,
        expected_improvement=0.15,
        expected_keywords=["specific", "precisely", "explicitly", "clear"],
        notes="Vague → precise"
    ),

    # Moderate: evidence
    TestCase(
        id="pragmatics_evidence_01",
        text="Many experts believe this approach is effective.",
        povm_pack="pragmatics",
        target_axis="evidence",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.12,
        expected_keywords=["study", "research", "data", "findings", "demonstrated"],
        notes="Appeal to authority → empirical evidence"
    ),

    # Moderate: coherence
    TestCase(
        id="pragmatics_coherence_01",
        text="The system failed. We need better planning. Users complained.",
        povm_pack="pragmatics",
        target_axis="coherence",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.10,
        expected_keywords=["therefore", "because", "consequently", "leading to"],
        notes="Disconnected statements → logical flow"
    ),
]

# ============================================================================
# AUDIENCE PACK TEST CASES
# ============================================================================

AUDIENCE_TESTS = [
    # Simple: general
    TestCase(
        id="audience_general_01",
        text="The TCP/IP protocol stack utilizes a four-layer architecture.",
        povm_pack="audience",
        target_axis="general",
        difficulty=Difficulty.SIMPLE,
        expected_improvement=0.15,
        expected_keywords=["internet", "network", "communication", "simple"],
        notes="Technical → layperson"
    ),

    # Moderate: expert
    TestCase(
        id="audience_expert_01",
        text="Networks help computers talk to each other.",
        povm_pack="audience",
        target_axis="expert",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.12,
        expected_keywords=["protocol", "layer", "specification", "implementation"],
        notes="Simple → technical depth"
    ),

    # Moderate: student
    TestCase(
        id="audience_student_01",
        text="The algorithm optimizes latency through adaptive buffering.",
        povm_pack="audience",
        target_axis="student",
        difficulty=Difficulty.MODERATE,
        expected_improvement=0.10,
        expected_keywords=["learn", "example", "step", "understand"],
        notes="Dense technical → pedagogical"
    ),
]

# ============================================================================
# COMBINED CORPUS
# ============================================================================

TEST_CORPUS: List[TestCase] = (
    TONE_TESTS +
    TETRALEMMA_TESTS +
    ONTOLOGY_TESTS +
    PRAGMATICS_TESTS +
    AUDIENCE_TESTS
)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_tests_by_difficulty(difficulty: Difficulty) -> List[TestCase]:
    """Get all test cases of a specific difficulty."""
    return [test for test in TEST_CORPUS if test.difficulty == difficulty]


def get_tests_by_pack(pack_name: str) -> List[TestCase]:
    """Get all test cases for a specific POVM pack."""
    return [test for test in TEST_CORPUS if test.povm_pack == pack_name]


def get_tests_by_target(pack_name: str, target_axis: str) -> List[TestCase]:
    """Get test cases for a specific transformation target."""
    return [
        test for test in TEST_CORPUS
        if test.povm_pack == pack_name and test.target_axis == target_axis
    ]


def get_corpus_stats() -> Dict[str, int]:
    """Get statistics about the test corpus."""
    stats = {
        "total_tests": len(TEST_CORPUS),
        "by_difficulty": {
            "simple": len(get_tests_by_difficulty(Difficulty.SIMPLE)),
            "moderate": len(get_tests_by_difficulty(Difficulty.MODERATE)),
            "complex": len(get_tests_by_difficulty(Difficulty.COMPLEX)),
        },
        "by_pack": {
            "tone": len(get_tests_by_pack("tone")),
            "tetralemma": len(get_tests_by_pack("tetralemma")),
            "ontology": len(get_tests_by_pack("ontology")),
            "pragmatics": len(get_tests_by_pack("pragmatics")),
            "audience": len(get_tests_by_pack("audience")),
        }
    }
    return stats


# ============================================================================
# VALIDATION
# ============================================================================

if __name__ == "__main__":
    """Print corpus statistics."""
    stats = get_corpus_stats()

    print("=" * 80)
    print("TRM TEST CORPUS STATISTICS")
    print("=" * 80)
    print()
    print(f"Total test cases: {stats['total_tests']}")
    print()
    print("By difficulty:")
    for diff, count in stats['by_difficulty'].items():
        print(f"  {diff}: {count}")
    print()
    print("By POVM pack:")
    for pack, count in stats['by_pack'].items():
        print(f"  {pack}: {count}")
    print()
    print("Test case examples:")
    for pack in ["tone", "tetralemma", "ontology", "pragmatics", "audience"]:
        tests = get_tests_by_pack(pack)
        if tests:
            test = tests[0]
            print(f"\n{pack.upper()} - {test.id}:")
            print(f"  Text: {test.text[:60]}...")
            print(f"  Target: {test.target_axis}")
            print(f"  Difficulty: {test.difficulty}")
