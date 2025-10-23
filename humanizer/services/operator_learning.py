"""
Operator Learning Pipeline

Automated pipeline to learn all semantic POVM operators from corpus.

Process:
1. Load corpus JSON files (data/povm_corpus/{pack}/{axis}.json)
2. Learn SemanticPOVMOperator for each axis
3. Create SemanticPOVMPack for each POVM pack
4. Validate: discrimination, variance, sum-to-identity
5. Save operators to disk (data/semantic_operators/)

Usage:
    from humanizer.services.operator_learning import learn_all_operators
    learn_all_operators()
"""

import sys
import json
from pathlib import Path
from typing import Dict, List, Tuple
from statistics import mean, stdev
import numpy as np

# Add project root for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from humanizer.core.trm.semantic_operators import (
    SemanticPOVMOperator,
    SemanticPOVMPack,
    create_density_matrix_with_operator,
)
from humanizer.core.trm.density import construct_density_matrix
from humanizer.services.sentence_embedding import get_sentence_embedding_service
from collect_corpus import AXIS_DEFINITIONS


# ============================================================================
# Corpus Loading
# ============================================================================

def load_corpus_for_pack(pack_name: str) -> Dict[str, List[str]]:
    """
    Load corpus for all axes in a pack.

    Args:
        pack_name: POVM pack name (e.g., "tone")

    Returns:
        Dict mapping axis names to lists of corpus texts
    """
    corpus_dir = project_root / 'data' / 'povm_corpus' / pack_name

    if not corpus_dir.exists():
        raise FileNotFoundError(f"Corpus directory not found: {corpus_dir}")

    corpus_dict = {}
    axes = AXIS_DEFINITIONS[pack_name].keys()

    for axis in axes:
        filepath = corpus_dir / f"{axis}.json"

        if not filepath.exists():
            print(f"⚠️  Warning: No corpus file for {pack_name}/{axis}")
            continue

        with open(filepath) as f:
            data = json.load(f)

        # Extract text from examples
        texts = [example['text'] for example in data['examples']]
        corpus_dict[axis] = texts

        print(f"  Loaded {pack_name}/{axis}: {len(texts)} examples")

    return corpus_dict


# ============================================================================
# Operator Validation
# ============================================================================

def validate_operator_discrimination(
    operator: SemanticPOVMOperator,
    positive_texts: List[str],
    negative_texts: List[str],
    embedding_service,
    n_samples: int = 10,
) -> Dict[str, float]:
    """
    Validate that operator discriminates correctly.

    Tests:
    1. Positive examples score higher than negative
    2. Effect size (Cohen's d) > 0.5 (moderate discrimination)
    3. Variance is near zero (< 0.001)

    Args:
        operator: Semantic operator to test
        positive_texts: Should score HIGH
        negative_texts: Should score LOW
        embedding_service: Embedding service
        n_samples: Sample size from each corpus

    Returns:
        Validation metrics
    """
    # Sample texts
    pos_sample = positive_texts[:min(n_samples, len(positive_texts))]
    neg_sample = negative_texts[:min(n_samples, len(negative_texts))]

    # Measure positive examples
    pos_scores = []
    for text in pos_sample:
        emb = embedding_service.embed_text(text)
        rho = create_density_matrix_with_operator(emb, operator)
        score = operator.measure(rho)
        pos_scores.append(score)

    # Measure negative examples
    neg_scores = []
    for text in neg_sample:
        emb = embedding_service.embed_text(text)
        rho = create_density_matrix_with_operator(emb, operator)
        score = operator.measure(rho)
        neg_scores.append(score)

    # Compute statistics
    pos_mean = mean(pos_scores)
    neg_mean = mean(neg_scores)
    separation = pos_mean - neg_mean

    # Effect size (Cohen's d)
    pos_std = stdev(pos_scores) if len(pos_scores) > 1 else 0.0
    neg_std = stdev(neg_scores) if len(neg_scores) > 1 else 0.0
    pooled_std = np.sqrt((pos_std**2 + neg_std**2) / 2)
    effect_size = separation / pooled_std if pooled_std > 0 else 0.0

    # Variance test (same text measured multiple times)
    if len(pos_sample) > 0:
        test_text = pos_sample[0]
        test_scores = []
        for _ in range(10):
            emb = embedding_service.embed_text(test_text)
            rho = create_density_matrix_with_operator(emb, operator)
            score = operator.measure(rho)
            test_scores.append(score)
        variance = stdev(test_scores) if len(test_scores) > 1 else 0.0
    else:
        variance = 0.0

    return {
        'pos_mean': pos_mean,
        'neg_mean': neg_mean,
        'separation': separation,
        'effect_size': effect_size,
        'variance': variance,
        'passed': separation > 0 and effect_size > 0.5 and variance < 0.001,
    }


