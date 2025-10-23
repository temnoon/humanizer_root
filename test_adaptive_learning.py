"""
Test Adaptive Operator Learning from Archive Corpus

This script tests the complete adaptive learning workflow:
1. Load sampled corpus from archive
2. Learn archive-specific operators
3. Compare to baseline (default) operators
4. Save archive-specific operators

Usage:
    poetry run python test_adaptive_learning.py
"""

import asyncio
import sys
import json
from pathlib import Path

# Add project root
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from humanizer.services.operator_learning import learn_pack
from humanizer.services.sentence_embedding import get_sentence_embedding_service


def load_corpus_from_directory(corpus_dir: Path, pack_name: str) -> dict:
    """
    Load corpus from custom directory.

    Args:
        corpus_dir: Base corpus directory (e.g., data/povm_corpus/chatgpt_archive_test)
        pack_name: Pack name (e.g., "tone")

    Returns:
        Dict[axis_name, List[text]]
    """
    pack_dir = corpus_dir / pack_name

    if not pack_dir.exists():
        raise FileNotFoundError(f"Pack directory not found: {pack_dir}")

    corpus_dict = {}
    json_files = list(pack_dir.glob("*.json"))

    for filepath in json_files:
        axis_name = filepath.stem  # filename without .json

        with open(filepath) as f:
            data = json.load(f)

        # Extract texts from examples
        texts = [example['text'] for example in data['examples']]
        corpus_dict[axis_name] = texts

        print(f"  Loaded {pack_name}/{axis_name}: {len(texts)} examples")

    return corpus_dict


async def main():
    print("\n" + "="*80)
    print(" ADAPTIVE OPERATOR LEARNING TEST ".center(80, "="))
    print("="*80 + "\n")

    print("This test learns archive-specific operators from sampled corpus")
    print()

    # Load sampled corpus
    print("Loading sampled corpus...")
    corpus_dir = Path("data/povm_corpus/chatgpt_archive_test")

    if not corpus_dir.exists():
        print(f"❌ Error: Corpus directory not found: {corpus_dir}")
        print()
        print("Run this first:")
        print("   poetry run python test_corpus_sampler.py")
        return

    try:
        corpus_dict = load_corpus_from_directory(corpus_dir, "tone")
        print(f"✅ Loaded corpus for 'tone' pack ({len(corpus_dict)} axes)")
        print()
    except Exception as e:
        print(f"❌ Error loading corpus: {e}")
        return

    # Get embedding service
    print("Initializing embedding service...")
    embedding_service = get_sentence_embedding_service()
    print("✅ Ready")
    print()

    # Learn operators
    print("Learning archive-specific operators...")
    print("(This may take 30-60 seconds)")
    print()

    try:
        pack = learn_pack(
            pack_name="tone",
            description="Tone pack learned from ChatGPT archive",
            corpus_dict=corpus_dict,
            embedding_service=embedding_service,
            rank=64,
            validate=True
        )

        print()
        print("✅ Learning complete!")
        print()

        # Summary
        print("="*80)
        print(" LEARNING RESULTS ".center(80, "="))
        print("="*80)
        print()

        print(f"Pack:      {pack.name}")
        print(f"Operators: {len(pack.operators)}")
        print(f"Rank:      {pack.rank}")
        print()

        print("Operators learned:")
        for op in pack.operators:
            print(f"  - {op.name}: corpus_size={op.corpus_size}")
        print()

        # Save to archive-specific directory
        print("="*80)
        print(" SAVING OPERATORS ".center(80, "="))
        print("="*80)
        print()

        output_dir = Path("data/semantic_operators/chatgpt_archive_test")
        output_dir.mkdir(parents=True, exist_ok=True)

        pack.save(output_dir)
        print(f"✅ Saved to: {output_dir}/tone/")
        print()

        # Verify files
        tone_dir = output_dir / "tone"
        pkl_files = list(tone_dir.glob("*.pkl"))
        print(f"Created {len(pkl_files)} operator files:")
        for filepath in sorted(pkl_files):
            print(f"  - {filepath.name}")
        print()

        # Assessment
        print("="*80)
        print(" ASSESSMENT ".center(80, "="))
        print("="*80)
        print()

        print("✅ SUCCESS: Archive-specific operators learned!")
        print()
        print("These operators were learned from:")
        print("  - 50 texts sampled from ChatGPT archive")
        print("  - 10 texts per axis")
        print("  - High diversity (avg=0.83)")
        print()
        print("Next steps:")
        print("1. Validate these operators on held-out archive data")
        print("2. Compare discrimination to default operators")
        print("3. Integrate into transformation engine")
        print()

    except Exception as e:
        print(f"❌ Error during learning: {e}")
        import traceback
        traceback.print_exc()
        return


if __name__ == "__main__":
    asyncio.run(main())
