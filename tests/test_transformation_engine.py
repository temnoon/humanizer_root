"""
Test Transformation Engine - Unit tests for Phase 2A

Tests:
1. Rule application (word subs, phrase removal, sentence patterns)
2. RuleBasedStrategy transformation
3. POVM verification integration
4. Edge cases and error handling

Run with:
    poetry run pytest tests/test_transformation_engine.py -v
"""

import pytest
import numpy as np
from typing import Dict

from humanizer.services.transformation_engine import (
    TransformationContext,
    TransformationResult,
    TransformationMethod,
    RuleBasedStrategy,
)
from humanizer.services.transformation_rules import (
    apply_word_substitutions,
    apply_phrase_removal,
    apply_sentence_patterns,
    get_rules_for_axis,
    assess_rule_coverage,
    sample_rule_application,
    list_available_rules,
)


# ============================================================================
# Test Rule Application Functions
# ============================================================================

class TestRuleApplications:
    """Test individual rule application functions."""

    def test_word_substitutions_simple(self):
        """Test basic word substitution."""
        text = "I think the data shows some interesting results."
        rules = [
            {"from": "think", "to": "hypothesize"},
            {"from": "shows", "to": "demonstrates"},
            {"from": "some", "to": "certain"},
        ]

        result, applied = apply_word_substitutions(text, rules)

        assert "hypothesize" in result
        assert "demonstrates" in result
        assert "certain" in result
        assert "think" not in result
        assert "shows" not in result
        assert len(applied) == 3

    def test_word_substitutions_case_preservation(self):
        """Test that capitalization is preserved."""
        text = "Think about this. The data Shows results."
        rules = [
            {"from": "think", "to": "hypothesize"},
            {"from": "shows", "to": "demonstrates"},
        ]

        result, applied = apply_word_substitutions(text, rules)

        assert "Hypothesize" in result  # Capital preserved
        assert "Demonstrates" in result  # Capital preserved
        assert len(applied) == 2

    def test_word_substitutions_word_boundaries(self):
        """Test that word boundaries are respected."""
        text = "thinking about thickness"
        rules = [{"from": "think", "to": "hypothesize"}]

        result, applied = apply_word_substitutions(text, rules)

        # Should NOT match "thinking" or "thickness"
        assert "thinking" in result
        assert "thickness" in result
        assert len(applied) == 0

    def test_phrase_removal_hedging(self):
        """Test hedging phrase removal."""
        text = "I think maybe this could possibly work."
        rules = [
            {"pattern": r'\bI think\b\s*', "reason": "hedging"},
            {"pattern": r'\bmaybe\b\s*', "reason": "hedging"},
            {"pattern": r'\bpossibly\b\s*', "reason": "hedging"},
        ]

        result, applied = apply_phrase_removal(text, rules)

        assert "I think" not in result
        assert "maybe" not in result
        assert "possibly" not in result
        assert len(applied) == 3
        # Check that spacing is cleaned up
        assert "  " not in result

    def test_phrase_removal_filler(self):
        """Test filler phrase removal."""
        text = "You know, like, it basically works."
        rules = [
            {"pattern": r'\byou know\b\s*,?\s*', "reason": "filler"},
            {"pattern": r'\blike\b\s*,?\s*', "reason": "filler"},
            {"pattern": r'\bbasically\b\s*', "reason": "filler"},
        ]

        result, applied = apply_phrase_removal(text, rules)

        assert "you know" not in result.lower()
        assert "like," not in result.lower()
        assert "basically" not in result.lower()
        assert len(applied) == 3

    def test_sentence_patterns_framing(self):
        """Test adding analytical framing."""
        text = "The results are significant."
        patterns = [
            {
                "type": "add_framing",
                "prefix": "Analysis indicates that",
            }
        ]

        result, applied = apply_sentence_patterns(text, patterns)

        assert result.startswith("Analysis indicates that")
        assert "The results are significant" in result
        assert len(applied) == 1

    def test_sentence_patterns_no_duplicate_framing(self):
        """Test that framing is not duplicated."""
        text = "Analysis indicates that the results are significant."
        patterns = [
            {
                "type": "add_framing",
                "prefix": "Analysis indicates that",
            }
        ]

        result, applied = apply_sentence_patterns(text, patterns)

        # Should not add prefix again
        assert result.count("Analysis indicates that") == 1
        assert len(applied) == 0  # No changes made