def validate_pack_sum_to_identity(pack: SemanticPOVMPack) -> Dict[str, float]:
    """
    Validate that operators sum to identity: Σ E_i = I

    Args:
        pack: Semantic POVM pack

    Returns:
        Validation metrics
    """
    # Compute sum of operators
    total = np.zeros((pack.rank, pack.rank))
    for op in pack.operators:
        total += op.E

    # Compute difference from identity
    identity = np.eye(pack.rank)
    diff = np.linalg.norm(total - identity, 'fro')  # Frobenius norm

    # Check eigenvalues (should all be ~1 for identity)
    eigvals = np.linalg.eigvalsh(total)
    eigval_mean = np.mean(eigvals)
    eigval_std = np.std(eigvals)

    return {
        'diff_from_identity': diff,
        'eigenvalue_mean': eigval_mean,
        'eigenvalue_std': eigval_std,
        'passed': diff < 0.1,  # Tolerance
    }


# ============================================================================
# Learning Pipeline
# ============================================================================

def learn_pack(
    pack_name: str,
    description: str,
    corpus_dict: Dict[str, List[str]],
    embedding_service,
    rank: int = 64,
    validate: bool = True,
) -> SemanticPOVMPack:
    """
    Learn semantic POVM pack from corpus.

    Args:
        pack_name: Pack name
        description: Pack description
        corpus_dict: Corpus dictionary (axis → texts)
        embedding_service: Sentence embedding service
        rank: Density matrix rank
        validate: Whether to validate operators

    Returns:
        Learned semantic POVM pack
    """
    print(f"\n{'='*80}")
    print(f"LEARNING PACK: {pack_name}")
    print(f"{'='*80}\n")

    # Learn pack
    pack = SemanticPOVMPack.from_corpus_dict(
        pack_name=pack_name,
        description=description,
        corpus_dict=corpus_dict,
        embedding_service=embedding_service,
        rank=rank,
    )

    if validate:
        print(f"\n{'='*80}")
        print(f"VALIDATING PACK: {pack_name}")
        print(f"{'='*80}\n")

        # Validate sum-to-identity
        identity_metrics = validate_pack_sum_to_identity(pack)
        print(f"Sum-to-identity validation:")
        print(f"  Difference from I: {identity_metrics['diff_from_identity']:.6f}")
        print(f"  Eigenvalue mean:   {identity_metrics['eigenvalue_mean']:.6f} (should be ~1.0)")
        print(f"  Eigenvalue std:    {identity_metrics['eigenvalue_std']:.6f}")
        status = "✅ PASSED" if identity_metrics['passed'] else "❌ FAILED"
        print(f"  Status: {status}\n")

        # Validate discrimination for each operator
        # Use other axes as negative examples
        all_axes = list(corpus_dict.keys())

        print(f"Discrimination validation:")
        for i, op in enumerate(pack.operators):
            axis_name = op.name
            positive_texts = corpus_dict[axis_name]

            # Negative examples: all other axes combined
            negative_texts = []
            for other_axis in all_axes:
                if other_axis != axis_name:
                    negative_texts.extend(corpus_dict[other_axis])

            metrics = validate_operator_discrimination(
                operator=op,
                positive_texts=positive_texts,
                negative_texts=negative_texts,
                embedding_service=embedding_service,
                n_samples=5,
            )

            status = "✅" if metrics['passed'] else "❌"
            print(f"  {status} {axis_name:20s}: sep={metrics['separation']:+.4f}, "
                  f"d={metrics['effect_size']:+.2f}, σ={metrics['variance']:.6f}")

    return pack


