# Transformation Parameter Analysis

## Problem Statement

**Current Issue**: The transformation system ignores the semantic meaning of POVM axes. When user sets:
- POVM Pack: tetralemma
- Target Stance: A=0.70, ¬A=0.10, both=0.10, neither=0.10

The LLM sees "INCREASE: A" but doesn't know what "A" means linguistically.

---

## POVM Semantic Mappings

### 1. Tetralemma (Buddhist Logic)

| Axis | Meaning | Linguistic Transformation |
|------|---------|---------------------------|
| **A** | Statement is true | **Be definite**: Remove hedging, use strong verbs ("is" not "might be"), assert confidently |
| **¬A** | Statement is false | **Be critical**: Question claims, use negative constructions, express skepticism |
| **both** | True AND false (paradox) | **Embrace contradiction**: Use "both...and", acknowledge complexity, show tensions |
| **neither** | Neither true nor false | **Be transcendent**: Use abstract language, avoid binary claims, philosophical tone |

**Example Transformations:**

```
Original: "It could be argued that consciousness is fundamental"

A (0.7): "Consciousness is fundamental"
¬A (0.7): "Consciousness isn't fundamental - it emerges from physics"
both (0.7): "Consciousness is both fundamental and emergent - a paradox"
neither (0.7): "The question of consciousness transcends fundamental/emergent distinctions"
```

---

### 2. Tone

| Axis | Meaning | Linguistic Transformation |
|------|---------|---------------------------|
| **analytical** | Logical, systematic, precise | Use technical terms, break into steps, systematic structure |
| **critical** | Questioning, skeptical | Challenge assumptions, ask questions, point out problems |
| **empathic** | Understanding, compassionate | Use "you/we", acknowledge feelings, relational language |
| **playful** | Creative, exploratory | Metaphors, casual tone, experiment with ideas |
| **neutral** | Balanced, objective | Third-person, passive voice, balanced presentation |

---

### 3. Ontology

| Axis | Meaning | Linguistic Transformation |
|------|---------|---------------------------|
| **corporeal** | Physical, embodied, material | Sensory language, physical descriptions, body-focused |
| **subjective** | Personal, experiential | First-person, "I feel/think", personal anecdotes |
| **objective** | External, observer-independent | Third-person, measurable facts, no personal pronouns |
| **mixed_frame** | Multiple perspectives | Switch between viewpoints, acknowledge frames |

---

### 4. Pragmatics

| Axis | Meaning | Linguistic Transformation |
|------|---------|---------------------------|
| **clarity** | Clear, unambiguous | Simple words, short sentences, explicit structure |
| **coherence** | Logically consistent | Smooth transitions, logical flow, clear connections |
| **evidence** | Well-supported, grounded | Citations, data, examples, "studies show" |
| **charity** | Generous interpretation | "To be fair...", steelman arguments, acknowledge strengths |

---

### 5. Audience

| Axis | Meaning | Linguistic Transformation |
|------|---------|---------------------------|
| **expert** | Specialists | Technical jargon, assume background, dense |
| **general** | Educated public | Accessible language, explain terms, examples |
| **student** | Pedagogical | Step-by-step, definitions, learning-focused |
| **policy** | Decision-makers | Action-oriented, implications, recommendations |
| **editorial** | Opinion, persuasive | Strong voice, arguments, call to action |

---

## Current Parameter Interpretation

### What We're Receiving:
```javascript
{
  mode: "personifier",           // Remove AI patterns
  method: "trm",                  // Iterative refinement
  povm_pack: "tetralemma",        // Buddhist logic framework
  max_iterations: 5,              // Up to 5 refinements
  target_stance: {
    A: 0.70,                      // 70% definite/assertive
    "¬A": 0.10,                   // 10% critical/skeptical
    both: 0.10,                   // 10% paradoxical
    neither: 0.10                 // 10% transcendent
  }
}
```

### What We're Currently Doing:
```python
# transformation.py:270-286
deltas = {axis: target - current for axis, target in target_stance.items()}
increase = [k for k, v in deltas.items() if v > 0.05]
decrease = [k for k, v in deltas.items() if v < -0.05]

directive_text = f"INCREASE: {', '.join(increase)} | DECREASE: {', '.join(decrease)}"
# Output: "INCREASE: A | DECREASE: ¬A"
```