# ============================================================================
# Test Rule Registry
# ============================================================================

class TestRuleRegistry:
    """Test rule lookup and availability."""

    def test_list_available_rules(self):
        """Test that rules are available."""
        available = list_available_rules()

        assert "tone" in available
        assert "analytical" in available["tone"]
        assert "empathic" in available["tone"]
        assert "critical" in available["tone"]

    def test_get_analytical_rules(self):
        """Test retrieving analytical rules."""
        rules = get_rules_for_axis("tone", "analytical")

        assert rules is not None
        assert "word_substitutions" in rules
        assert "phrase_removal" in rules
        assert "sentence_patterns" in rules

        # Check specific rules exist
        word_subs = rules["word_substitutions"]
        assert any(sub["from"] == "think" for sub in word_subs)

    def test_get_empathic_rules(self):
        """Test retrieving empathic rules."""
        rules = get_rules_for_axis("tone", "empathic")

        assert rules is not None
        word_subs = rules["word_substitutions"]
        # Empathic should have opposite transformations
        assert any(sub["from"] == "demonstrate" for sub in word_subs)

    def test_get_critical_rules(self):
        """Test retrieving critical rules."""
        rules = get_rules_for_axis("tone", "critical")

        assert rules is not None
        word_subs = rules["word_substitutions"]
        # Critical should strengthen claims
        assert any(sub["to"] == "indicates" for sub in word_subs)

    def test_get_nonexistent_pack(self):
        """Test requesting rules for non-existent pack."""
        rules = get_rules_for_axis("nonexistent", "analytical")
        assert rules is None

    def test_get_nonexistent_axis(self):
        """Test requesting rules for non-existent axis."""
        rules = get_rules_for_axis("tone", "nonexistent")
        assert rules is None


# ============================================================================
# Test Rule Coverage Assessment
# ============================================================================

class TestRuleCoverage:
    """Test rule coverage assessment."""

    def test_assess_coverage_high(self):
        """Test high coverage text."""
        text = "I think the data shows that we might get some results."
        coverage = assess_rule_coverage(text, "tone", "analytical")

        assert coverage["has_rules"]
        assert coverage["word_sub_matches"] > 0
        assert coverage["phrase_removal_matches"] > 0
        assert coverage["total_matches"] > 3

    def test_assess_coverage_low(self):
        """Test low coverage text."""
        text = "Quantum mechanics describes physical phenomena."
        coverage = assess_rule_coverage(text, "tone", "analytical")

        assert coverage["has_rules"]
        # Technical text may have fewer matches
        assert coverage["total_matches"] >= 0

    def test_assess_coverage_nonexistent_rules(self):
        """Test coverage with no rules available."""
        coverage = assess_rule_coverage("text", "nonexistent", "axis")

        assert not coverage["has_rules"]
        assert coverage["total_matches"] == 0


# ============================================================================
# Test Full Rule Application
# ============================================================================

class TestFullRuleApplication:
    """Test complete rule application workflow."""

    def test_analytical_transformation(self):
        """Test full analytical transformation."""
        text = "I think the data shows some interesting patterns."
        result = sample_rule_application(text, "tone", "analytical")

        assert result["success"]
        assert result["changed"]
        assert result["after"] != result["before"]

        # Check analytical markers
        after = result["after"]
        assert "hypothesize" in after or "demonstrates" in after
        assert "I think" not in after

    def test_empathic_transformation(self):
        """Test full empathic transformation."""
        text = "The individual must utilize the appropriate methodology."
        result = sample_rule_application(text, "tone", "empathic")

        assert result["success"]
        assert result["changed"]

        # Check empathic markers
        after = result["after"]
        assert "person" in after or "people" in after

    def test_critical_transformation(self):
        """Test full critical transformation."""
        text = "The study quite clearly shows that this approach works."
        result = sample_rule_application(text, "tone", "critical")

        assert result["success"]
        assert result["changed"]

        # Check critical markers
        after = result["after"]
        assert "quite" not in after  # Softening removed


