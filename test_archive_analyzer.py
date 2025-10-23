"""
Test Archive Analyzer on ChatGPT Archive

This script tests the archive analyzer on real ChatGPT conversation data.
It validates that:
1. Archive sampling works
2. Operator discrimination metrics compute correctly
3. Report generation works
4. Recommendations are sensible

Usage:
    poetry run python test_archive_analyzer.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from humanizer.database import get_session
from humanizer.services.archive_analyzer import (
    analyze_archive,
    generate_report
)
from humanizer.services.operator_learning import load_all_operators


async def main():
    print("\n" + "="*80)
    print(" ARCHIVE ANALYZER TEST ".center(80, "="))
    print("="*80 + "\n")

    print("Testing archive analyzer on ChatGPT conversations...")
    print()

    # Load semantic operators (from Week 2)
    print("Loading semantic operators...")
    try:
        semantic_packs_dict = load_all_operators()
        print(f"✅ Loaded {len(semantic_packs_dict)} semantic POVM packs")
        for pack_name, pack in semantic_packs_dict.items():
            print(f"   - {pack_name}: {len(pack.operators)} operators")
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

        # Run analysis
        print("Analyzing archive (this may take 30-60 seconds)...")
        print("- Sampling 200 texts from ChatGPT conversations")
        print("- Measuring with all operators")
        print("- Computing discrimination metrics")
        print()

        try:
            result = await analyze_archive(
                session=session,
                archive_name="chatgpt",
                operators=semantic_packs_dict,
                sample_size=200
            )

            print("✅ Analysis complete!")
            print()

            # Display summary
            print("="*80)
            print(" ANALYSIS RESULTS ".center(80, "="))
            print("="*80)
            print()

            print(f"Archive:         {result.archive_name}")
            print(f"Sample Size:     {result.sample_size} texts")
            print(f"Overall Score:   {result.overall_score:.3f}")
            print(f"Overall Quality: {result.overall_quality.upper()}")
            print(f"Recommendation:  {result.recommendation.upper().replace('_', ' ')}")
            print()

            # Pack summary
            print("Pack Summaries:")
            print("-" * 80)
            for pack_name, metrics in result.pack_metrics.items():
                weak_count = len(metrics.weak_operators)
                quality_emoji = {
                    "excellent": "✅",
                    "good": "✓ ",
                    "fair": "⚠️ ",
                    "poor": "❌"
                }.get(metrics.pack_quality, "? ")

                print(f"{quality_emoji} {pack_name:15s}: "
                      f"d̄={metrics.average_discrimination:.3f}, "
                      f"coverage={metrics.coverage:.2f}, "
                      f"weak={weak_count}/{metrics.num_operators}")

            print()

            # Weak operators detail
            if result.all_weak_operators:
                print(f"Weak Operators ({len(result.all_weak_operators)}):")
                print("-" * 80)
                for pack_name, op_name in result.all_weak_operators:
                    d_value = result.pack_metrics[pack_name].operator_metrics[op_name].cohens_d
                    print(f"  - {pack_name}/{op_name}: d={d_value:.3f}")
                print()

            # Generate full report
            print("="*80)
            print(" GENERATING FULL REPORT ".center(80, "="))
            print("="*80)
            print()

            report = generate_report(result)

            # Save report
            report_path = Path("archive_analysis_report.md")
            with open(report_path, "w") as f:
                f.write(report)

            print(f"✅ Full report saved to: {report_path}")
            print()

            # Print first few lines of report
            print("Report preview:")
            print("-" * 80)
            report_lines = report.split("\n")
            for line in report_lines[:30]:
                print(line)
            if len(report_lines) > 30:
                print(f"\n... ({len(report_lines) - 30} more lines)")
            print()

            # Final assessment
            print("="*80)
            print(" ASSESSMENT ".center(80, "="))
            print("="*80)
            print()

            if result.recommendation == "keep":
                print("✅ GOOD NEWS: Current operators work well on this archive!")
                print("   You can proceed with transformations using Week 2 operators.")
            elif result.recommendation == "retrain_weak":
                print(f"⚠️  PARTIAL RETRAINING NEEDED: {len(result.all_weak_operators)} operators show weak discrimination.")
                print("   Consider retraining these specific operators with archive-specific corpus.")
            else:  # retrain_all
                print("❌ FULL RETRAINING RECOMMENDED: Operators not well-suited for this archive.")
                print("   Proceed with Phase 2: Sample corpus and learn archive-specific operators.")

            print()
            print("="*80)
            print()

        except Exception as e:
            print(f"❌ Error during analysis: {e}")
            import traceback
            traceback.print_exc()
            return


if __name__ == "__main__":
    asyncio.run(main())
