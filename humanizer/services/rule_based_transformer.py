"""
Rule-Based Transformer - Week 6

Applies learned transformation patterns from corpus analysis.
Uses rules extracted from successful GFS transformations.

Strategy:
1. Load learned rules from extracted_rules.json
2. Apply highest-confidence rules first
3. Verify each transformation with POVM measurements
4. Fall back to GFS if rules don't produce valid transformations
"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

from humanizer.services.sentence_embedding import get_sentence_embedding_service
from humanizer.core.trm.density import construct_density_matrix
from humanizer.services.operator_learning import load_all_operators

logger = logging.getLogger(__name__)


@dataclass
class RuleBasedResult:
    """Result of rule-based transformation."""
    success: bool
    transformed_text: Optional[str]
    rule_applied: Optional[str]
    improvement: float
    text_change_ratio: float
    reading_before: float
    reading_after: float


class RuleBasedTransformer:
    """
    Applies learned transformation rules.

    Focuses on high-reliability patterns identified from successful transformations.
    """

    def __init__(self, rules_path: Path = None, rank: int = 64):
        """
        Initialize transformer with learned rules.

        Args:
            rules_path: Path to extracted_rules.json
            rank: Rank for density matrices
        """
        self.rank = rank

        # Load rules
        if rules_path is None:
            rules_path = Path("data/transformation_rules/extracted_rules.json")

        with open(rules_path) as f:
            self.rules = json.load(f)

        logger.info(f"Loaded rules for {len(self.rules)} pack/axis combinations")

        # Load semantic operators
        self.semantic_packs = load_all_operators()
        self.embedding_service = get_sentence_embedding_service()

    def transform(
        self,
        text: str,
        pack_name: str,
        target_axis: str,
        min_improvement: float = 0.01,
        max_text_change: float = 0.4
    ) -> RuleBasedResult:
        """
        Apply learned rules to transform text.

        Args:
            text: Text to transform
            pack_name: POVM pack name
            target_axis: Target axis
            min_improvement: Minimum POVM improvement required
            max_text_change: Maximum text change allowed

        Returns:
            RuleBasedResult with transformation details
        """
        # Get initial reading
        reading_before = self._measure(text, pack_name, target_axis)

        # Get rules for this axis
        axis_key = f"{pack_name}/{target_axis}"
        if axis_key not in self.rules:
            logger.warning(f"No rules found for {axis_key}")
            return RuleBasedResult(
                success=False,
                transformed_text=None,
                rule_applied=None,
                improvement=0.0,
                text_change_ratio=0.0,
                reading_before=reading_before,
                reading_after=reading_before
            )

        axis_rules = self.rules[axis_key]

        # Try rules in order of reliability
        # 1. High-reliability substitutions
        # 2. High-reliability removals
        # 3. High-reliability additions

        candidates = []

        # Try substitutions
        for sub in axis_rules['substitutions']:
            if sub['reliability'] == 'high':
                transformed = self._apply_substitution(text, sub['from'], sub['to'])
                if transformed != text:
                    candidates.append((transformed, f"substitute: '{sub['from']}' → '{sub['to']}'"))

        # Try removals (for affirmative/hedging removal)
        high_rel_removals = [r for r in axis_rules['removals'] if r['reliability'] == 'high']
        if high_rel_removals:
            # Apply multiple removals in one pass
            transformed = text
            applied_removals = []
            for rem in high_rel_removals:
                new_text = self._remove_word(transformed, rem['word'])
                if new_text != transformed:
                    transformed = new_text
                    applied_removals.append(rem['word'])

            if transformed != text:
                candidates.append((transformed, f"remove: {', '.join(applied_removals)}"))

        # Try additions (for negation)
        for add in axis_rules['additions']:
            if add['reliability'] == 'high' and add['word'] in ['not', 'no']:
                # Smart negation insertion
                transformed = self._insert_negation(text, add['word'])
                if transformed != text:
                    candidates.append((transformed, f"add negation: '{add['word']}'"))

        # Evaluate candidates
        best_result = None
        for transformed_text, rule_desc in candidates:
            # Check text change
            text_change = self._calculate_text_change(text, transformed_text)
            if text_change > max_text_change:
                continue

            # Measure improvement
            reading_after = self._measure(transformed_text, pack_name, target_axis)
            improvement = reading_after - reading_before

            if improvement >= min_improvement:
                result = RuleBasedResult(
                    success=True,
                    transformed_text=transformed_text,
                    rule_applied=rule_desc,
                    improvement=improvement,
                    text_change_ratio=text_change,
                    reading_before=reading_before,
                    reading_after=reading_after
                )

                # Keep best result
                if best_result is None or improvement > best_result.improvement:
                    best_result = result

        if best_result:
            return best_result

        # No successful transformation
        return RuleBasedResult(
            success=False,
            transformed_text=None,
            rule_applied=None,
            improvement=0.0,
            text_change_ratio=0.0,
            reading_before=reading_before,
            reading_after=reading_before
        )

    def _measure(self, text: str, pack_name: str, target_axis: str) -> float:
        """Measure POVM reading for specific axis."""
        embedding = self.embedding_service.embed_text(text)
        rho = construct_density_matrix(embedding, rank=self.rank)
        pack = self.semantic_packs[pack_name].to_povm_pack()
        readings = pack.measure(rho)
        return readings.get(target_axis, 0.0)

    def _calculate_text_change(self, original: str, transformed: str) -> float:
        """Calculate text change ratio (0-1)."""
        orig_words = set(original.lower().split())
        trans_words = set(transformed.lower().split())

        if not orig_words:
            return 0.0

        overlap = len(orig_words & trans_words)
        return 1.0 - (overlap / len(orig_words))

    def _apply_substitution(self, text: str, from_phrase: str, to_phrase: str) -> str:
        """Apply word/phrase substitution (case-insensitive)."""
        # Use word boundaries for single words
        if ' ' not in from_phrase:
            pattern = r'\b' + re.escape(from_phrase) + r'\b'
            return re.sub(pattern, to_phrase, text, flags=re.IGNORECASE, count=1)
        else:
            # Multi-word phrase: case-insensitive replace
            return re.sub(
                re.escape(from_phrase),
                to_phrase,
                text,
                flags=re.IGNORECASE,
                count=1
            )

    def _remove_word(self, text: str, word: str) -> str:
        """Remove word from text (case-insensitive, preserve spacing)."""
        # Remove word with word boundaries
        pattern = r'\b' + re.escape(word) + r'\b\s*'
        result = re.sub(pattern, '', text, flags=re.IGNORECASE, count=1)

        # Clean up multiple spaces
        result = re.sub(r'\s+', ' ', result).strip()

        return result

    def _insert_negation(self, text: str, negation_word: str) -> str:
        """
        Insert negation word intelligently.

        Strategy: Insert after first verb/modal (should, can, will, etc.)
        """
        # Common patterns for negation insertion
        modals = ['should', 'could', 'would', 'will', 'can', 'may', 'might', 'must']

        for modal in modals:
            pattern = r'\b(' + re.escape(modal) + r')\b'
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                # Insert "not" after modal
                result = text[:match.end()] + ' ' + negation_word + text[match.end():]
                return result

        # Fallback: insert before first verb (simple heuristic)
        # This is a simplified approach; more sophisticated parsing would be better
        return text

    def get_supported_axes(self) -> List[str]:
        """Get list of pack/axis combinations with learned rules."""
        return list(self.rules.keys())