# ============================================================================
# Test RuleBasedStrategy
# ============================================================================

class TestRuleBasedStrategy:
    """Test RuleBasedStrategy class."""

    @pytest.fixture
    def strategy(self):
        """Create RuleBasedStrategy instance."""
        return RuleBasedStrategy(rank=64)

    def test_strategy_initialization(self, strategy):
        """Test strategy initializes correctly."""
        assert strategy.rank == 64
        assert strategy.embedding_service is not None
        assert strategy.povm_packs is not None
        assert "tetralemma" in strategy.povm_packs
        assert "tone" in strategy.povm_packs

    def test_estimate_cost(self, strategy):
        """Test cost estimation (should be free)."""
        context = TransformationContext(
            text="Sample text",
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.3},
        )

        cost = strategy.estimate_cost(context)
        assert cost == 0.0

    def test_estimate_latency(self, strategy):
        """Test latency estimation."""
        short_text = "Short."
        long_text = "A" * 1000

        short_context = TransformationContext(
            text=short_text,
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.3},
        )

        long_context = TransformationContext(
            text=long_text,
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.3},
        )

        short_latency = strategy.estimate_latency(short_context)
        long_latency = strategy.estimate_latency(long_context)

        assert short_latency > 0
        assert long_latency > short_latency  # Longer text = higher latency

    def test_transform_analytical_success(self, strategy):
        """Test successful analytical transformation."""
        context = TransformationContext(
            text="I think the data shows some interesting results.",
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.3},
        )

        result = strategy.transform(context)

        assert isinstance(result, TransformationResult)
        assert result.method == TransformationMethod.RULE_BASED
        assert result.strategy_name == "RuleBasedStrategy"
        assert result.cost_usd == 0.0
        assert result.execution_time_ms > 0

        # Check transformation occurred
        assert result.transformed_text != context.text
        assert "hypothesize" in result.transformed_text or "demonstrates" in result.transformed_text

        # Check POVM measurements
        assert "analytical" in result.readings_before
        assert "analytical" in result.readings_after
        assert result.target_improvement != 0  # Should have some change

    def test_transform_empathic_success(self, strategy):
        """Test successful empathic transformation."""
        context = TransformationContext(
            text="The individual must utilize proper methodology.",
            target_axis="empathic",
            povm_pack_name="tone",
            current_readings={"empathic": 0.2},
        )

        result = strategy.transform(context)

        assert result.transformed_text != context.text
        # Should have warmer language
        assert "person" in result.transformed_text or "use" in result.transformed_text

    def test_transform_no_rules_available(self, strategy):
        """Test transformation when no rules exist."""
        context = TransformationContext(
            text="Sample text",
            target_axis="nonexistent_axis",
            povm_pack_name="tone",
            current_readings={},
        )

        result = strategy.transform(context)

        assert not result.success
        assert result.error_message is not None
        assert "No rules" in result.error_message

    def test_transform_excessive_change(self, strategy):
        """Test transformation that exceeds max change ratio."""
        # Use low max_change_ratio to trigger failure
        context = TransformationContext(
            text="Quantum entanglement exhibits nonlocal correlations.",
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.8},
            max_change_ratio=0.1,  # Very low threshold
        )

        result = strategy.transform(context)

        # Should transform but may not meet success criteria
        assert isinstance(result, TransformationResult)
        assert result.execution_time_ms > 0

        # Either succeeds with low change, or fails but produces a transformation
        if not result.success:
            # Should have made some change even if excessive
            assert result.text_change_ratio > 0

    def test_text_change_ratio_computation(self, strategy):
        """Test text change ratio calculation."""
        before = "I think the data shows results."
        after = "I hypothesize the data demonstrates results."

        ratio = strategy._compute_text_change_ratio(before, after)

        assert 0.0 <= ratio <= 1.0
        assert ratio > 0  # Some change occurred

    def test_coherence_assessment(self, strategy):
        """Test coherence assessment heuristic."""
        # Good text
        good_text = "The analysis demonstrates significant findings."
        good_score = strategy._assess_coherence(good_text, change_ratio=0.2)
        assert good_score > 0.5

        # Very changed text
        high_change_score = strategy._assess_coherence(good_text, change_ratio=0.8)
        assert high_change_score < good_score

        # Very short text
        short_text = "Hi"
        short_score = strategy._assess_coherence(short_text, change_ratio=0.1)
        assert short_score < good_score


