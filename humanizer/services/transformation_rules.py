"""
Transformation Rules Library - Lexical patterns for POVM-guided transformations

This module contains rule libraries for transforming text toward target POVM axes.

Current Coverage (Phase 2A):
- Tone pack: analytical, empathic, critical

Future (Phase 2B+):
- Tone pack: playful, neutral
- Other POVM packs: tetralemma, ontology, pragmatics, audience

Rule Types:
1. Word substitutions: Replace words with target-aligned alternatives
2. Phrase removal: Remove hedging, filler, or counter-tone phrases
3. Sentence patterns: Add framing, qualifiers, or structural changes

Design Philosophy:
- High-confidence rules only (Tier 1)
- Conservative transformations (preserve meaning)
- Measurable impact (each rule should move POVM reading)
"""

from typing import Dict, List, Tuple, Optional
import re
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# Rule Application Functions
# ============================================================================

def apply_word_substitutions(
    text: str,
    substitutions: List[Dict[str, str]]
) -> Tuple[str, List[str]]:
    """
    Apply word substitutions to text.

    Args:
        text: Input text
        substitutions: List of {from: word, to: replacement} dicts

    Returns:
        Tuple of (modified_text, rules_applied)
    """
    modified = text
    applied = []

    for sub in substitutions:
        pattern = r'\b' + re.escape(sub["from"]) + r'\b'
        replacement = sub["to"]

        # Case-insensitive match, preserve original case
        def replace_preserve_case(match):
            original = match.group(0)
            if original[0].isupper():
                return replacement.capitalize()
            return replacement

        new_text = re.sub(pattern, replace_preserve_case, modified, flags=re.IGNORECASE)

        if new_text != modified:
            applied.append(f"sub:{sub['from']}→{sub['to']}")
            modified = new_text

    return modified, applied


def apply_phrase_removal(
    text: str,
    removals: List[Dict[str, str]]
) -> Tuple[str, List[str]]:
    """
    Remove hedging or filler phrases.

    Args:
        text: Input text
        removals: List of {pattern: regex, reason: description} dicts

    Returns:
        Tuple of (modified_text, rules_applied)
    """
    modified = text
    applied = []

    for removal in removals:
        pattern = removal["pattern"]

        new_text = re.sub(pattern, "", modified, flags=re.IGNORECASE)

        # Clean up double spaces
        new_text = re.sub(r'\s+', ' ', new_text).strip()

        if new_text != modified:
            applied.append(f"remove:{removal.get('reason', 'phrase')}")
            modified = new_text

    return modified, applied


def apply_sentence_patterns(
    text: str,
    patterns: List[Dict[str, str]]
) -> Tuple[str, List[str]]:
    """
    Apply sentence-level structural transformations.

    Args:
        text: Input text
        patterns: List of {type: pattern_type, ...} dicts

    Returns:
        Tuple of (modified_text, rules_applied)
    """
    modified = text
    applied = []

    for pattern in patterns:
        pattern_type = pattern.get("type")

        if pattern_type == "add_framing":
            # Add analytical framing prefix
            prefix = pattern.get("prefix", "")
            if prefix and not modified.startswith(prefix):
                modified = f"{prefix} {modified}"
                applied.append(f"frame:{pattern_type}")

        elif pattern_type == "add_evidence_marker":
            # Add evidence markers before statements
            marker = pattern.get("marker", "")
            if marker:
                # Simple heuristic: add before first sentence
                sentences = modified.split('. ')
                if len(sentences) > 0 and marker not in sentences[0]:
                    sentences[0] = f"{marker}, {sentences[0]}"
                    modified = '. '.join(sentences)
                    applied.append(f"evidence:{marker}")

        elif pattern_type == "strengthen_claim":
            # Remove qualifiers, strengthen assertions
            qualifiers = pattern.get("remove", [])
            for qual in qualifiers:
                pattern_str = r'\b' + re.escape(qual) + r'\b\s*'
                new_text = re.sub(pattern_str, "", modified, flags=re.IGNORECASE)
                if new_text != modified:
                    modified = new_text
                    applied.append(f"strengthen:remove_{qual}")

    return modified, applied


# ============================================================================
# Rule Libraries by POVM Pack and Axis
# ============================================================================

# Tone Pack Rules
# ---------------

