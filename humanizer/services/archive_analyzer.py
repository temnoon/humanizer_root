"""
Archive Analyzer - Evaluate POVM operator appropriateness for target archive

This module analyzes how well semantic POVM operators discriminate on a target
archive (e.g., ChatGPT conversations). It provides metrics and recommendations
for whether operators should be retrained for the specific archive.

Key Metrics:
- Discrimination (Cohen's d): Effect size for high vs low scorers
- Coverage: How well archive texts span the semantic space
- Variance: Consistency of measurements (should be ~0 for semantic operators)

Usage:
    from humanizer.services.archive_analyzer import analyze_archive

    result = await analyze_archive(
        session=session,
        archive_name="chatgpt",
        operators=semantic_packs,
        sample_size=200
    )

    print(result.recommendation)  # "keep", "retrain_weak", or "retrain_all"
    print(result.report)  # Human-readable markdown report
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from uuid import UUID
import numpy as np
from numpy.typing import NDArray
from statistics import mean, stdev
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.chatgpt import ChatGPTMessage
from humanizer.core.trm.semantic_operators import SemanticPOVMPack, create_density_matrix_with_operator
from humanizer.services.sentence_embedding import get_sentence_embedding_service

logger = logging.getLogger(__name__)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class OperatorMetrics:
    """Metrics for a single operator on archive."""
    operator_name: str
    cohens_d: float  # Effect size (separation between high/low scorers)
    variance: float  # Measurement variance (should be ~0 for semantic)
    mean_reading: float  # Average reading across archive sample

    # Sample texts
    high_scorers: List[Tuple[str, float]] = field(default_factory=list)  # (text, score)
    low_scorers: List[Tuple[str, float]] = field(default_factory=list)  # (text, score)

    @property
    def discrimination_quality(self) -> str:
        """Qualitative assessment of discrimination."""
        if self.cohens_d > 0.8:
            return "excellent"
        elif self.cohens_d > 0.5:
            return "good"
        elif self.cohens_d > 0.2:
            return "fair"
        else:
            return "poor"


@dataclass
class PackMetrics:
    """Metrics for a POVM pack on archive."""
    pack_name: str
    num_operators: int

    # Per-operator metrics
    operator_metrics: Dict[str, OperatorMetrics]

    # Pack-level metrics
    average_discrimination: float  # Mean Cohen's d across operators
    min_discrimination: float  # Weakest operator
    max_discrimination: float  # Strongest operator
    coverage: float  # 0-1, how well axes span the archive
    sum_to_identity_error: float  # Frobenius norm of (Σ E_i - I)

    @property
    def weak_operators(self) -> List[str]:
        """Operators with poor discrimination (d < 0.5)."""
        return [
            name for name, metrics in self.operator_metrics.items()
            if metrics.cohens_d < 0.5
        ]

    @property
    def pack_quality(self) -> str:
        """Overall pack quality assessment."""
        if self.average_discrimination > 0.7 and len(self.weak_operators) == 0:
            return "excellent"
        elif self.average_discrimination > 0.5 and len(self.weak_operators) <= 1:
            return "good"
        elif self.average_discrimination > 0.3:
            return "fair"
        else:
            return "poor"


@dataclass
class ArchiveAnalysisResult:
    """Results of archive analysis."""
    archive_name: str
    sample_size: int
    analysis_date: datetime

    # Per-pack metrics
    pack_metrics: Dict[str, PackMetrics]

    # Overall assessment
    overall_score: float  # 0-1, higher is better (mean discrimination across all packs)
    recommendation: str  # "keep", "retrain_weak", "retrain_all"

    # Detailed findings
    all_weak_operators: List[Tuple[str, str]]  # (pack_name, operator_name)
    packs_needing_retraining: List[str]

    # Report
    report: str = ""  # Markdown report (generated separately)

    @property
    def overall_quality(self) -> str:
        """Qualitative assessment of overall quality."""
        if self.overall_score > 0.7:
            return "excellent"
        elif self.overall_score > 0.5:
            return "good"
        elif self.overall_score > 0.3:
            return "fair"
        else:
            return "poor"


# ============================================================================
# Archive Sampling
# ============================================================================

async def sample_archive_texts(
    session: AsyncSession,
    archive_name: str,
    sample_size: int,
    min_length: int = 50,
    max_length: int = 2000
) -> List[Tuple[UUID, str]]:
    """
    Sample texts from archive for analysis.

    Sampling strategy:
    - Random sample stratified by conversation
    - Filter by length (avoid very short/long)
    - Return (message_uuid, text) tuples

    Args:
        session: Database session
        archive_name: Archive identifier (not used yet, but for multi-archive support)
        sample_size: Number of texts to sample
        min_length: Minimum text length
        max_length: Maximum text length

    Returns:
        List of (message_uuid, text) tuples
    """
    # For now, sample from all ChatGPT messages
    # In future, filter by archive_name when multiple archives exist

    # Get total message count
    count_stmt = select(func.count(ChatGPTMessage.uuid))
    result = await session.execute(count_stmt)
    total_messages = result.scalar()

    if total_messages == 0:
        raise ValueError("No messages found in archive")

    # Sample messages uniformly
    # Use TABLESAMPLE for large datasets (PostgreSQL only)
    sample_stmt = (
        select(ChatGPTMessage.uuid, ChatGPTMessage.content_text)
        .where(ChatGPTMessage.content_text != None)
        .where(func.length(ChatGPTMessage.content_text) >= min_length)
        .where(func.length(ChatGPTMessage.content_text) <= max_length)
        .order_by(func.random())
        .limit(sample_size)
    )

    result = await session.execute(sample_stmt)
    messages = result.all()

    if len(messages) < sample_size * 0.5:
        logger.warning(f"Only found {len(messages)} messages (requested {sample_size})")

    logger.info(f"Sampled {len(messages)} texts from archive")

    return [(uuid, text) for uuid, text in messages if text]


# ============================================================================
# Discrimination Metrics
# ============================================================================

def compute_cohens_d(
    readings: List[float],
    threshold_percentile: float = 75.0
) -> float:
    """
    Compute Cohen's d for operator discrimination.

    Split readings at threshold_percentile (e.g., 75th = top quartile).
    High group: readings >= threshold
    Low group: readings < threshold

    Cohen's d = (mean_high - mean_low) / pooled_std

    Interpretation:
    - d > 0.8: Large effect (excellent discrimination)
    - d > 0.5: Medium effect (good discrimination)
    - d > 0.2: Small effect (fair discrimination)
    - d < 0.2: Negligible (poor discrimination)

    Args:
        readings: List of operator readings on archive sample
        threshold_percentile: Percentile to split high/low groups

    Returns:
        Cohen's d effect size
    """
    if len(readings) < 10:
        logger.warning(f"Too few readings ({len(readings)}) for reliable Cohen's d")
        return 0.0

    # Split into high/low groups
    threshold = np.percentile(readings, threshold_percentile)
    high_group = [r for r in readings if r >= threshold]
    low_group = [r for r in readings if r < threshold]

    if len(high_group) < 2 or len(low_group) < 2:
        logger.warning("High or low group too small for Cohen's d")
        return 0.0

    # Compute means
    mean_high = mean(high_group)
    mean_low = mean(low_group)

    # Compute pooled standard deviation
    std_high = stdev(high_group) if len(high_group) > 1 else 0.0
    std_low = stdev(low_group) if len(low_group) > 1 else 0.0
    pooled_std = np.sqrt((std_high**2 + std_low**2) / 2)

    if pooled_std < 1e-10:
        # No variance - can't compute effect size
        # This happens with perfect separation
        return 10.0 if mean_high > mean_low else 0.0

    # Cohen's d
    d = (mean_high - mean_low) / pooled_std

    return abs(d)


def compute_coverage(
    readings_per_axis: Dict[str, List[float]],
    threshold: float = 0.5
) -> float:
    """
    Measure how well archive texts span the semantic space.

    Coverage = (# axes with readings > threshold) / total_axes

    If coverage < 0.5: Archive may not match axes well (dead zones)
    If coverage > 0.8: Good semantic diversity

    Args:
        readings_per_axis: Dict mapping axis names to lists of readings
        threshold: Reading threshold for "coverage"

    Returns:
        Coverage score (0-1)
    """
    if not readings_per_axis:
        return 0.0

    axes_covered = 0
    for axis, readings in readings_per_axis.items():
        # Check if any readings exceed threshold
        max_reading = max(readings) if readings else 0.0
        if max_reading > threshold:
            axes_covered += 1

    coverage = axes_covered / len(readings_per_axis)
    return coverage


# ============================================================================
# Pack Analysis
# ============================================================================

async def analyze_pack(
    pack_name: str,
    pack: SemanticPOVMPack,
    archive_texts: List[Tuple[UUID, str]],
    embedding_service,
    sample_top_k: int = 5
) -> PackMetrics:
    """
    Analyze a single POVM pack on archive.

    Process:
    1. Measure all archive texts with each operator
    2. Compute discrimination (Cohen's d)
    3. Compute variance (should be ~0 for semantic)
    4. Compute coverage
    5. Sample high/low scoring texts

    Args:
        pack_name: Pack name (e.g., "tone")
        pack: Semantic POVM pack
        archive_texts: List of (uuid, text) tuples
        embedding_service: Sentence embedding service
        sample_top_k: Number of top/bottom texts to sample

    Returns:
        PackMetrics with detailed analysis
    """
    logger.info(f"Analyzing pack: {pack_name} ({len(pack.operators)} operators)")

    # Measure all texts with all operators
    readings_per_axis = {op.name: [] for op in pack.operators}
    text_scores_per_axis = {op.name: [] for op in pack.operators}  # (text, score) tuples

    for uuid, text in archive_texts:
        # Embed text once
        emb = embedding_service.embed_text(text)

        # Measure with each operator
        for op in pack.operators:
            # Create density matrix using operator's projection matrix
            rho = create_density_matrix_with_operator(emb, op)

            # Measure
            reading = op.measure(rho)

            # Store
            readings_per_axis[op.name].append(reading)
            text_scores_per_axis[op.name].append((text, reading))

    # Compute per-operator metrics
    operator_metrics = {}
    for op in pack.operators:
        readings = readings_per_axis[op.name]
        text_scores = text_scores_per_axis[op.name]

        # Cohen's d (discrimination)
        cohens_d = compute_cohens_d(readings)

        # Variance (should be ~0 for semantic operators)
        # Variance here is across different texts, not repeated measurements
        # So we expect some variance. What we're checking is if readings make sense.
        variance = stdev(readings) if len(readings) > 1 else 0.0

        # Mean reading
        mean_reading = mean(readings)

        # Sample high/low scorers
        sorted_texts = sorted(text_scores, key=lambda x: x[1], reverse=True)
        high_scorers = sorted_texts[:sample_top_k]
        low_scorers = sorted_texts[-sample_top_k:]

        operator_metrics[op.name] = OperatorMetrics(
            operator_name=op.name,
            cohens_d=cohens_d,
            variance=variance,
            mean_reading=mean_reading,
            high_scorers=high_scorers,
            low_scorers=low_scorers
        )

    # Pack-level metrics
    all_cohens_d = [m.cohens_d for m in operator_metrics.values()]
    average_discrimination = mean(all_cohens_d)
    min_discrimination = min(all_cohens_d)
    max_discrimination = max(all_cohens_d)

    coverage = compute_coverage(readings_per_axis)

    # Sum-to-identity check (from Week 2 validation)
    total = np.zeros((pack.rank, pack.rank))
    for op in pack.operators:
        total += op.E
    identity = np.eye(pack.rank)
    sum_to_identity_error = np.linalg.norm(total - identity, 'fro')

    pack_metrics = PackMetrics(
        pack_name=pack_name,
        num_operators=len(pack.operators),
        operator_metrics=operator_metrics,
        average_discrimination=average_discrimination,
        min_discrimination=min_discrimination,
        max_discrimination=max_discrimination,
        coverage=coverage,
        sum_to_identity_error=sum_to_identity_error
    )

    logger.info(
        f"Pack {pack_name}: avg_d={average_discrimination:.2f}, "
        f"coverage={coverage:.2f}, weak_ops={len(pack_metrics.weak_operators)}"
    )

    return pack_metrics


# ============================================================================
# Main Analysis Function
# ============================================================================

async def analyze_archive(
    session: AsyncSession,
    archive_name: str,
    operators: Dict[str, SemanticPOVMPack],
    sample_size: int = 200,
    embedding_service = None,
) -> ArchiveAnalysisResult:
    """
    Analyze how well operators work on target archive.

    Process:
    1. Sample N texts from archive (stratified by conversation)
    2. Measure each text with all operators
    3. Compute discrimination metrics (Cohen's d)
    4. Compute coverage (semantic space utilization)
    5. Generate report with recommendations

    Args:
        session: Database session
        archive_name: Archive identifier (e.g., "chatgpt")
        operators: Current semantic operators to evaluate
        sample_size: Number of texts to sample
        embedding_service: Optional, creates if not provided

    Returns:
        ArchiveAnalysisResult with metrics and recommendations
    """
    logger.info(f"Starting archive analysis: {archive_name} (sample_size={sample_size})")

    # Get embedding service
    if embedding_service is None:
        embedding_service = get_sentence_embedding_service()

    # Sample archive texts
    archive_texts = await sample_archive_texts(session, archive_name, sample_size)

    if len(archive_texts) == 0:
        raise ValueError(f"No texts sampled from archive: {archive_name}")

    logger.info(f"Sampled {len(archive_texts)} texts from archive")

    # Analyze each pack
    pack_metrics = {}
    for pack_name, pack in operators.items():
        metrics = await analyze_pack(
            pack_name=pack_name,
            pack=pack,
            archive_texts=archive_texts,
            embedding_service=embedding_service
        )
        pack_metrics[pack_name] = metrics

    # Overall assessment
    all_discriminations = []
    all_weak_operators = []
    packs_needing_retraining = []

    for pack_name, metrics in pack_metrics.items():
        all_discriminations.append(metrics.average_discrimination)

        # Collect weak operators
        for op_name in metrics.weak_operators:
            all_weak_operators.append((pack_name, op_name))

        # Determine if pack needs retraining
        if metrics.pack_quality in ["poor", "fair"]:
            packs_needing_retraining.append(pack_name)

    overall_score = mean(all_discriminations)

    # Recommendation
    if overall_score > 0.7 and len(all_weak_operators) == 0:
        recommendation = "keep"
    elif len(packs_needing_retraining) > len(pack_metrics) // 2:
        recommendation = "retrain_all"
    else:
        recommendation = "retrain_weak"

    result = ArchiveAnalysisResult(
        archive_name=archive_name,
        sample_size=len(archive_texts),
        analysis_date=datetime.now(),
        pack_metrics=pack_metrics,
        overall_score=overall_score,
        recommendation=recommendation,
        all_weak_operators=all_weak_operators,
        packs_needing_retraining=packs_needing_retraining
    )

    logger.info(
        f"Analysis complete: overall_score={overall_score:.2f}, "
        f"recommendation={recommendation}, weak_ops={len(all_weak_operators)}"
    )

    return result


# ============================================================================
# Report Generation
# ============================================================================

def generate_report(result: ArchiveAnalysisResult) -> str:
    """
    Generate human-readable markdown report.

    Sections:
    1. Executive summary
    2. Overall metrics
    3. Per-pack analysis
    4. Per-operator details
    5. Recommendations

    Args:
        result: Archive analysis result

    Returns:
        Markdown report string
    """
    lines = []

    # Header
    lines.append(f"# Archive Analysis Report: {result.archive_name}")
    lines.append(f"**Date**: {result.analysis_date.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**Sample Size**: {result.sample_size} texts")
    lines.append("")

    # Executive Summary
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(f"**Overall Quality**: {result.overall_quality.upper()}")
    lines.append(f"**Overall Score**: {result.overall_score:.3f} (mean discrimination across all packs)")
    lines.append(f"**Recommendation**: **{result.recommendation.upper().replace('_', ' ')}**")
    lines.append("")

    if result.recommendation == "keep":
        lines.append("✅ Current operators work well on this archive. No action needed.")
    elif result.recommendation == "retrain_weak":
        lines.append(f"⚠️ Some operators ({len(result.all_weak_operators)}) show weak discrimination.")
        lines.append(f"   Recommend retraining: {', '.join(f'{p}/{o}' for p, o in result.all_weak_operators)}")
    else:  # retrain_all
        lines.append(f"❌ Operators not well-suited for this archive.")
        lines.append(f"   Recommend retraining all packs: {', '.join(result.packs_needing_retraining)}")

    lines.append("")

    # Overall Metrics
    lines.append("## Overall Metrics")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| Overall Score | {result.overall_score:.3f} |")
    lines.append(f"| Total Packs | {len(result.pack_metrics)} |")
    lines.append(f"| Total Operators | {sum(m.num_operators for m in result.pack_metrics.values())} |")
    lines.append(f"| Weak Operators | {len(result.all_weak_operators)} |")
    lines.append(f"| Packs Needing Retraining | {len(result.packs_needing_retraining)} |")
    lines.append("")

    # Per-Pack Analysis
    lines.append("## Pack Analysis")
    lines.append("")

    for pack_name, metrics in result.pack_metrics.items():
        quality_emoji = {
            "excellent": "✅",
            "good": "✓",
            "fair": "⚠️",
            "poor": "❌"
        }.get(metrics.pack_quality, "?")

        lines.append(f"### {quality_emoji} {pack_name.upper()}")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Quality | **{metrics.pack_quality.upper()}** |")
        lines.append(f"| Operators | {metrics.num_operators} |")
        lines.append(f"| Avg Discrimination (d) | {metrics.average_discrimination:.3f} |")
        lines.append(f"| Min Discrimination (d) | {metrics.min_discrimination:.3f} |")
        lines.append(f"| Max Discrimination (d) | {metrics.max_discrimination:.3f} |")
        lines.append(f"| Coverage | {metrics.coverage:.3f} |")
        lines.append(f"| Sum-to-Identity Error | {metrics.sum_to_identity_error:.3f} |")
        lines.append(f"| Weak Operators | {len(metrics.weak_operators)} |")
        lines.append("")

        # Per-operator details
        lines.append("**Operators:**")
        lines.append("")
        for op_name, op_metrics in metrics.operator_metrics.items():
            quality_marker = "❌" if op_metrics.cohens_d < 0.5 else "✓"
            lines.append(
                f"- {quality_marker} **{op_name}**: "
                f"d={op_metrics.cohens_d:.3f} ({op_metrics.discrimination_quality}), "
                f"σ={op_metrics.variance:.3f}, "
                f"mean={op_metrics.mean_reading:.3f}"
            )

        lines.append("")

        # Sample high-scoring texts (first operator only, to keep report concise)
        if metrics.operator_metrics:
            first_op_name = list(metrics.operator_metrics.keys())[0]
            first_op_metrics = metrics.operator_metrics[first_op_name]

            lines.append(f"**Sample High Scorers** ({first_op_name}):")
            lines.append("")
            for i, (text, score) in enumerate(first_op_metrics.high_scorers[:3], 1):
                text_preview = text[:100] + "..." if len(text) > 100 else text
                lines.append(f"{i}. `{score:.3f}` - \"{text_preview}\"")
            lines.append("")

    # Recommendations
    lines.append("## Recommendations")
    lines.append("")

    if result.recommendation == "keep":
        lines.append("✅ **Action**: None required. Current operators work well.")
        lines.append("")
        lines.append("All operators show good discrimination (d > 0.5) on this archive.")
        lines.append("You can proceed with transformations using current operators.")

    elif result.recommendation == "retrain_weak":
        lines.append(f"⚠️ **Action**: Retrain {len(result.all_weak_operators)} weak operators.")
        lines.append("")
        lines.append("**Weak operators** (d < 0.5):")
        lines.append("")
        for pack_name, op_name in result.all_weak_operators:
            d_value = result.pack_metrics[pack_name].operator_metrics[op_name].cohens_d
            lines.append(f"- `{pack_name}/{op_name}`: d={d_value:.3f}")
        lines.append("")
        lines.append("**Next steps:**")
        lines.append("1. Sample corpus from archive for these axes")
        lines.append("2. Learn new operators from archive-specific corpus")
        lines.append("3. Validate and compare to current operators")

    else:  # retrain_all
        lines.append("❌ **Action**: Retrain all operators for this archive.")
        lines.append("")
        lines.append(f"**Packs needing retraining**: {', '.join(result.packs_needing_retraining)}")
        lines.append("")
        lines.append("Overall discrimination is low, indicating that current operators")
        lines.append("may not align well with this archive's semantic characteristics.")
        lines.append("")
        lines.append("**Next steps:**")
        lines.append("1. Sample corpus from archive for all axes")
        lines.append("2. Learn archive-specific operators")
        lines.append("3. Validate on held-out archive data")
        lines.append("4. Compare to current operators and deploy if better")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*Generated by Humanizer Archive Analyzer*")

    return "\n".join(lines)
