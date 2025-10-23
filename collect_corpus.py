"""
Corpus Collection for Semantic POVM Operators

Purpose: Collect 50-100 exemplar texts for each of 22 POVM axes
- Tetralemma (4): A, ¬A, both, neither
- Tone (5): analytical, critical, empathic, playful, neutral
- Ontology (4): corporeal, subjective, objective, mixed_frame
- Pragmatics (4): clarity, coherence, evidence, charity
- Audience (5): expert, general, student, policy, editorial

Sources:
1. ChatGPT archive (1,659 conversations, 46,355 messages)
2. LLM generation (Claude API for specific examples)
3. Manual curation (structured JSON files)

Output: data/povm_corpus/{pack}/{axis}.json
"""

import sys
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Will use these when needed
# from humanizer.models.chatgpt import ChatGPTMessage
# from humanizer.services.sentence_embedding import get_sentence_embedding_service


# ============================================================================
# Corpus Structure
# ============================================================================

@dataclass
class CorpusExample:
    """Single example text for a POVM axis."""
    text: str
    source: str  # "chatgpt", "llm_generated", "manual"
    source_id: Optional[str] = None  # Conversation ID or message ID if from ChatGPT
    quality_score: Optional[float] = None  # 0-1, manual quality rating
    notes: Optional[str] = None