TONE_ANALYTICAL_RULES = {
    "word_substitutions": [
        # Casual → Formal/Analytical
        {"from": "think", "to": "hypothesize"},
        {"from": "show", "to": "demonstrate"},
        {"from": "shows", "to": "demonstrates"},
        {"from": "get", "to": "obtain"},
        {"from": "gets", "to": "obtains"},
        {"from": "use", "to": "utilize"},
        {"from": "uses", "to": "utilizes"},
        {"from": "make", "to": "construct"},
        {"from": "makes", "to": "constructs"},
        {"from": "find", "to": "identify"},
        {"from": "finds", "to": "identifies"},
        {"from": "see", "to": "observe"},
        {"from": "sees", "to": "observes"},
        {"from": "big", "to": "substantial"},
        {"from": "small", "to": "minimal"},
        {"from": "very", "to": "significantly"},
        {"from": "really", "to": "substantially"},

        # Vague → Precise
        {"from": "thing", "to": "phenomenon"},
        {"from": "things", "to": "phenomena"},
        {"from": "stuff", "to": "material"},
        {"from": "a lot", "to": "numerous"},
        {"from": "some", "to": "certain"},
        {"from": "many", "to": "multiple"},
    ],

    "phrase_removal": [
        # Remove hedging
        {"pattern": r'\bI think\b\s*', "reason": "hedging"},
        {"pattern": r'\bI believe\b\s*', "reason": "hedging"},
        {"pattern": r'\bI feel\b\s*', "reason": "hedging"},
        {"pattern": r'\bmaybe\b\s*', "reason": "hedging"},
        {"pattern": r'\bperhaps\b\s*', "reason": "hedging"},
        {"pattern": r'\bpossibly\b\s*', "reason": "hedging"},
        {"pattern": r'\bprobably\b\s*', "reason": "hedging"},
        {"pattern": r'\bkind of\b\s*', "reason": "hedging"},
        {"pattern": r'\bsort of\b\s*', "reason": "hedging"},

        # Remove filler
        {"pattern": r'\byou know\b\s*,?\s*', "reason": "filler"},
        {"pattern": r'\blike\b\s+', "reason": "filler"},
        {"pattern": r'\bbasically\b\s*', "reason": "filler"},
        {"pattern": r'\bactually\b\s*', "reason": "filler"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "Analysis indicates that",
        },
        {
            "type": "add_evidence_marker",
            "marker": "Empirically",
        },
    ],
}

TONE_EMPATHIC_RULES = {
    "word_substitutions": [
        # Cold → Warm
        {"from": "demonstrate", "to": "show"},
        {"from": "demonstrates", "to": "shows"},
        {"from": "utilize", "to": "use"},
        {"from": "utilizes", "to": "uses"},
        {"from": "obtain", "to": "get"},
        {"from": "obtains", "to": "gets"},
        {"from": "individuals", "to": "people"},
        {"from": "individual", "to": "person"},

        # Impersonal → Personal
        {"from": "one must", "to": "we can"},
        {"from": "it is necessary", "to": "we need"},
        {"from": "the data suggests", "to": "we see"},

        # Technical → Accessible
        {"from": "construct", "to": "create"},
        {"from": "constructs", "to": "creates"},
        {"from": "facilitate", "to": "help"},
        {"from": "facilitates", "to": "helps"},
        {"from": "commence", "to": "begin"},
        {"from": "commences", "to": "begins"},
    ],

    "phrase_removal": [
        # Remove harsh qualifiers
        {"pattern": r'\bobviously\b\s*', "reason": "harsh"},
        {"pattern": r'\bclearly\b\s*', "reason": "harsh"},
        {"pattern": r'\bsimply\b\s*', "reason": "dismissive"},
        {"pattern": r'\bjust\b\s+', "reason": "dismissive"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "It's worth considering that",
        },
        {
            "type": "add_evidence_marker",
            "marker": "From experience",
        },
    ],
}

TONE_CRITICAL_RULES = {
    "word_substitutions": [
        # Weak → Strong
        {"from": "suggests", "to": "indicates"},
        {"from": "suggest", "to": "indicate"},
        {"from": "might", "to": "may"},
        {"from": "could", "to": "can"},
        {"from": "appears", "to": "is"},
        {"from": "seem", "to": "are"},
        {"from": "seems", "to": "is"},

        # Accepting → Questioning
        {"from": "shows", "to": "purports to show"},
        {"from": "demonstrates", "to": "claims to demonstrate"},
        {"from": "proves", "to": "attempts to prove"},
    ],

    "phrase_removal": [
        # Remove softening
        {"pattern": r'\bquite\b\s*', "reason": "softening"},
        {"pattern": r'\brather\b\s*', "reason": "softening"},
        {"pattern": r'\bfairly\b\s*', "reason": "softening"},
        {"pattern": r'\brelatively\b\s*', "reason": "softening"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "Critical examination reveals that",
        },
        {
            "type": "add_evidence_marker",
            "marker": "However",
        },
        {
            "type": "strengthen_claim",
            "remove": ["possibly", "perhaps", "maybe"],
        },
    ],
}