**Problem**: LLM sees "INCREASE: A" with NO context about what "A" means!

---

## Solution: Context-Aware Prompt Generation

### New Approach:

```python
def generate_contextualized_directive(
    povm_pack_name: str,
    target_stance: Dict[str, float],
    current_readings: Dict[str, float]
) -> str:
    """
    Convert POVM stance to concrete linguistic instructions.

    Returns detailed transformation guidance based on semantic meaning.
    """

    # Map POVM axes to linguistic transformations
    AXIS_MEANINGS = {
        "tetralemma": {
            "A": "Be more definite and assertive (remove hedging, use strong verbs)",
            "¬A": "Be more critical and skeptical (question claims, express doubt)",
            "both": "Embrace paradox and complexity (use 'both...and', show tensions)",
            "neither": "Be more transcendent (avoid binaries, use abstract language)"
        },
        "tone": {
            "analytical": "Be more analytical (logical, systematic, precise terminology)",
            "critical": "Be more critical (questioning, skeptical, challenge assumptions)",
            "empathic": "Be more empathic (understanding, use 'you/we', relational)",
            "playful": "Be more playful (creative, metaphors, casual tone)",
            "neutral": "Be more neutral (balanced, objective, third-person)"
        },
        # ... other packs
    }

    meanings = AXIS_MEANINGS.get(povm_pack_name, {})

    directives = []
    for axis, target in target_stance.items():
        current = current_readings.get(axis, 0)
        delta = target - current

        if abs(delta) > 0.05:  # Significant change needed
            meaning = meanings.get(axis, f"adjust {axis}")
            directives.append(f"- {meaning} (shift by {delta:+.2f})")

    return "\n".join(directives)
```

### Expected Output:

Instead of:
```
INCREASE: A | DECREASE: ¬A
```

Generate:
```
Transformation Directions:
- Be more definite and assertive (shift by +0.35)
  → Remove hedging phrases like "it could be", "might", "possibly"
  → Use strong verbs: "is" not "seems to be"
  → State claims directly without qualification

- Be less critical and skeptical (shift by -0.25)
  → Reduce questioning language
  → Remove "however", "but", skeptical framing
  → Present ideas more affirmatively
```

---

## Test Cases Needed

### Test 1: Tetralemma A=0.7 (Definite)
**Input**: "It could be argued that phenomenology marks a pivotal shift"
**Expected**: "Phenomenology marks a pivotal shift"
**Measures**: Remove hedging, direct assertion

### Test 2: Tone analytical=0.8
**Input**: "Husserl wanted to study consciousness"
**Expected**: "Husserl sought to systematically investigate the phenomenological structures of consciousness"
**Measures**: Technical terminology, systematic approach

### Test 3: Audience general=0.8
**Input**: "Transcendental phenomenology elucidates the eidetic structures"
**Expected**: "Transcendental phenomenology helps us understand the essential patterns"
**Measures**: Accessible language, explain terms

### Test 4: Pragmatics clarity=0.8
**Input**: "One might consider that, in light of various theoretical considerations, phenomenology could potentially be seen as..."
**Expected**: "Phenomenology is a method for studying consciousness"
**Measures**: Short sentences, simple words

### Test 5: Combined (Personifier + tetralemma A=0.7)
**Input**: "It's worth noting that Husserl's phenomenology may have influenced..."
**Expected**: "Husserl's phenomenology influenced..."
**Measures**: Remove AI hedging + be more definite

---

## Implementation Priority

1. **Immediate** (30min): Add AXIS_MEANINGS mapping to transformation.py
2. **High** (1h): Create `generate_contextualized_directive()` function
3. **High** (1h): Write 10 test cases covering all POVM packs
4. **Medium** (2h): Run tests, measure success rate (target: 4.5/5 average)
5. **Medium** (2h): Add tier-based limits and chunking

---

## Success Criteria

A 5/5 transformation must:
1. ✅ Correctly interpret ALL parameters (mode, method, POVM, stance)
2. ✅ Apply linguistic changes matching semantic axes
3. ✅ Transform complete text (no truncation)
4. ✅ Remove AI patterns (no added hedging)
5. ✅ Match target stance (measurable via POVM)

**Current**: 2/5 (ignores semantic meaning, adds wrong patterns)
**Target**: 5/5 (interprets all parameters, applies correctly)
