"""
Evaluate Transformation Strategies - Week 4 Task 1

This script evaluates the effectiveness of transformation strategies on a test corpus.

Metrics measured:
- Success rate (% transformations that improve target axis)
- Average improvement (Δ POVM reading)
- Average text change ratio (0-1)
- Average coherence score (0-1)
- Rule coverage (how many rules match)
- Failure modes (why transformations fail)

Usage:
    poetry run python evaluate_transformation_strategies.py --strategy rule_based
    poetry run python evaluate_transformation_strategies.py --strategy llm_guided
    poetry run python evaluate_transformation_strategies.py --strategy hybrid
    poetry run python evaluate_transformation_strategies.py --all
"""

import argparse
import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import numpy as np

# TRM core
from humanizer.core.trm.density import construct_density_matrix
from humanizer.core.trm.povm import get_all_packs

# Services
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.services.transformation_engine import (
    RuleBasedStrategy,
    LLMGuidedStrategy,
    HybridStrategy,
    TransformationContext,
    TransformationResult,
    TransformationMethod
)
from humanizer.services.transformation_rules import (
    get_rules_for_axis,
    assess_rule_coverage,
    list_available_rules
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Test Corpus Sampling
# ============================================================================

def load_chatgpt_corpus_sample(n_texts: int = 100) -> List[str]:
    """
    Load sample texts from ChatGPT archive.

    Args:
        n_texts: Number of texts to sample

    Returns:
        List of text strings
    """
    # For now, use fallback corpus (database is async, evaluation is sync)
    # TODO: Add async corpus loading or use saved corpus file
    logger.info(f"Using fallback corpus (TODO: async database loading)")
    texts = _get_fallback_corpus()

    # Extend if needed
    while len(texts) < n_texts:
        texts.extend(_get_fallback_corpus())

    return texts[:n_texts]


def _get_fallback_corpus() -> List[str]:
    """Fallback corpus if database unavailable."""
    return [
        # Hedging/analytical (good for tone/analytical rules)
        "I think the data shows that we might get some interesting results from this approach.",
        "Maybe we could possibly see some patterns emerging from the analysis.",
        "It seems like the evidence sort of suggests a correlation between variables.",

        # Subjective/personal (good for ontology rules)
        "My experience suggests that personal growth emerges from embracing discomfort.",
        "I feel that consciousness is fundamentally subjective and irreducible.",
        "In my view, the mind constructs reality through layers of interpretation.",

        # Casual/conversational (good for tone/empathic rules)
        "You know, like, people really just want to feel understood and supported.",
        "It's basically about helping folks get what they need from the experience.",
        "I think we can actually make a big difference if we just try harder.",

        # Critical/questioning (good for tone/critical rules)
        "The evidence clearly demonstrates that this hypothesis is fundamentally flawed.",
        "This approach shows promise but fails to address several critical assumptions.",
        "While the results appear impressive, they may not generalize to real-world contexts.",

        # Formal/technical (good for testing transformations)
        "Research indicates that cognitive biases significantly impact decision-making processes.",
        "Analysis reveals that systematic patterns exist across multiple data points.",
        "From an objective standpoint, the measurements confirm the predicted outcomes.",

        # Abstract/philosophical (good for ontology rules)
        "The body knows things the mind refuses to acknowledge or accept.",
        "It seems possible that quantum effects play a role in consciousness.",
        "Reality exists independently of our perceptions and beliefs about it.",

        # Neutral/balanced (baseline)
        "The system processes information and generates appropriate responses.",
        "Various factors contribute to the observed phenomenon.",
    ]


# ============================================================================
# Evaluation Metrics
# ============================================================================

@dataclass
class AxisEvaluationResult:
    """Results for a single axis evaluation."""
    pack_name: str
    axis_name: str
    n_samples: int

    # Success metrics
    success_rate: float  # % that succeeded
    avg_improvement: float  # Avg Δ POVM reading
    avg_improvement_success_only: float  # Avg Δ for successes

    # Quality metrics
    avg_text_change_ratio: float
    avg_coherence: float
    avg_execution_time_ms: float

    # Rule metrics (rule-based only)
    avg_rules_matched: Optional[float] = None
    avg_rules_applied: Optional[float] = None

    # Cost metrics (LLM strategies)
    total_cost_usd: float = 0.0

    # Failure analysis
    failures_no_rules: int = 0
    failures_no_improvement: int = 0
    failures_too_much_change: int = 0
    failures_low_coherence: int = 0
    failures_error: int = 0


@dataclass
class StrategyEvaluationReport:
    """Complete evaluation report for a strategy."""
    strategy_name: str
    strategy_type: str
    evaluated_at: str

    # Overall metrics
    total_samples: int
    overall_success_rate: float
    overall_avg_improvement: float

    # Per-axis results
    axis_results: List[AxisEvaluationResult]

    # Best/worst performing axes
    best_axes: List[Tuple[str, str, float]]  # (pack, axis, success_rate)
    worst_axes: List[Tuple[str, str, float]]

    # Recommendations
    recommendations: List[str]


# ============================================================================
# Evaluation Engine
# ============================================================================

class TransformationEvaluator:
    """Evaluates transformation strategies on test corpus."""

    def __init__(
        self,
        archive_name: Optional[str] = None,
        operator_preference: str = "auto"
    ):
        """
        Initialize evaluator.

        Args:
            archive_name: Optional archive for adaptive operators
            operator_preference: Operator loading preference
        """
        self.archive_name = archive_name
        self.operator_preference = operator_preference
        self.embedding_service = get_sentence_embedding_service()
        self.povm_packs = get_all_packs(rank=64)

    def evaluate_strategy_on_axis(
        self,
        strategy,
        pack_name: str,
        axis_name: str,
        texts: List[str],
        target_threshold: float = 0.65
    ) -> AxisEvaluationResult:
        """
        Evaluate strategy on a specific POVM axis.

        Args:
            strategy: Transformation strategy instance
            pack_name: POVM pack name
            axis_name: Target axis name
            texts: Test corpus
            target_threshold: Target POVM probability

        Returns:
            AxisEvaluationResult with metrics
        """
        logger.info(f"Evaluating {pack_name}/{axis_name} on {len(texts)} texts...")

        results: List[TransformationResult] = []
        rules_matched = []

        for text in texts:
            # Get initial readings
            emb = self.embedding_service.embed_text(text)
            rho = construct_density_matrix(emb, rank=64)
            pack = self.povm_packs[pack_name]
            current_readings = pack.measure(rho)

            # Assess rule coverage (for analysis)
            coverage = assess_rule_coverage(text, pack_name, axis_name)
            rules_matched.append(coverage.get("total_matches", 0))

            # Build context
            context = TransformationContext(
                text=text,
                target_axis=axis_name,
                povm_pack_name=pack_name,
                current_readings=current_readings,
                target_threshold=target_threshold,
                max_change_ratio=0.3
            )

            # Transform
            try:
                result = strategy.transform(context)
                results.append(result)
            except Exception as e:
                logger.error(f"Transformation failed: {e}", exc_info=True)
                # Create failed result
                results.append(TransformationResult(
                    transformed_text=text,
                    success=False,
                    readings_before=current_readings,
                    readings_after=current_readings,
                    target_improvement=0.0,
                    rho_distance_moved=0.0,
                    text_change_ratio=0.0,
                    semantic_coherence=0.0,
                    method=strategy.method if hasattr(strategy, 'method') else TransformationMethod.RULE_BASED,
                    strategy_name=strategy.__class__.__name__,
                    execution_time_ms=0.0,
                    error_message=str(e)
                ))

        # Analyze results
        n_success = sum(1 for r in results if r.success)
        success_rate = n_success / len(results) if results else 0.0

        avg_improvement = np.mean([r.target_improvement for r in results])
        avg_improvement_success = np.mean([r.target_improvement for r in results if r.success]) if n_success > 0 else 0.0

        avg_change_ratio = np.mean([r.text_change_ratio for r in results])
        avg_coherence = np.mean([r.semantic_coherence for r in results])
        avg_execution_time = np.mean([r.execution_time_ms for r in results])

        total_cost = sum(r.cost_usd for r in results)

        # Analyze failures
        failures = {
            "no_rules": 0,
            "no_improvement": 0,
            "too_much_change": 0,
            "low_coherence": 0,
            "error": 0
        }

        for r in results:
            if not r.success:
                if r.error_message:
                    if "No rules" in r.error_message:
                        failures["no_rules"] += 1
                    else:
                        failures["error"] += 1
                elif r.target_improvement <= 0.01:
                    failures["no_improvement"] += 1
                elif r.text_change_ratio > 0.3:
                    failures["too_much_change"] += 1
                elif r.semantic_coherence < 0.5:
                    failures["low_coherence"] += 1

        # Count rules applied (rule-based only)
        avg_rules_applied = None
        if hasattr(results[0], 'rules_applied') and results[0].rules_applied is not None:
            rules_applied_counts = [len(r.rules_applied) for r in results if r.rules_applied]
            avg_rules_applied = np.mean(rules_applied_counts) if rules_applied_counts else 0.0

        return AxisEvaluationResult(
            pack_name=pack_name,
            axis_name=axis_name,
            n_samples=len(results),
            success_rate=success_rate,
            avg_improvement=avg_improvement,
            avg_improvement_success_only=avg_improvement_success,
            avg_text_change_ratio=avg_change_ratio,
            avg_coherence=avg_coherence,
            avg_execution_time_ms=avg_execution_time,
            avg_rules_matched=np.mean(rules_matched) if rules_matched else None,
            avg_rules_applied=avg_rules_applied,
            total_cost_usd=total_cost,
            failures_no_rules=failures["no_rules"],
            failures_no_improvement=failures["no_improvement"],
            failures_too_much_change=failures["too_much_change"],
            failures_low_coherence=failures["low_coherence"],
            failures_error=failures["error"]
        )

    def evaluate_strategy(
        self,
        strategy_type: str,
        texts: List[str],
        axes_to_test: Optional[List[Tuple[str, str]]] = None
    ) -> StrategyEvaluationReport:
        """
        Evaluate a transformation strategy across multiple axes.

        Args:
            strategy_type: "rule_based", "llm_guided", or "hybrid"
            texts: Test corpus
            axes_to_test: Optional list of (pack, axis) tuples to test

        Returns:
            StrategyEvaluationReport
        """
        logger.info(f"Evaluating {strategy_type} strategy...")

        # Initialize strategy
        if strategy_type == "rule_based":
            strategy = RuleBasedStrategy(
                rank=64,
                archive_name=self.archive_name,
                operator_preference=self.operator_preference
            )
        elif strategy_type == "llm_guided":
            strategy = LLMGuidedStrategy(rank=64)
        elif strategy_type == "hybrid":
            strategy = HybridStrategy(rank=64)
        else:
            raise ValueError(f"Unknown strategy type: {strategy_type}")

        # Get axes to test
        if axes_to_test is None:
            axes_to_test = []
            available_rules = list_available_rules()
            for pack_name, axes in available_rules.items():
                for axis_name in axes:
                    axes_to_test.append((pack_name, axis_name))

        logger.info(f"Testing {len(axes_to_test)} axes: {axes_to_test}")

        # Evaluate each axis
        axis_results = []
        for pack_name, axis_name in axes_to_test:
            try:
                result = self.evaluate_strategy_on_axis(
                    strategy=strategy,
                    pack_name=pack_name,
                    axis_name=axis_name,
                    texts=texts
                )
                axis_results.append(result)
            except Exception as e:
                logger.error(f"Failed to evaluate {pack_name}/{axis_name}: {e}", exc_info=True)

        # Compute overall metrics
        total_samples = sum(r.n_samples for r in axis_results)
        overall_success_rate = np.mean([r.success_rate for r in axis_results])
        overall_avg_improvement = np.mean([r.avg_improvement for r in axis_results])

        # Find best/worst axes
        sorted_by_success = sorted(
            axis_results,
            key=lambda r: r.success_rate,
            reverse=True
        )
        best_axes = [(r.pack_name, r.axis_name, r.success_rate) for r in sorted_by_success[:3]]
        worst_axes = [(r.pack_name, r.axis_name, r.success_rate) for r in sorted_by_success[-3:]]

        # Generate recommendations
        recommendations = self._generate_recommendations(axis_results, strategy_type)

        return StrategyEvaluationReport(
            strategy_name=strategy.__class__.__name__,
            strategy_type=strategy_type,
            evaluated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            total_samples=total_samples,
            overall_success_rate=overall_success_rate,
            overall_avg_improvement=overall_avg_improvement,
            axis_results=axis_results,
            best_axes=best_axes,
            worst_axes=worst_axes,
            recommendations=recommendations
        )

    def _generate_recommendations(
        self,
        axis_results: List[AxisEvaluationResult],
        strategy_type: str
    ) -> List[str]:
        """Generate actionable recommendations based on results."""
        recommendations = []

        # Check for axes with low success rates
        weak_axes = [r for r in axis_results if r.success_rate < 0.5]
        if weak_axes:
            recommendations.append(
                f"🔴 {len(weak_axes)} axes have <50% success rate: "
                f"{', '.join(f'{r.pack_name}/{r.axis_name}' for r in weak_axes[:3])}"
            )

        # Check for axes with no rules (rule-based)
        if strategy_type == "rule_based":
            no_rules = [r for r in axis_results if r.failures_no_rules > r.n_samples * 0.5]
            if no_rules:
                recommendations.append(
                    f"🔴 Add rules for: {', '.join(f'{r.pack_name}/{r.axis_name}' for r in no_rules)}"
                )

        # Check for low improvement
        low_improvement = [r for r in axis_results if r.avg_improvement < 0.05]
        if low_improvement:
            recommendations.append(
                f"🟡 Low improvement (<0.05): {', '.join(f'{r.pack_name}/{r.axis_name}' for r in low_improvement[:3])}"
            )

        # Check for high execution time
        slow_axes = [r for r in axis_results if r.avg_execution_time_ms > 1000]
        if slow_axes:
            recommendations.append(
                f"🟡 Slow execution (>1s): {', '.join(f'{r.pack_name}/{r.axis_name}' for r in slow_axes[:3])}"
            )

        # Check for low coherence
        low_coherence = [r for r in axis_results if r.avg_coherence < 0.6]
        if low_coherence:
            recommendations.append(
                f"🟡 Low coherence (<0.6): {', '.join(f'{r.pack_name}/{r.axis_name}' for r in low_coherence[:3])}"
            )

        if not recommendations:
            recommendations.append("✅ All axes performing well! Consider expanding test corpus.")

        return recommendations


# ============================================================================
# Report Generation
# ============================================================================

def print_evaluation_report(report: StrategyEvaluationReport):
    """Print evaluation report to console."""
    print("\n" + "=" * 80)
    print(f"TRANSFORMATION STRATEGY EVALUATION REPORT")
    print("=" * 80)
    print(f"Strategy: {report.strategy_name} ({report.strategy_type})")
    print(f"Evaluated: {report.evaluated_at}")
    print(f"Total Samples: {report.total_samples}")
    print()

    print("OVERALL METRICS")
    print("-" * 80)
    print(f"Success Rate:      {report.overall_success_rate:.1%}")
    print(f"Avg Improvement:   {report.overall_avg_improvement:+.3f}")
    print()

    print("BEST PERFORMING AXES")
    print("-" * 80)
    for pack, axis, rate in report.best_axes:
        print(f"  {pack}/{axis:<20} {rate:.1%}")
    print()

    print("WORST PERFORMING AXES")
    print("-" * 80)
    for pack, axis, rate in report.worst_axes:
        print(f"  {pack}/{axis:<20} {rate:.1%}")
    print()

    print("DETAILED RESULTS BY AXIS")
    print("-" * 80)
    print(f"{'Pack/Axis':<30} {'Success':<8} {'Δ POVM':<8} {'Change':<8} {'Coherence':<10} {'Time':<8}")
    print("-" * 80)
    for r in sorted(report.axis_results, key=lambda x: x.success_rate, reverse=True):
        axis_label = f"{r.pack_name}/{r.axis_name}"
        print(
            f"{axis_label:<30} "
            f"{r.success_rate:>6.1%}  "
            f"{r.avg_improvement:>+6.3f}  "
            f"{r.avg_text_change_ratio:>6.1%}  "
            f"{r.avg_coherence:>8.2f}  "
            f"{r.avg_execution_time_ms:>6.0f}ms"
        )
    print()

    print("FAILURE ANALYSIS")
    print("-" * 80)
    total_failures = {
        "no_rules": sum(r.failures_no_rules for r in report.axis_results),
        "no_improvement": sum(r.failures_no_improvement for r in report.axis_results),
        "too_much_change": sum(r.failures_too_much_change for r in report.axis_results),
        "low_coherence": sum(r.failures_low_coherence for r in report.axis_results),
        "error": sum(r.failures_error for r in report.axis_results)
    }
    for failure_type, count in total_failures.items():
        print(f"  {failure_type:<20} {count:>4}")
    print()

    print("RECOMMENDATIONS")
    print("-" * 80)
    for i, rec in enumerate(report.recommendations, 1):
        print(f"{i}. {rec}")
    print()
    print("=" * 80)


def save_evaluation_report(report: StrategyEvaluationReport, output_path: Path):
    """Save evaluation report to JSON file."""
    # Convert to dict
    report_dict = asdict(report)

    # Write JSON
    with open(output_path, 'w') as f:
        json.dump(report_dict, f, indent=2)

    logger.info(f"Report saved to {output_path}")


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Evaluate transformation strategies")
    parser.add_argument(
        "--strategy",
        choices=["rule_based", "llm_guided", "hybrid", "all"],
        default="rule_based",
        help="Strategy to evaluate"
    )
    parser.add_argument(
        "--n-texts",
        type=int,
        default=50,
        help="Number of texts to test per axis"
    )
    parser.add_argument(
        "--archive-name",
        type=str,
        default=None,
        help="Archive name for adaptive operators"
    )
    parser.add_argument(
        "--operator-preference",
        type=str,
        default="auto",
        choices=["auto", "archive", "default", "random"],
        help="Operator loading preference"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("evaluation_reports"),
        help="Output directory for reports"
    )
    parser.add_argument(
        "--axes",
        type=str,
        nargs="+",
        help="Specific axes to test (format: pack/axis, e.g., tone/analytical)"
    )

    args = parser.parse_args()

    # Create output directory
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Load test corpus
    logger.info(f"Loading test corpus ({args.n_texts} texts)...")
    texts = load_chatgpt_corpus_sample(args.n_texts)

    if len(texts) < args.n_texts:
        logger.warning(f"Only {len(texts)} texts available (requested {args.n_texts})")

    # Parse axes filter
    axes_to_test = None
    if args.axes:
        axes_to_test = []
        for axis_str in args.axes:
            pack, axis = axis_str.split("/")
            axes_to_test.append((pack, axis))
        logger.info(f"Testing specific axes: {axes_to_test}")

    # Initialize evaluator
    evaluator = TransformationEvaluator(
        archive_name=args.archive_name,
        operator_preference=args.operator_preference
    )

    # Evaluate strategies
    strategies = [args.strategy] if args.strategy != "all" else ["rule_based", "llm_guided", "hybrid"]

    for strategy_type in strategies:
        logger.info(f"\n{'='*80}\nEvaluating {strategy_type} strategy...\n{'='*80}")

        try:
            report = evaluator.evaluate_strategy(
                strategy_type=strategy_type,
                texts=texts,
                axes_to_test=axes_to_test
            )

            # Print report
            print_evaluation_report(report)

            # Save report
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            output_path = args.output_dir / f"{strategy_type}_{timestamp}.json"
            save_evaluation_report(report, output_path)

        except Exception as e:
            logger.error(f"Failed to evaluate {strategy_type}: {e}", exc_info=True)


if __name__ == "__main__":
    main()