# Tetralemma Pack Rules
# ---------------------

TETRALEMMA_A_RULES = {
    "word_substitutions": [
        # Uncertain → Certain
        {"from": "might be", "to": "is"},
        {"from": "could be", "to": "is"},
        {"from": "may be", "to": "is"},
        {"from": "possibly", "to": "certainly"},
        {"from": "perhaps", "to": "indeed"},
        {"from": "maybe", "to": "definitely"},

        # Weak → Strong assertions
        {"from": "suggests", "to": "proves"},
        {"from": "indicates", "to": "confirms"},
        {"from": "seems", "to": "is"},
        {"from": "appears", "to": "is"},
    ],

    "phrase_removal": [
        # Remove hedging
        {"pattern": r'\bI think\b\s*', "reason": "hedging"},
        {"pattern": r'\bI believe\b\s*', "reason": "hedging"},
        {"pattern": r'\bin my opinion\b\s*', "reason": "hedging"},
        {"pattern": r'\bto some extent\b\s*', "reason": "hedging"},
        {"pattern": r'\bsort of\b\s*', "reason": "hedging"},
        {"pattern": r'\bkind of\b\s*', "reason": "hedging"},

        # Remove negations
        {"pattern": r'\bnot necessarily\b\s*', "reason": "negation"},
        {"pattern": r'\bmay not\b\s*', "reason": "negation"},
        {"pattern": r'\bmight not\b\s*', "reason": "negation"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "It is the case that",
        },
        {
            "type": "strengthen_claim",
            "remove": ["probably", "likely", "possibly", "perhaps"],
        },
    ],
}

TETRALEMMA_NOT_A_RULES = {
    "word_substitutions": [
        # Positive → Negative
        {"from": "is", "to": "is not"},
        {"from": "are", "to": "are not"},
        {"from": "can", "to": "cannot"},
        {"from": "will", "to": "will not"},
        {"from": "does", "to": "does not"},
        {"from": "has", "to": "has not"},

        # Affirm → Deny
        {"from": "confirms", "to": "refutes"},
        {"from": "proves", "to": "disproves"},
        {"from": "supports", "to": "contradicts"},
        {"from": "shows", "to": "fails to show"},
    ],

    "phrase_removal": [
        # Remove affirmations
        {"pattern": r'\bcertainly\b\s*', "reason": "affirmation"},
        {"pattern": r'\bdefinitely\b\s*', "reason": "affirmation"},
        {"pattern": r'\bobviously\b\s*', "reason": "affirmation"},
        {"pattern": r'\bclearly\b\s*', "reason": "affirmation"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "It is not the case that",
        },
    ],
}

TETRALEMMA_BOTH_RULES = {
    "word_substitutions": [
        # Binary → Paradoxical
        {"from": "either", "to": "both"},
        {"from": "or", "to": "and"},
        {"from": "but", "to": "and also"},
        {"from": "however", "to": "and simultaneously"},
    ],

    "phrase_removal": [],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "Paradoxically,",
        },
        {
            "type": "add_evidence_marker",
            "marker": "On one hand",
        },
    ],
}

TETRALEMMA_NEITHER_RULES = {
    "word_substitutions": [
        # Definite → Transcendent
        {"from": "is", "to": "transcends being"},
        {"from": "exists", "to": "neither exists nor doesn't exist"},
        {"from": "true", "to": "beyond truth"},
        {"from": "false", "to": "beyond falsity"},
    ],

    "phrase_removal": [
        # Remove binary framing
        {"pattern": r'\beither\b\s*', "reason": "binary"},
        {"pattern": r'\bor\b\s+', "reason": "binary"},
        {"pattern": r'\btrue or false\b\s*', "reason": "binary"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "Neither is it the case that",
        },
    ],
}


# Ontology Pack Rules
# -------------------

