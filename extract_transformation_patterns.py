"""
Extract Transformation Patterns - Week 6 Step 2

Analyze successful transformations to discover patterns: which word
substitutions consistently improve POVM readings for each axis.

Output: Rules for each pack/axis combination
"""

import json
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple
import re


def load_corpus(corpus_path: Path) -> Dict:
    """Load transformation corpus from JSON."""
    with open(corpus_path) as f:
        return json.load(f)


def extract_word_substitutions(transformations: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Extract word substitution patterns grouped by pack/axis.

    Returns:
        Dict[pack/axis -> List of substitution records]
    """
    patterns = defaultdict(list)

    for t in transformations:
        key = f"{t['pack']}/{t['axis']}"

        # Extract substitutions from word_diff
        word_diff = t['word_diff']

        # Single word substitutions (most reliable)
        for orig, new in word_diff.get('words_changed', []):
            patterns[key].append({
                'type': 'substitution',
                'from': orig.lower(),
                'to': new.lower(),
                'improvement': t['improvement'],
                'text_change': t['text_change_ratio'],
                'example_original': t['original_text'],
                'example_transformed': t['transformed_text']
            })

        # Word removals (hedging, etc.)
        for removed in word_diff.get('words_removed', []):
            patterns[key].append({
                'type': 'removal',
                'word': removed.lower(),
                'improvement': t['improvement'],
                'text_change': t['text_change_ratio'],
                'example_original': t['original_text'],
                'example_transformed': t['transformed_text']
            })

        # Word additions (negations, qualifiers, etc.)
        for added in word_diff.get('words_added', []):
            patterns[key].append({
                'type': 'addition',
                'word': added.lower(),
                'improvement': t['improvement'],
                'text_change': t['text_change_ratio'],
                'example_original': t['original_text'],
                'example_transformed': t['transformed_text']
            })

    return patterns


def analyze_patterns(patterns: Dict[str, List[Dict]]) -> Dict[str, Dict]:
    """
    Analyze patterns to find reliable transformation rules.

    For each pack/axis, identify:
    - High-frequency substitutions
    - Reliable word removals (hedging)
    - Common additions (negations, etc.)
    """
    rules = {}

    for axis_key, pattern_list in patterns.items():
        # Group by pattern type
        substitutions = [p for p in pattern_list if p['type'] == 'substitution']
        removals = [p for p in pattern_list if p['type'] == 'removal']
        additions = [p for p in pattern_list if p['type'] == 'addition']

        # Count frequencies
        sub_freq = defaultdict(list)
        for s in substitutions:
            sub_freq[(s['from'], s['to'])].append(s['improvement'])

        removal_freq = defaultdict(list)
        for r in removals:
            removal_freq[r['word']].append(r['improvement'])

        addition_freq = defaultdict(list)
        for a in additions:
            addition_freq[a['word']].append(a['improvement'])

        # Create rules
        rules[axis_key] = {
            'substitutions': [
                {
                    'from': from_word,
                    'to': to_word,
                    'count': len(improvements),
                    'avg_improvement': sum(improvements) / len(improvements),
                    'reliability': 'high' if len(improvements) >= 2 else 'medium'
                }
                for (from_word, to_word), improvements in sub_freq.items()
            ],
            'removals': [
                {
                    'word': word,
                    'count': len(improvements),
                    'avg_improvement': sum(improvements) / len(improvements),
                    'reliability': 'high' if len(improvements) >= 2 else 'medium'
                }
                for word, improvements in removal_freq.items()
            ],
            'additions': [
                {
                    'word': word,
                    'count': len(improvements),
                    'avg_improvement': sum(improvements) / len(improvements),
                    'reliability': 'high' if len(improvements) >= 2 else 'medium'
                }
                for word, improvements in addition_freq.items()
            ]
        }

        # Sort by count and improvement
        rules[axis_key]['substitutions'].sort(key=lambda x: (x['count'], x['avg_improvement']), reverse=True)
        rules[axis_key]['removals'].sort(key=lambda x: (x['count'], x['avg_improvement']), reverse=True)
        rules[axis_key]['additions'].sort(key=lambda x: (x['count'], x['avg_improvement']), reverse=True)

    return rules


def generate_rule_summary(rules: Dict[str, Dict]) -> str:
    """Generate human-readable summary of extracted rules."""
    lines = []
    lines.append("# Transformation Rules Extracted from Corpus")
    lines.append("")
    lines.append("## Overview")
    lines.append(f"Total axes analyzed: {len(rules)}")
    lines.append("")

    for axis_key, axis_rules in sorted(rules.items()):
        pack, axis = axis_key.split('/')
        lines.append(f"## {pack} / {axis}")
        lines.append("")

        # Substitutions
        if axis_rules['substitutions']:
            lines.append("### Word Substitutions")
            for sub in axis_rules['substitutions'][:10]:  # Top 10
                lines.append(f"- **'{sub['from']}'** → **'{sub['to']}'**")
                lines.append(f"  - Count: {sub['count']}, Avg improvement: {sub['avg_improvement']:+.3f}, Reliability: {sub['reliability']}")
            lines.append("")

        # Removals
        if axis_rules['removals']:
            lines.append("### Words to Remove")
            for rem in axis_rules['removals'][:10]:
                lines.append(f"- **'{rem['word']}'**")
                lines.append(f"  - Count: {rem['count']}, Avg improvement: {rem['avg_improvement']:+.3f}, Reliability: {rem['reliability']}")
            lines.append("")

        # Additions
        if axis_rules['additions']:
            lines.append("### Words to Add")
            for add in axis_rules['additions'][:10]:
                lines.append(f"- **'{add['word']}'**")
                lines.append(f"  - Count: {add['count']}, Avg improvement: {add['avg_improvement']:+.3f}, Reliability: {add['reliability']}")
            lines.append("")

    return "\n".join(lines)


def main():
    print("=" * 80)
    print("PATTERN EXTRACTION (Week 6 Step 2)")
    print("=" * 80)

    # Load corpus
    corpus_path = Path("data/successful_transformations/manual_seed_corpus.json")
    print(f"\nLoading corpus from: {corpus_path}")

    corpus = load_corpus(corpus_path)
    transformations = corpus['transformations']

    print(f"✅ Loaded {len(transformations)} successful transformations")

    # Extract patterns
    print("\nExtracting word substitution patterns...")
    patterns = extract_word_substitutions(transformations)

    print(f"✅ Extracted patterns for {len(patterns)} pack/axis combinations:")
    for axis_key, pattern_list in sorted(patterns.items()):
        print(f"   - {axis_key}: {len(pattern_list)} patterns")

    # Analyze patterns
    print("\nAnalyzing patterns to generate rules...")
    rules = analyze_patterns(patterns)

    print(f"✅ Generated rules for {len(rules)} axes")

    # Generate summary
    summary = generate_rule_summary(rules)

    # Save rules
    output_dir = Path("data/transformation_rules")
    output_dir.mkdir(parents=True, exist_ok=True)

    rules_file = output_dir / "extracted_rules.json"
    with open(rules_file, 'w') as f:
        json.dump(rules, f, indent=2)
    print(f"\n💾 Rules saved to: {rules_file}")

    summary_file = output_dir / "rules_summary.md"
    with open(summary_file, 'w') as f:
        f.write(summary)
    print(f"💾 Summary saved to: {summary_file}")

    # Display summary
    print("\n" + "=" * 80)
    print("RULES SUMMARY")
    print("=" * 80)
    print(summary)

    print("\n✅ Pattern extraction complete!")


if __name__ == "__main__":
    main()