def learn_all_operators(
    rank: int = 64,
    validate: bool = True,
    save_dir: Path = None,
) -> Dict[str, SemanticPOVMPack]:
    """
    Learn all semantic POVM operators from corpus.

    Args:
        rank: Density matrix rank
        validate: Whether to validate operators
        save_dir: Directory to save operators (default: data/semantic_operators)

    Returns:
        Dict mapping pack names to semantic POVM packs
    """
    if save_dir is None:
        save_dir = project_root / 'data' / 'semantic_operators'

    save_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*80}")
    print(f" SEMANTIC OPERATOR LEARNING PIPELINE ".center(80, '='))
    print(f"{'='*80}\n")

    print(f"Configuration:")
    print(f"  Rank: {rank}")
    print(f"  Validation: {validate}")
    print(f"  Save directory: {save_dir}")
    print()

    # Get embedding service
    embedding_service = get_sentence_embedding_service()

    # Learn all packs
    packs = {}

    for pack_name, axes_config in AXIS_DEFINITIONS.items():
        # Get pack description from first axis config (or default)
        description = f"{pack_name.capitalize()} POVM pack"

        try:
            # Load corpus
            print(f"\nLoading corpus for {pack_name}...")
            corpus_dict = load_corpus_for_pack(pack_name)

            if not corpus_dict:
                print(f"⚠️  Skipping {pack_name} - no corpus data")
                continue

            # Learn pack
            pack = learn_pack(
                pack_name=pack_name,
                description=description,
                corpus_dict=corpus_dict,
                embedding_service=embedding_service,
                rank=rank,
                validate=validate,
            )

            packs[pack_name] = pack

            # Save pack
            pack.save(save_dir)

        except Exception as e:
            print(f"❌ Error learning {pack_name}: {e}")
            import traceback
            traceback.print_exc()
            continue

    # Summary
    print(f"\n{'='*80}")
    print(f" LEARNING COMPLETE ".center(80, '='))
    print(f"{'='*80}\n")

    print(f"Learned {len(packs)} POVM packs:")
    for pack_name, pack in packs.items():
        print(f"  ✅ {pack_name:15s}: {len(pack.operators)} operators")

    print(f"\nSaved to: {save_dir}")
    print(f"{'='*80}\n")

    return packs


# ============================================================================
# Loading Learned Operators
# ============================================================================

def load_all_operators(load_dir: Path = None) -> Dict[str, SemanticPOVMPack]:
    """
    Load all learned semantic POVM operators.

    Args:
        load_dir: Directory to load from (default: data/semantic_operators)

    Returns:
        Dict mapping pack names to semantic POVM packs
    """
    if load_dir is None:
        load_dir = project_root / 'data' / 'semantic_operators'

    if not load_dir.exists():
        raise FileNotFoundError(f"Operators directory not found: {load_dir}")

    print(f"Loading semantic operators from: {load_dir}")

    packs = {}
    for pack_dir in load_dir.iterdir():
        if pack_dir.is_dir():
            pack_name = pack_dir.name
            try:
                pack = SemanticPOVMPack.load(load_dir, pack_name)
                packs[pack_name] = pack
            except Exception as e:
                print(f"⚠️  Could not load {pack_name}: {e}")

    print(f"✅ Loaded {len(packs)} packs\n")

    return packs


# ============================================================================
# CLI
# ============================================================================

def main():
    """CLI for operator learning."""
    import argparse

    parser = argparse.ArgumentParser(description='Learn semantic POVM operators from corpus')
    parser.add_argument('--rank', type=int, default=64, help='Density matrix rank')
    parser.add_argument('--no-validate', action='store_true', help='Skip validation')
    parser.add_argument('--save-dir', type=Path, help='Save directory')
    parser.add_argument('--pack', help='Learn single pack (default: all)')

    args = parser.parse_args()

    if args.pack:
        # Learn single pack
        embedding_service = get_sentence_embedding_service()
        corpus_dict = load_corpus_for_pack(args.pack)

        description = f"{args.pack.capitalize()} POVM pack"
        pack = learn_pack(
            pack_name=args.pack,
            description=description,
            corpus_dict=corpus_dict,
            embedding_service=embedding_service,
            rank=args.rank,
            validate=not args.no_validate,
        )

        # Save
        save_dir = args.save_dir or (project_root / 'data' / 'semantic_operators')
        pack.save(save_dir)

    else:
        # Learn all packs
        learn_all_operators(
            rank=args.rank,
            validate=not args.no_validate,
            save_dir=args.save_dir,
        )


if __name__ == "__main__":
    main()