# ============================================================================
# Integration Tests
# ============================================================================

class TestTransformationIntegration:
    """Test full transformation pipeline with real embeddings."""

    @pytest.fixture
    def strategy(self):
        """Create strategy instance."""
        return RuleBasedStrategy(rank=64)

    def test_end_to_end_analytical(self, strategy):
        """Test complete analytical transformation with POVM verification."""
        # Create context
        context = TransformationContext(
            text="I think we might see some interesting patterns in the data.",
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.25},
            target_threshold=0.65,
        )

        # Transform
        result = strategy.transform(context)

        # Verify result structure
        assert isinstance(result, TransformationResult)
        assert result.transformed_text != context.text

        # Verify POVM measurements
        assert "analytical" in result.readings_after
        assert isinstance(result.readings_after["analytical"], float)
        assert 0.0 <= result.readings_after["analytical"] <= 1.0

        # Verify all probabilities sum to 1
        total_prob = sum(result.readings_after.values())
        assert abs(total_prob - 1.0) < 0.01

        # Verify metrics
        assert result.execution_time_ms > 0
        assert result.rho_distance_moved >= 0
        assert 0.0 <= result.text_change_ratio <= 1.0
        assert 0.0 <= result.semantic_coherence <= 1.0

        # Verify rules were applied
        assert result.rules_applied is not None
        assert len(result.rules_applied) > 0

    def test_end_to_end_critical(self, strategy):
        """Test complete critical transformation."""
        context = TransformationContext(
            text="The study quite possibly shows rather interesting findings.",
            target_axis="critical",
            povm_pack_name="tone",
            current_readings={"critical": 0.2},
        )

        result = strategy.transform(context)

        # Should strengthen language
        assert "quite" not in result.transformed_text or "possibly" not in result.transformed_text

        # Check POVM readings
        assert "critical" in result.readings_after


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

class TestEdgeCases:
    """Test edge cases and error conditions."""

    @pytest.fixture
    def strategy(self):
        return RuleBasedStrategy(rank=64)

    def test_empty_text(self, strategy):
        """Test transformation with empty text."""
        context = TransformationContext(
            text="",
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={},
        )

        # Should handle gracefully (may fail or return unchanged)
        result = strategy.transform(context)
        assert isinstance(result, TransformationResult)

    def test_very_short_text(self, strategy):
        """Test with very short text."""
        context = TransformationContext(
            text="Hi.",
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.5},
        )

        result = strategy.transform(context)
        assert isinstance(result, TransformationResult)

    def test_very_long_text(self, strategy):
        """Test with very long text."""
        long_text = "I think " * 200 + "this is interesting."

        context = TransformationContext(
            text=long_text,
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.3},
        )

        result = strategy.transform(context)
        assert isinstance(result, TransformationResult)
        assert result.execution_time_ms > 0

    def test_unicode_text(self, strategy):
        """Test with unicode characters."""
        context = TransformationContext(
            text="I think the café shows résumés with naïve approach.",
            target_axis="analytical",
            povm_pack_name="tone",
            current_readings={"analytical": 0.3},
        )

        result = strategy.transform(context)
        assert isinstance(result, TransformationResult)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