ONTOLOGY_CORPOREAL_RULES = {
    "word_substitutions": [
        # Abstract → Physical
        {"from": "concept", "to": "object"},
        {"from": "idea", "to": "thing"},
        {"from": "thought", "to": "sensation"},
        {"from": "think", "to": "feel"},
        {"from": "believes", "to": "senses"},
        {"from": "understand", "to": "touch"},

        # Mental → Bodily
        {"from": "mind", "to": "body"},
        {"from": "consciousness", "to": "flesh"},
        {"from": "mental", "to": "physical"},
        {"from": "cognitive", "to": "sensory"},
    ],

    "phrase_removal": [
        # Remove abstract qualifiers
        {"pattern": r'\btheoretically\b\s*', "reason": "abstract"},
        {"pattern": r'\bconceptually\b\s*', "reason": "abstract"},
        {"pattern": r'\bin theory\b\s*', "reason": "abstract"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "Physically,",
        },
        {
            "type": "add_evidence_marker",
            "marker": "In the body",
        },
    ],
}

ONTOLOGY_SUBJECTIVE_RULES = {
    "word_substitutions": [
        # Objective → Subjective
        {"from": "the data", "to": "my experience"},
        {"from": "objectively", "to": "subjectively"},
        {"from": "fact", "to": "feeling"},
        {"from": "proves", "to": "suggests to me"},
        {"from": "shows", "to": "appears to me"},

        # Impersonal → Personal
        {"from": "one", "to": "I"},
        {"from": "it is", "to": "I feel it is"},
        {"from": "there is", "to": "I experience"},
    ],

    "phrase_removal": [
        # Remove objective markers
        {"pattern": r'\bobjectively\b\s*', "reason": "objective"},
        {"pattern": r'\bfactually\b\s*', "reason": "objective"},
        {"pattern": r'\bin fact\b\s*', "reason": "objective"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "In my view,",
        },
        {
            "type": "add_evidence_marker",
            "marker": "I feel that",
        },
    ],
}

ONTOLOGY_OBJECTIVE_RULES = {
    "word_substitutions": [
        # Subjective → Objective
        {"from": "I think", "to": "the evidence shows"},
        {"from": "I feel", "to": "the data indicates"},
        {"from": "seems to me", "to": "is measured as"},
        {"from": "my experience", "to": "the observations"},
        {"from": "I believe", "to": "analysis confirms"},

        # Personal → Impersonal
        {"from": "I", "to": "one"},
        {"from": "my", "to": "the"},
        {"from": "me", "to": "the observer"},
    ],

    "phrase_removal": [
        # Remove subjective markers
        {"pattern": r'\bI think\b\s*', "reason": "subjective"},
        {"pattern": r'\bI feel\b\s*', "reason": "subjective"},
        {"pattern": r'\bin my opinion\b\s*', "reason": "subjective"},
        {"pattern": r'\bpersonally\b\s*', "reason": "subjective"},
    ],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "Objectively,",
        },
        {
            "type": "add_evidence_marker",
            "marker": "The data shows",
        },
    ],
}

ONTOLOGY_MIXED_FRAME_RULES = {
    "word_substitutions": [
        # Combine perspectives
        {"from": "is", "to": "is both objectively and subjectively"},
        {"from": "exists", "to": "exists as phenomenon and experience"},
    ],

    "phrase_removal": [],

    "sentence_patterns": [
        {
            "type": "add_framing",
            "prefix": "From multiple perspectives,",
        },
    ],
}


# ============================================================================
# Rule Registry
# ============================================================================

RULE_REGISTRY: Dict[str, Dict[str, Dict]] = {
    "tone": {
        "analytical": TONE_ANALYTICAL_RULES,
        "empathic": TONE_EMPATHIC_RULES,
        "critical": TONE_CRITICAL_RULES,
        # Phase 2B+: playful, neutral
    },
    "tetralemma": {
        "A": TETRALEMMA_A_RULES,
        "¬A": TETRALEMMA_NOT_A_RULES,
        "both": TETRALEMMA_BOTH_RULES,
        "neither": TETRALEMMA_NEITHER_RULES,
    },
    "ontology": {
        "corporeal": ONTOLOGY_CORPOREAL_RULES,
        "subjective": ONTOLOGY_SUBJECTIVE_RULES,
        "objective": ONTOLOGY_OBJECTIVE_RULES,
        "mixed_frame": ONTOLOGY_MIXED_FRAME_RULES,
    },
    # Future packs:
    # "pragmatics": {...},
    # "audience": {...},
}


