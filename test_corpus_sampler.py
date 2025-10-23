"""
Test Corpus Sampler on ChatGPT Archive

This script tests the corpus sampler by extracting representative texts
from the ChatGPT archive for the "tone" pack.

Usage:
    # Without LLM validation (fast, free)
    poetry run python test_corpus_sampler.py

    # With LLM validation (slow, costs API credits)
    poetry run python test_corpus_sampler.py --llm
"""

import asyncio
import sys
import argparse
from pathlib import Path

# Add project root
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from humanizer.database import get_session
from humanizer.services.corpus_sampler import (
    sample_corpus_from_archive,
    CorpusSampleConfig,
    save_corpus_to_disk
)
from humanizer.services.operator_learning import load_all_operators


# Axis descriptions for LLM validation
TONE_AXIS_DESCRIPTIONS = {
    "analytical": "Systematic analysis with evidence, reasoning, and logical structure",
    "critical": "Evaluative examination that identifies strengths, weaknesses, and issues",
    "empathic": "Understanding and acknowledging emotions, feelings, and perspectives",
    "playful": "Light-hearted, humorous, creative, or entertaining communication",
    "neutral": "Objective, factual, balanced tone without strong emotion or bias"
}


async def main(use_llm: bool = False):
    print("\n" + "="*80)
    print(" CORPUS SAMPLER TEST ".center(80, "="))
    print("="*80 + "\n")

    if use_llm:
        print("⚠️  LLM validation ENABLED - This will make API calls to Claude")
        print("   (Estimated cost: ~$0.10-0.50 depending on sample size)")
        print()
    else:
        print("LLM validation DISABLED - Using measure-only strategy")
        print("   (Run with --llm flag to enable LLM validation)")
        print()

    # Load semantic operators
    print("Loading semantic operators...")
    try:
        semantic_packs_dict = load_all_operators()
        print(f"✅ Loaded {len(semantic_packs_dict)} semantic POVM packs")
        print()
    except FileNotFoundError as e:
        print(f"❌ Error: Could not load semantic operators")
        print(f"   {e}")
        print()
        print("Run this first:")
        print("   poetry run python humanizer/services/operator_learning.py")
        return

    # Get database session
    print("Connecting to database...")
    async for session in get_session():
        print("✅ Connected")
        print()

        # Configure sampling
        config = CorpusSampleConfig(
            archive_name="chatgpt",
            target_pack="tone",
            samples_per_axis=10,  # Small sample for testing (normally 30)
            strategy="hybrid",
            candidate_pool_size=200,  # Sample 200 texts initially
            top_k_candidates=50,  # Select top 50 per axis
            llm_validation=use_llm,
            validation_batch_size=20,  # Validate top 20
            min_confidence=0.7,
            diversity_threshold=0.75
        )

        print("Sampling configuration:")
        print(f"  Archive:           {config.archive_name}")
        print(f"  Pack:              {config.target_pack}")
        print(f"  Samples per axis:  {config.samples_per_axis}")
        print(f"  Strategy:          {config.strategy}")
        print(f"  LLM validation:    {config.llm_validation}")
        print(f"  Diversity thresh:  {config.diversity_threshold}")
        print()

        # Run sampling
        print("Sampling corpus (this may take 30-90 seconds)...")
        print("- Sampling pool from archive")
        print("- Measuring with existing operators")
        if use_llm:
            print("- Validating with LLM (this adds 20-40 seconds)")
        print("- Applying diversity filtering")
        print()

        try:
            result = await sample_corpus_from_archive(
                session=session,
                config=config,
                operators=semantic_packs_dict,
                axis_descriptions=TONE_AXIS_DESCRIPTIONS if use_llm else None
            )

            print("✅ Sampling complete!")
            print()

            # Display results
            print("="*80)
            print(" SAMPLING RESULTS ".center(80, "="))
            print("="*80)
            print()

            print(f"Archive:         {result.archive_name}")
            print(f"Pack:            {result.pack_name}")
            print(f"Strategy:        {result.strategy}")
            print(f"LLM validation:  {result.llm_validation_used}")
            print(f"Total texts:     {result.total_texts_sampled}")
            print(f"Sampling date:   {result.sampling_date.strftime('%Y-%m-%d %H:%M:%S')}")
            print()

            # Per-axis summary
            print("Per-Axis Results:")
            print("-" * 80)
            for axis_name in sorted(result.corpus.keys()):
                count = result.per_axis_counts[axis_name]
                diversity = result.per_axis_diversity.get(axis_name, 0.0)
                print(f"  {axis_name:15s}: {count:2d} texts, diversity={diversity:.2f}")
            print()

            # Sample texts preview
            print("Sample Texts (first 2 per axis):")
            print("-" * 80)
            for axis_name in sorted(result.corpus.keys()):
                texts = result.corpus[axis_name]
                print(f"\n{axis_name.upper()}:")
                for i, text in enumerate(texts[:2], 1):
                    preview = text[:150] + "..." if len(text) > 150 else text
                    print(f"  {i}. \"{preview}\"")
            print()

            # Save to disk
            print("="*80)
            print(" SAVING TO DISK ".center(80, "="))
            print("="*80)
            print()

            output_dir = Path("data/povm_corpus/chatgpt_archive_test")
            save_corpus_to_disk(result, str(output_dir))

            print(f"✅ Corpus saved to: {output_dir}")
            print()

            # Verify files
            pack_dir = output_dir / result.pack_name
            json_files = list(pack_dir.glob("*.json"))
            print(f"Created {len(json_files)} corpus files:")
            for filepath in sorted(json_files):
                print(f"  - {filepath}")
            print()

            # Final assessment
            print("="*80)
            print(" ASSESSMENT ".center(80, "="))
            print("="*80)
            print()

            if result.total_texts_sampled >= len(result.corpus) * config.samples_per_axis * 0.8:
                print("✅ SUCCESS: Corpus sampled successfully!")
                print(f"   Got {result.total_texts_sampled} texts "
                      f"(target: {len(result.corpus) * config.samples_per_axis})")
            else:
                print("⚠️  PARTIAL: Fewer texts sampled than expected")
                print(f"   Got {result.total_texts_sampled} texts "
                      f"(target: {len(result.corpus) * config.samples_per_axis})")
                print("   This can happen with strict LLM validation or diversity filtering")

            print()

            avg_diversity = sum(result.per_axis_diversity.values()) / len(result.per_axis_diversity)
            if avg_diversity > 0.5:
                print(f"✅ DIVERSITY: Good diversity (avg={avg_diversity:.2f})")
            else:
                print(f"⚠️  DIVERSITY: Low diversity (avg={avg_diversity:.2f})")
                print("   Consider lowering diversity_threshold or increasing candidate pool")

            print()
            print("="*80)
            print()

            # Next steps
            print("Next steps:")
            print("1. Review sampled texts in: data/povm_corpus/chatgpt_archive_test/tone/")
            print("2. Use this corpus to learn archive-specific operators:")
            print("   poetry run python humanizer/services/operator_learning.py \\")
            print("       --corpus data/povm_corpus/chatgpt_archive_test/ \\")
            print("       --output data/semantic_operators/chatgpt_archive/")
            print()

        except Exception as e:
            print(f"❌ Error during sampling: {e}")
            import traceback
            traceback.print_exc()
            return


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test corpus sampler")
    parser.add_argument("--llm", action="store_true", help="Enable LLM validation")
    args = parser.parse_args()

    asyncio.run(main(use_llm=args.llm))