@dataclass
class CorpusAxis:
    """Collection of examples for a single axis."""
    pack: str
    axis: str
    description: str
    examples: List[CorpusExample]

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict."""
        return {
            'pack': self.pack,
            'axis': self.axis,
            'description': self.description,
            'examples': [asdict(ex) for ex in self.examples],
            'count': len(self.examples),
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'CorpusAxis':
        """Load from JSON dict."""
        examples = [CorpusExample(**ex) for ex in data['examples']]
        return cls(
            pack=data['pack'],
            axis=data['axis'],
            description=data['description'],
            examples=examples,
        )


# ============================================================================
# Axis Definitions
# ============================================================================

AXIS_DEFINITIONS = {
    # Tetralemma Pack
    'tetralemma': {
        'A': {
            'description': 'Affirmative stance - clearly states something IS true',
            'keywords': ['is', 'are', 'affirm', 'assert', 'true', 'exists'],
            'examples': [
                'The sky is blue.',
                'Water freezes at 0°C.',
                'Democracy is the best system of government.',
            ],
        },
        '¬A': {
            'description': 'Negative stance - clearly states something IS NOT true',
            'keywords': ['not', 'never', 'no', 'deny', 'false', 'absent'],
            'examples': [
                'The sky is not green.',
                'This theory is not supported by evidence.',
                'I do not agree with that conclusion.',
            ],
        },
        'both': {
            'description': 'Paradoxical stance - acknowledges something is BOTH true and false',
            'keywords': ['both', 'and', 'paradox', 'contradictory', 'simultaneously'],
            'examples': [
                'Light is both a wave and a particle.',
                'This statement is both true and false depending on perspective.',
                'Quantum particles exist in superposition - both here and there.',
            ],
        },
        'neither': {
            'description': 'Neutral/transcendent stance - something is NEITHER true nor false',
            'keywords': ['neither', 'uncertain', 'unknowable', 'beyond', 'transcends'],
            'examples': [
                'The question of consciousness is neither purely physical nor purely mental.',
                'This is neither right nor wrong - it simply is.',
                'The nature of reality transcends binary categories.',
            ],
        },
    },

    # Tone Pack
    'tone': {
        'analytical': {
            'description': 'Systematic analysis with evidence and reasoning',
            'keywords': ['analysis', 'evidence', 'systematic', 'data', 'framework', 'methodology'],
            'examples': [
                'The empirical data demonstrates a statistically significant correlation.',
                'Systematic analysis reveals three distinct patterns in the dataset.',
                'The framework provides a structured approach to decomposing complex systems.',
            ],
        },
        'critical': {
            'description': 'Evaluative stance that questions and challenges',
            'keywords': ['however', 'critique', 'problematic', 'overlooks', 'fails to', 'questionable'],
            'examples': [
                'This approach fails to account for confounding variables.',
                'The argument rests on questionable assumptions.',
                'However, the methodology has significant limitations.',
            ],
        },
        'empathic': {
            'description': 'Understanding and validating emotional experience',
            'keywords': ['feel', 'understand', 'appreciate', 'recognize', 'validated', 'experience'],
            'examples': [
                'I understand how difficult this must be for you.',
                'Your feelings are completely valid and understandable.',
                'I appreciate the emotional weight of this situation.',
            ],
        },
        'playful': {
            'description': 'Lighthearted, humorous, or whimsical',
            'keywords': ['fun', 'play', 'silly', 'amusing', 'joke', 'wonder', '!'],
            'examples': [
                'Wow, that\'s so cool!',
                'Let\'s have some fun with this idea!',
                'I wonder what would happen if we tried something completely silly?',
            ],
        },
        'neutral': {
            'description': 'Objective, detached, without emotional coloring',
            'keywords': ['is', 'are', 'the', 'this', 'description', 'observation'],
            'examples': [
                'The temperature is 20 degrees Celsius.',
                'The object is located at position (x, y).',
                'This is a description of the observed phenomenon.',
            ],
        },
    },

    # Ontology Pack
    'ontology': {
        'corporeal': {
            'description': 'Physical, embodied, material existence',
            'keywords': ['body', 'physical', 'material', 'touch', 'sensation', 'flesh', 'concrete'],
            'examples': [
                'My hands are cold.',
                'The stone is rough and heavy.',
                'I feel the weight of my body in this chair.',
            ],
        },
        'subjective': {
            'description': 'Internal, personal, experiential reality',
            'keywords': ['I', 'feel', 'experience', 'seem', 'perceive', 'my', 'inner'],
            'examples': [
                'I feel anxious about this situation.',
                'From my perspective, this seems unclear.',
                'My inner experience suggests something different.',
            ],
        },
        'objective': {
            'description': 'External, shared, verifiable reality',
            'keywords': ['fact', 'evidence', 'measured', 'observed', 'verified', 'external'],
            'examples': [
                'The measurement shows 10.3 meters.',
                'The evidence confirms the hypothesis.',
                'External observations verify this claim.',
            ],
        },
        'mixed_frame': {
            'description': 'Intersubjective, relational, co-constructed reality',
            'keywords': ['we', 'together', 'shared', 'intersubjective', 'between', 'mutual'],
            'examples': [
                'We share an understanding of this situation.',
                'The meaning emerges between us in conversation.',
                'Our mutual recognition creates this reality.',
            ],
        },
    },

    # Pragmatics Pack
    'pragmatics': {
        'clarity': {
            'description': 'Clear, unambiguous, easy to understand',
            'keywords': ['clear', 'simple', 'straightforward', 'plain', 'unambiguous', 'explicit'],
            'examples': [
                'To summarize: there are three main points.',
                'Simply put, the answer is yes.',
                'Let me be clear: this is the correct approach.',
            ],
        },
        'coherence': {
            'description': 'Logically connected, internally consistent',
            'keywords': ['therefore', 'because', 'thus', 'follows', 'consequently', 'implies'],
            'examples': [
                'Because X is true, therefore Y must follow.',
                'This implies that the conclusion is sound.',
                'The argument follows logically from the premises.',
            ],
        },
        'evidence': {
            'description': 'Grounded in data, citations, examples',
            'keywords': ['data', 'study', 'research', 'shows', 'demonstrates', 'according to'],
            'examples': [
                'According to Smith (2020), the correlation is significant.',
                'The data shows a clear trend.',
                'Research demonstrates that this approach works.',
            ],
        },
        'charity': {
            'description': 'Generous interpretation, acknowledges nuance',
            'keywords': ['perhaps', 'may', 'might', 'could', 'possibly', 'understandable'],
            'examples': [
                'Perhaps there\'s another way to interpret this.',
                'This may be understandable given the context.',
                'One could argue that both perspectives have merit.',
            ],
        },
    },

    # Audience Pack
    'audience': {
        'expert': {
            'description': 'Technical language for domain specialists',
            'keywords': ['methodology', 'algorithm', 'parameter', 'theorem', 'coefficient', 'schema'],
            'examples': [
                'The eigenvalue decomposition yields a diagonal matrix.',
                'We employ a Bayesian hierarchical model with MCMC sampling.',
                'The algorithm has O(n log n) time complexity.',
            ],
        },
        'general': {
            'description': 'Accessible to educated non-specialists',
            'keywords': ['understand', 'basically', 'like', 'similar to', 'in other words'],
            'examples': [
                'Basically, this means that things change over time.',
                'You can think of it like a recipe with steps.',
                'In other words, the system learns from experience.',
            ],
        },
        'student': {
            'description': 'Educational, with explanations and examples',
            'keywords': ['learn', 'example', 'let\'s', 'practice', 'exercise', 'understand'],
            'examples': [
                'Let\'s work through an example together.',
                'To understand this, consider the following practice problem.',
                'This exercise will help you learn the concept.',
            ],
        },
        'policy': {
            'description': 'Decision-oriented, actionable recommendations',
            'keywords': ['should', 'recommend', 'propose', 'action', 'implement', 'decision'],
            'examples': [
                'We recommend implementing the following policy changes.',
                'Decision-makers should prioritize resource allocation.',
                'The proposed action plan addresses three key areas.',
            ],
        },
        'editorial': {
            'description': 'Opinion pieces with persuasive arguments',
            'keywords': ['must', 'need', 'urgent', 'critical', 'imperative', 'believe'],
            'examples': [
                'We must take action now to address this crisis.',
                'It is imperative that society recognizes this issue.',
                'I believe strongly that this approach is fundamentally flawed.',
            ],
        },
    },
}


# ============================================================================
# Collection Functions
# ============================================================================

def create_corpus_directory():
    """Create directory structure for corpus."""
    corpus_dir = project_root / 'data' / 'povm_corpus'

    for pack in AXIS_DEFINITIONS.keys():
        pack_dir = corpus_dir / pack
        pack_dir.mkdir(parents=True, exist_ok=True)

    print(f"✅ Created corpus directory: {corpus_dir}")
    return corpus_dir


def initialize_corpus_files():
    """Initialize JSON files for each axis with seed examples."""
    corpus_dir = project_root / 'data' / 'povm_corpus'

    for pack, axes in AXIS_DEFINITIONS.items():
        for axis, config in axes.items():
            # Create CorpusAxis with seed examples
            examples = [
                CorpusExample(text=text, source='manual', quality_score=1.0)
                for text in config['examples']
            ]

            corpus_axis = CorpusAxis(
                pack=pack,
                axis=axis,
                description=config['description'],
                examples=examples,
            )

            # Save to JSON
            filepath = corpus_dir / pack / f"{axis}.json"
            with open(filepath, 'w') as f:
                json.dump(corpus_axis.to_dict(), f, indent=2)

            print(f"✅ Initialized {pack}/{axis}: {len(examples)} seed examples")


def load_corpus_axis(pack: str, axis: str) -> CorpusAxis:
    """Load corpus for a specific axis."""
    filepath = project_root / 'data' / 'povm_corpus' / pack / f"{axis}.json"
    with open(filepath) as f:
        data = json.load(f)
    return CorpusAxis.from_dict(data)


def save_corpus_axis(corpus_axis: CorpusAxis):
    """Save corpus axis to JSON."""
    filepath = project_root / 'data' / 'povm_corpus' / corpus_axis.pack / f"{corpus_axis.axis}.json"
    with open(filepath, 'w') as f:
        json.dump(corpus_axis.to_dict(), f, indent=2)
    print(f"✅ Saved {corpus_axis.pack}/{corpus_axis.axis}: {len(corpus_axis.examples)} examples")


def generate_summary():
    """Generate summary of corpus collection progress."""
    corpus_dir = project_root / 'data' / 'povm_corpus'

    print("\n" + "="*80)
    print("CORPUS COLLECTION SUMMARY".center(80))
    print("="*80 + "\n")

    total_examples = 0
    pack_summaries = []

    for pack, axes in AXIS_DEFINITIONS.items():
        pack_total = 0
        pack_details = []

        for axis in axes.keys():
            filepath = corpus_dir / pack / f"{axis}.json"
            if filepath.exists():
                with open(filepath) as f:
                    data = json.load(f)
                count = data['count']
                pack_total += count
                total_examples += count

                # Status indicator
                if count >= 100:
                    status = "✅"
                elif count >= 50:
                    status = "✓ "
                else:
                    status = "⏳"

                pack_details.append(f"  {status} {axis:20s}: {count:3d} examples")

        pack_summaries.append({
            'pack': pack,
            'total': pack_total,
            'details': pack_details,
        })

    # Print pack summaries
    for summary in pack_summaries:
        print(f"{summary['pack'].upper()}: {summary['total']} total examples")
        for detail in summary['details']:
            print(detail)
        print()

    # Overall summary
    print("="*80)
    print(f"TOTAL: {total_examples} examples across 22 axes")
    print(f"Target: 1,100-2,200 examples (50-100 per axis)")
    progress = total_examples / 1100 * 100
    print(f"Progress: {progress:.1f}%")
    print("="*80 + "\n")


# ============================================================================
# Main CLI
# ============================================================================

def main():
    """Main corpus collection CLI."""
    import argparse

    parser = argparse.ArgumentParser(description='Collect corpus for semantic POVM operators')
    parser.add_argument('command', choices=['init', 'summary', 'add'],
                      help='Command to execute')
    parser.add_argument('--pack', help='POVM pack name')
    parser.add_argument('--axis', help='Axis name')
    parser.add_argument('--text', help='Example text to add')
    parser.add_argument('--source', default='manual', help='Source of example')

    args = parser.parse_args()

    if args.command == 'init':
        print("Initializing corpus collection...")
        create_corpus_directory()
        initialize_corpus_files()
        print("\n✅ Corpus initialized with seed examples")
        print("Next steps:")
        print("  1. Run 'python collect_corpus.py summary' to see progress")
        print("  2. Add examples with 'python collect_corpus.py add --pack <pack> --axis <axis> --text \"...\"'")
        print("  3. Or edit JSON files directly in data/povm_corpus/")

    elif args.command == 'summary':
        generate_summary()

    elif args.command == 'add':
        if not args.pack or not args.axis or not args.text:
            print("❌ Error: --pack, --axis, and --text required for 'add' command")
            return

        # Load existing corpus
        corpus_axis = load_corpus_axis(args.pack, args.axis)

        # Add new example
        example = CorpusExample(text=args.text, source=args.source)
        corpus_axis.examples.append(example)

        # Save
        save_corpus_axis(corpus_axis)
        print(f"✅ Added example to {args.pack}/{args.axis}")


if __name__ == "__main__":
    main()