def get_rules_for_axis(
    povm_pack_name: str,
    target_axis: str
) -> Optional[Dict]:
    """
    Get transformation rules for a specific POVM axis.

    Args:
        povm_pack_name: POVM pack name (e.g., "tone")
        target_axis: Target axis name (e.g., "analytical")

    Returns:
        Dictionary of rules, or None if not found
    """
    if povm_pack_name not in RULE_REGISTRY:
        logger.warning(f"No rules for POVM pack: {povm_pack_name}")
        return None

    pack_rules = RULE_REGISTRY[povm_pack_name]

    if target_axis not in pack_rules:
        logger.warning(f"No rules for axis {target_axis} in pack {povm_pack_name}")
        return None

    return pack_rules[target_axis]


def list_available_rules() -> Dict[str, List[str]]:
    """
    List all available rule sets.

    Returns:
        Dictionary mapping pack names to available axes
    """
    return {
        pack_name: list(axes.keys())
        for pack_name, axes in RULE_REGISTRY.items()
    }


# ============================================================================
# Rule Quality Assessment
# ============================================================================

def assess_rule_coverage(text: str, povm_pack_name: str, target_axis: str) -> Dict:
    """
    Assess how many rules would match a given text.

    Useful for predicting rule-based strategy effectiveness.

    Args:
        text: Input text
        povm_pack_name: POVM pack name
        target_axis: Target axis

    Returns:
        Dictionary with coverage stats
    """
    rules = get_rules_for_axis(povm_pack_name, target_axis)

    if not rules:
        return {
            "has_rules": False,
            "word_sub_matches": 0,
            "phrase_removal_matches": 0,
            "pattern_matches": 0,
            "total_matches": 0,
        }

    word_sub_matches = 0
    phrase_removal_matches = 0
    pattern_matches = 0

    # Check word substitutions
    if "word_substitutions" in rules:
        for sub in rules["word_substitutions"]:
            pattern = r'\b' + re.escape(sub["from"]) + r'\b'
            if re.search(pattern, text, flags=re.IGNORECASE):
                word_sub_matches += 1

    # Check phrase removals
    if "phrase_removal" in rules:
        for removal in rules["phrase_removal"]:
            if re.search(removal["pattern"], text, flags=re.IGNORECASE):
                phrase_removal_matches += 1

    # Check sentence patterns (simplified)
    if "sentence_patterns" in rules:
        pattern_matches = len(rules["sentence_patterns"])

    total = word_sub_matches + phrase_removal_matches + pattern_matches

    return {
        "has_rules": True,
        "word_sub_matches": word_sub_matches,
        "phrase_removal_matches": phrase_removal_matches,
        "pattern_matches": pattern_matches,
        "total_matches": total,
    }


# ============================================================================
# Testing Utilities
# ============================================================================

def sample_rule_application(
    text: str,
    povm_pack_name: str,
    target_axis: str
) -> Dict:
    """
    Apply rules to sample text (for development/testing).

    Args:
        text: Sample text
        povm_pack_name: POVM pack
        target_axis: Target axis

    Returns:
        Dictionary with before/after and rules applied
    """
    rules = get_rules_for_axis(povm_pack_name, target_axis)

    if not rules:
        return {
            "success": False,
            "error": f"No rules for {povm_pack_name}/{target_axis}",
        }

    result = {"success": True, "before": text, "steps": []}

    # Apply each rule type
    current_text = text

    if "word_substitutions" in rules:
        new_text, applied = apply_word_substitutions(current_text, rules["word_substitutions"])
        result["steps"].append({
            "type": "word_substitutions",
            "applied": applied,
            "text": new_text,
        })
        current_text = new_text

    if "phrase_removal" in rules:
        new_text, applied = apply_phrase_removal(current_text, rules["phrase_removal"])
        result["steps"].append({
            "type": "phrase_removal",
            "applied": applied,
            "text": new_text,
        })
        current_text = new_text

    if "sentence_patterns" in rules:
        new_text, applied = apply_sentence_patterns(current_text, rules["sentence_patterns"])
        result["steps"].append({
            "type": "sentence_patterns",
            "applied": applied,
            "text": new_text,
        })
        current_text = new_text

    result["after"] = current_text
    result["changed"] = (text != current_text)

    return result


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    # List available rules
    print("Available rule sets:")
    for pack, axes in list_available_rules().items():
        print(f"  {pack}: {', '.join(axes)}")

    # Test analytical rules
    sample = "I think the data shows that we might get some interesting results."
    print(f"\nSample text: '{sample}'")

    result = sample_rule_application(sample, "tone", "analytical")
    print(f"After analytical transformation: '{result['after']}'")
    print(f"Rules applied: {sum(len(step['applied']) for step in result['steps'])}")

    # Test coverage
    coverage = assess_rule_coverage(sample, "tone", "analytical")
    print(f"\nRule coverage: {coverage}")
