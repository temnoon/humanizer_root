# Personifier & Custom POVM Implementation Plan

**Date**: October 11, 2025, ~8:15 PM
**Goal**: Add formal transformation testing, custom POVM generation, and Personifier engine
**Based on**: `~/humanizer-agent/docs/PERSONIFIER_GUIDE.md` and `CONTEXT_SPECIFIC_POVMS.md`

---

## 🎯 Three Major Features

### 1. Formal Transformation Testing Suite
Test same text with variety of transformations systematically.

### 2. Custom POVM Generation from Narrative
Generate context-specific measurement axes from any text.

### 3. Personifier Transformation Engine
Transform AI-written text to conversational register.

---

## 📊 Current State

### What We Have
- ✅ TRM iterative transformation (working)
- ✅ 5 universal POVM packs (tetralemma, tone, ontology, pragmatics, audience)
- ✅ Ollama integration (mistral:7b)
- ✅ Transform API endpoints (`/api/transform/*`)
- ✅ Frontend tool panels (Transform, Analyze, Extract, Compare)
- ✅ Embedding service (sentence-transformers)

### What We Need
- ❌ Transformation test suite
- ❌ Custom POVM generation endpoint
- ❌ Personifier service with trained vectors
- ❌ Training data (396 curated pairs from humanizer-agent)
- ❌ Personify endpoints (`/api/personify`, `/api/personify/rewrite`)

---

## 🏗️ Architecture Overview

```
humanizer/
├── ml/
│   ├── density.py              # Existing
│   ├── povm.py                 # Existing (need to enhance)
│   ├── povm_generator.py       # NEW - Generate custom POVMs
│   └── personify.py            # NEW - Personifier engine
├── services/
│   ├── transformation.py       # Existing
│   ├── personifier.py          # NEW - Personification service
│   └── povm_generation.py      # NEW - Custom POVM service
├── api/
│   ├── transform.py            # Existing
│   ├── tools.py                # Existing
│   ├── personify.py            # NEW - Personifier endpoints
│   └── custom_povm.py          # NEW - POVM generation endpoints
├── data/
│   ├── curated_style_pairs.jsonl          # NEW - 396 training pairs
│   ├── personify_vector_ollama.json       # NEW - Transformation vector
│   └── training_embeddings.json           # NEW - Embeddings cache
└── tests/
    ├── test_transformations.py            # NEW - Formal test suite
    ├── test_personifier.py                # NEW - Personifier tests
    └── test_custom_povms.py               # NEW - POVM generation tests
```

---

## 🔬 Feature 1: Formal Transformation Testing

### Goal
Test same input text with multiple transformation configurations:
- Different target stances
- Different POVM packs
- Different iteration counts
- Different strength parameters

### Test Suite Structure

```python
# tests/test_transformations.py

import pytest
from humanizer.services.transformation import TransformationService

@pytest.fixture
def test_texts():
    """Standard test texts for transformation."""
    return {
        "formal": "It's worth noting that this approach can be beneficial in many cases. You might want to consider the following factors.",
        "technical": "The system implements a RESTful API architecture. It should be noted that proper authentication is required.",
        "narrative": "The protagonist stood at the crossroads, uncertain which path to take.",
        "mathematical": "Let p_i denote the probability of outcome i. The sum ∑p_i must equal one.",
    }

@pytest.fixture
def target_stances():
    """Standard target stances for testing."""
    return {
        "analytical_high": {"analytical": 0.8, "critical": 0.1, "empathic": 0.05, "playful": 0.03, "neutral": 0.02},
        "empathic_high": {"empathic": 0.7, "analytical": 0.15, "playful": 0.1, "critical": 0.03, "neutral": 0.02},
        "playful_high": {"playful": 0.6, "empathic": 0.2, "analytical": 0.15, "critical": 0.03, "neutral": 0.02},
        "balanced": {"analytical": 0.2, "critical": 0.2, "empathic": 0.2, "playful": 0.2, "neutral": 0.2},
    }

class TestTransformationSystematic:
    """Systematic transformation testing."""

    async def test_same_text_multiple_targets(self, test_texts, target_stances):
        """Test: Same text → Different targets → Measure quality."""
        service = TransformationService()
        text = test_texts["formal"]

        results = {}
        for stance_name, target_stance in target_stances.items():
            result = await service.transform_trm_iterative(
                text=text,
                povm_pack="tone",
                target_stance=target_stance,
                max_iterations=5
            )
            results[stance_name] = result

        # Verify each transformation achieved target
        for stance_name, result in results.items():
            assert result["success"], f"Failed for {stance_name}"
            assert result["iterations"] <= 5, f"Too many iterations for {stance_name}"

            # Check final readings approach target
            final_readings = result["final_readings"]
            target = target_stances[stance_name]

            for axis, target_prob in target.items():
                actual_prob = final_readings.get(axis, 0)
                drift = abs(actual_prob - target_prob)
                assert drift < 0.3, f"{stance_name}: {axis} drift={drift} too high"

    async def test_convergence_consistency(self, test_texts):
        """Test: Same input + target → Consistent convergence."""
        service = TransformationService()
        text = test_texts["formal"]
        target_stance = {"analytical": 0.8, "critical": 0.1, "empathic": 0.05, "playful": 0.03, "neutral": 0.02}

        # Run transformation 5 times
        iterations_list = []
        final_drifts = []

        for i in range(5):
            result = await service.transform_trm_iterative(
                text=text,
                povm_pack="tone",
                target_stance=target_stance,
                max_iterations=10
            )
            iterations_list.append(result["iterations"])
            final_drifts.append(result["final_drift"])

        # Check consistency
        avg_iterations = sum(iterations_list) / len(iterations_list)
        std_iterations = (sum((x - avg_iterations)**2 for x in iterations_list) / len(iterations_list))**0.5

        assert std_iterations < 2.0, f"Iteration count varies too much: std={std_iterations}"
        assert all(d < 0.2 for d in final_drifts), f"Some runs failed to converge: {final_drifts}"

    async def test_latex_preservation(self, test_texts):
        """Test: LaTeX preserved through transformation."""
        service = TransformationService()
        text = test_texts["mathematical"]
        target_stance = {"analytical": 0.9, "empathic": 0.05, "playful": 0.03, "critical": 0.02, "neutral": 0.0}

        result = await service.transform_trm_iterative(
            text=text,
            povm_pack="tone",
            target_stance=target_stance,
            max_iterations=3
        )

        transformed = result["transformed_text"]

        # Check LaTeX preserved
        assert "p_i" in transformed or "$p_" in transformed, "LaTeX subscripts lost"
        assert "∑" in transformed or "\\sum" in transformed, "Math symbols lost"

    async def test_strength_parameter(self, test_texts):
        """Test: Different strengths → Different transformation intensities."""
        service = TransformationService()
        text = test_texts["formal"]
        target_stance = {"playful": 0.7, "analytical": 0.15, "empathic": 0.1, "critical": 0.03, "neutral": 0.02}

        results = {}
        for strength in [0.5, 1.0, 1.5, 2.0]:
            # Note: strength would need to be added to transform_trm_iterative
            result = await service.transform_trm_iterative(
                text=text,
                povm_pack="tone",
                target_stance=target_stance,
                max_iterations=3,
                # strength=strength  # TODO: Add this parameter
            )
            results[strength] = result

        # Verify higher strength = more dramatic changes
        # (Would need word count difference or similarity metric)
        pass  # TODO: Implement metrics

class TestTransformationComparison:
    """Compare TRM vs LLM baseline."""

    async def test_trm_vs_llm_quality(self, test_texts):
        """Test: TRM vs LLM → Which converges better?"""
        service = TransformationService()
        text = test_texts["formal"]
        target_stance = {"analytical": 0.8, "critical": 0.1, "empathic": 0.05, "playful": 0.03, "neutral": 0.02}

        # TRM method
        trm_result = await service.transform_trm_iterative(
            text=text,
            povm_pack="tone",
            target_stance=target_stance,
            max_iterations=5
        )

        # LLM baseline
        llm_result = await service.transform_llm_baseline(
            text=text,
            target_stance=target_stance,
            povm_pack="tone"
        )

        # Compare drift
        trm_drift = trm_result["final_drift"]
        llm_drift = llm_result["drift"]

        print(f"TRM drift: {trm_drift:.4f}, LLM drift: {llm_drift:.4f}")

        # TRM should generally be closer (has iterative refinement)
        # But not guaranteed in all cases
```

### Test Report Format

```json
{
  "test_run_id": "20251011_201500",
  "test_date": "2025-10-11T20:15:00Z",
  "test_suite": "formal_transformation_testing",
  "results": {
    "same_text_multiple_targets": {
      "passed": true,
      "transformations": [
        {
          "target": "analytical_high",
          "success": true,
          "iterations": 3,
          "final_drift": 0.12,
          "duration_ms": 8500
        },
        {
          "target": "empathic_high",
          "success": true,
          "iterations": 4,
          "final_drift": 0.15,
          "duration_ms": 11200
        }
      ]
    },
    "convergence_consistency": {
      "passed": true,
      "runs": 5,
      "avg_iterations": 3.2,
      "std_iterations": 0.8,
      "avg_final_drift": 0.11
    },
    "latex_preservation": {
      "passed": true,
      "latex_elements_preserved": ["p_i", "∑", "subscripts"]
    }
  },
  "summary": {
    "total_tests": 10,
    "passed": 9,
    "failed": 1,
    "pass_rate": 0.9
  }
}
```

---

## 🎨 Feature 2: Custom POVM Generation

### Goal
Generate context-specific POVM axes from any narrative using LLM analysis.

### API Design

**Endpoint**: `POST /api/custom-povm/generate`

**Request**:
```json
{
  "text": "Long text sample (500+ words recommended)",
  "reader_purpose": "Understanding philosophical tensions",
  "max_axes": 4,
  "min_confidence": 0.7
}
```

**Response**:
```json
{
  "proposed_axes": [
    {
      "name": "Obsession ↔ Acceptance",
      "pole_a": "Obsession",
      "pole_b": "Acceptance",
      "description": "Ahab's pursuit vs Starbuck's plea to move on",
      "centrality_explanation": "Core narrative tension throughout novel",
      "example_passages": [
        "Ahab: 'He tasks me; he heaps me...'",
        "Starbuck: 'Let us fly these deadly waters...'"
      ],
      "madhyamaka_validation": {
        "no_privileged_pole": true,
        "poles_explanation": "Neither obsession nor acceptance privileged",
        "mutual_dependence": true,
        "both_corner_coherent": true,
        "both_explanation": "Can accept fate while remaining engaged",
        "neither_corner_coherent": true,
        "neither_explanation": "Whale transcends human categories"
      },
      "confidence": 0.95
    }
  ],
  "universal_axes_still_relevant": [
    "Literal ↔ Metaphorical",
    "Surface ↔ Depth"
  ],
  "recommended_measurement_order": [
    "Obsession ↔ Acceptance",
    "Vengeance ↔ Forgiveness",
    "Literal ↔ Metaphorical"
  ]
}
```

### Implementation

```python
# humanizer/services/povm_generation.py

from typing import List, Dict, Optional
from pydantic import BaseModel
import httpx

class CustomPOVMAxis(BaseModel):
    """Proposed custom POVM axis."""
    name: str
    pole_a: str
    pole_b: str
    description: str
    centrality_explanation: str
    example_passages: List[str]
    madhyamaka_validation: Dict
    confidence: float

class POVMGenerationService:
    """Generate custom POVM axes from narrative content."""

    def __init__(self, ollama_url: str = "http://localhost:11434"):
        self.ollama_url = ollama_url

    async def generate_custom_axes(
        self,
        text: str,
        reader_purpose: Optional[str] = None,
        max_axes: int = 4,
        min_confidence: float = 0.7
    ) -> List[CustomPOVMAxis]:
        """
        Generate context-specific POVM axes from text.

        Process:
        1. Sample text (first/middle/last if long)
        2. Send to LLM with dialectical analysis prompt
        3. Parse proposed axes
        4. Validate each axis (Madhyamaka criteria)
        5. Return approved axes
        """

        # Step 1: Sample text
        text_sample = self._sample_text(text, target_words=2000)

        # Step 2: LLM analysis
        prompt = self._build_generation_prompt(text_sample, reader_purpose, max_axes)
        llm_response = await self._call_ollama(prompt)

        # Step 3: Parse response
        proposed_axes = self._parse_llm_response(llm_response)

        # Step 4: Validate
        validated_axes = []
        for axis in proposed_axes:
            if axis.confidence >= min_confidence:
                if self._validate_madhyamaka_criteria(axis):
                    validated_axes.append(axis)

        return validated_axes

    def _build_generation_prompt(
        self,
        text_sample: str,
        reader_purpose: Optional[str],
        max_axes: int
    ) -> str:
        """Build LLM prompt for axis generation."""

        universal_axes = [
            "Literal ↔ Metaphorical",
            "Surface ↔ Depth",
            "Subjective ↔ Objective",
            "Coherent ↔ Surprising",
            "Emotional ↔ Analytical",
            "Specific ↔ Universal"
        ]

        prompt = f"""You are analyzing a text to identify its core dialectical tensions.

TEXT SAMPLE:
{text_sample}

READER'S PURPOSE: {reader_purpose or "General understanding"}

TASK:
Identify {max_axes} dialectical axes that are CENTRAL to this text. These should be:

1. Actually dialectical (poles that mutually define each other)
2. Central to the text's meaning (not peripheral)
3. Not already covered by universal axes: {', '.join(universal_axes)}

For each proposed axis:
- Name both poles clearly (format: "Pole A ↔ Pole B")
- Explain why this dialectic is central to the text
- Provide 2-3 example passages that engage this tension
- Verify it passes Madhyamaka criteria:
  * No privileged pole (neither is inherently better)
  * Mutual dependence (poles define each other)
  * BOTH corner coherent (can embody both simultaneously)
  * NEITHER corner meaningful (transcendence possible)

OUTPUT:
Return JSON with this structure:
{{
  "proposed_axes": [
    {{
      "name": "Pole A ↔ Pole B",
      "pole_a": "Pole A",
      "pole_b": "Pole B",
      "description": "Brief description",
      "centrality_explanation": "Why this is central to the text",
      "example_passages": ["passage 1", "passage 2"],
      "madhyamaka_validation": {{
        "no_privileged_pole": true/false,
        "poles_explanation": "Explanation",
        "mutual_dependence": true/false,
        "dependence_explanation": "Explanation",
        "both_corner_coherent": true/false,
        "both_explanation": "Example of BOTH",
        "neither_corner_coherent": true/false,
        "neither_explanation": "Example of NEITHER"
      }},
      "confidence": 0.0-1.0
    }}
  ]
}}"""

        return prompt

    def _validate_madhyamaka_criteria(self, axis: CustomPOVMAxis) -> bool:
        """Validate axis meets Madhyamaka criteria."""
        validation = axis.madhyamaka_validation

        required_checks = [
            validation.get("no_privileged_pole", False),
            validation.get("mutual_dependence", False),
            validation.get("both_corner_coherent", False),
        ]

        # NEITHER corner is preferred but not required
        # (some valid axes may not have strong transcendence)

        return all(required_checks)

    async def _call_ollama(self, prompt: str) -> str:
        """Call Ollama API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "mistral:7b",
                    "prompt": prompt,
                    "stream": False
                }
            )
            return response.json()["response"]
```

### Frontend Integration

```typescript
// frontend/src/components/tools/CustomPOVMPanel.tsx

interface CustomPOVMPanelProps {
  selectedText?: string;
}

export function CustomPOVMPanel({ selectedText }: CustomPOVMPanelProps) {
  const [text, setText] = useState(selectedText || '');
  const [readerPurpose, setReaderPurpose] = useState('');
  const [generating, setGenerating] = useState(false);
  const [proposedAxes, setProposedAxes] = useState<CustomAxis[]>([]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/custom-povm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          reader_purpose: readerPurpose,
          max_axes: 4,
          min_confidence: 0.7
        })
      });

      const data = await response.json();
      setProposedAxes(data.proposed_axes);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="custom-povm-panel">
      <h3>Generate Custom POVM Axes</h3>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text to analyze (500+ words recommended)"
        rows={10}
      />

      <input
        type="text"
        value={readerPurpose}
        onChange={(e) => setReaderPurpose(e.target.value)}
        placeholder="Reading purpose (optional)"
      />

      <button onClick={handleGenerate} disabled={generating || !text}>
        {generating ? 'Analyzing...' : 'Generate Axes'}
      </button>

      {proposedAxes.length > 0 && (
        <div className="proposed-axes">
          <h4>Proposed Axes</h4>
          {proposedAxes.map((axis, i) => (
            <div key={i} className="axis-card">
              <h5>{axis.name}</h5>
              <p className="confidence">Confidence: {(axis.confidence * 100).toFixed(0)}%</p>
              <p>{axis.description}</p>
              <details>
                <summary>Why this axis?</summary>
                <p>{axis.centrality_explanation}</p>
              </details>
              <details>
                <summary>Example passages</summary>
                <ul>
                  {axis.example_passages.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ul>
              </details>
              <button onClick={() => handleApplyAxis(axis)}>
                Apply this axis
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 🤖 Feature 3: Personifier Transformation Engine

### Goal
Transform AI-written text to conversational register using embedding arithmetic.

### Architecture

```
User submits formal/AI text
  ↓
Pattern Detection (identify AI markers: hedging, passive voice, etc.)
  ↓
Generate embedding (1024-dim via Ollama mxbai-embed-large)
  ↓
Apply personify vector (learned from 396 training pairs)
  ↓
[MODE 1] Find similar conversational examples
  OR
[MODE 2] LLM rewriting guided by examples
  ↓
Return: analysis + suggestions OR actual rewritten text
```

### Data Migration

**From humanizer-agent**:
```bash
# Copy training data
cp ~/humanizer-agent/backend/data/curated_style_pairs.jsonl \
   ~/humanizer_root/humanizer/data/

# Copy transformation vector
cp ~/humanizer-agent/backend/data/personify_vector_curated_ollama.json \
   ~/humanizer_root/humanizer/data/
```

### Implementation

```python
# humanizer/services/personifier.py

import json
import numpy as np
from typing import Dict, List, Optional
from pydantic import BaseModel
import httpx

class AIPatterns(BaseModel):
    """Detected AI writing patterns."""
    hedging: int = 0
    formal_transitions: int = 0
    passive_voice: int = 0
    list_markers: int = 0
    numbered_lists: int = 0
    bullet_points: int = 0

    @property
    def total_score(self) -> float:
        return (
            self.hedging * 1.5 +
            self.formal_transitions * 1.0 +
            self.passive_voice * 1.2 +
            self.list_markers * 0.8 +
            self.numbered_lists * 1.0 +
            self.bullet_points * 0.5
        )

    @property
    def confidence(self) -> float:
        """Confidence that text is AI-written (0-100)."""
        return min(100, self.total_score * 10)

class PersonifierService:
    """Transform AI writing to conversational register."""

    def __init__(
        self,
        data_dir: str = "humanizer/data",
        ollama_url: str = "http://localhost:11434"
    ):
        self.data_dir = data_dir
        self.ollama_url = ollama_url

        # Load transformation vector
        with open(f"{data_dir}/personify_vector_curated_ollama.json") as f:
            self.personify_vector = np.array(json.load(f)["vector"])

    async def analyze(
        self,
        text: str,
        return_similar: bool = True,
        n_similar: int = 5
    ) -> Dict:
        """
        Analyze AI patterns and suggest transformations.

        Mode 1: Analysis only (no rewriting).
        Returns suggestions + similar conversational examples.
        """

        # Detect AI patterns
        patterns = self._detect_patterns(text)

        # Generate embedding
        embedding = await self._generate_embedding(text)

        # Apply transformation vector
        transformed_embedding = embedding + self.personify_vector

        # Find similar conversational chunks
        similar_chunks = []
        if return_similar:
            similar_chunks = await self._find_similar_chunks(
                transformed_embedding,
                n=n_similar
            )

        # Generate suggestions
        suggestions = self._generate_suggestions(patterns)

        return {
            "original_text": text,
            "ai_patterns": {
                "patterns": patterns.dict(),
                "total_score": patterns.total_score,
                "confidence": patterns.confidence,
                "is_ai_likely": patterns.confidence > 30
            },
            "similar_chunks": similar_chunks,
            "suggestions": suggestions
        }

    async def rewrite(
        self,
        text: str,
        strength: float = 1.0,
        use_examples: bool = True,
        n_examples: int = 3
    ) -> Dict:
        """
        Rewrite text to conversational register.

        Mode 2: Actual rewriting using LLM.
        Returns transformed text + analysis.
        """

        # First analyze
        analysis = await self.analyze(text, return_similar=use_examples, n_similar=n_examples)

        # Build LLM prompt
        prompt = self._build_rewrite_prompt(
            text=text,
            patterns=analysis["ai_patterns"],
            examples=analysis["similar_chunks"] if use_examples else [],
            strength=strength
        )

        # Call LLM
        rewritten_text = await self._call_ollama_for_rewrite(prompt)

        return {
            "original_text": text,
            "rewritten_text": rewritten_text,
            "ai_patterns": analysis["ai_patterns"],
            "similar_examples": analysis["similar_chunks"],
            "suggestions": analysis["suggestions"],
            "transformation_info": {
                "method": "llm_rewriting",
                "strength": strength,
                "used_examples": use_examples,
                "num_examples": n_examples
            }
        }

    def _detect_patterns(self, text: str) -> AIPatterns:
        """Detect AI writing patterns using regex."""
        import re

        patterns = AIPatterns()

        # Hedging phrases
        hedging_phrases = [
            r"it'?s worth noting",
            r"you might want to",
            r"it should be noted",
            r"it is important to note",
            r"consider the following",
            r"it may be beneficial"
        ]
        for phrase in hedging_phrases:
            patterns.hedging += len(re.findall(phrase, text, re.IGNORECASE))

        # Formal transitions
        formal_transitions = [
            r"\bfurthermore\b",
            r"\bmoreover\b",
            r"\badditionally\b",
            r"\bin addition\b"
        ]
        for transition in formal_transitions:
            patterns.formal_transitions += len(re.findall(transition, text, re.IGNORECASE))

        # Passive voice markers
        passive_markers = [
            r"can be done",
            r"should be noted",
            r"has been shown",
            r"is recommended",
            r"are described"
        ]
        for marker in passive_markers:
            patterns.passive_voice += len(re.findall(marker, text, re.IGNORECASE))

        # List markers
        patterns.list_markers = len(re.findall(r"here are|following are|as follows", text, re.IGNORECASE))

        # Numbered lists
        patterns.numbered_lists = len(re.findall(r"^\d+\.", text, re.MULTILINE))

        # Bullet points
        patterns.bullet_points = len(re.findall(r"^[•\-\*]", text, re.MULTILINE))

        return patterns

    def _generate_suggestions(self, patterns: AIPatterns) -> List[Dict]:
        """Generate transformation suggestions based on patterns."""
        suggestions = []

        if patterns.hedging > 0:
            suggestions.append({
                "type": "remove_hedging",
                "message": "Remove hedging phrases like 'it's worth noting' - be direct",
                "count": patterns.hedging
            })

        if patterns.formal_transitions > 0:
            suggestions.append({
                "type": "casual_transitions",
                "message": "Replace formal transitions (furthermore → also, plus)",
                "count": patterns.formal_transitions
            })

        if patterns.passive_voice > 0:
            suggestions.append({
                "type": "active_voice",
                "message": "Use active voice instead of 'can be done' → 'do it'",
                "count": patterns.passive_voice
            })

        return suggestions

    def _build_rewrite_prompt(
        self,
        text: str,
        patterns: Dict,
        examples: List[Dict],
        strength: float
    ) -> str:
        """Build prompt for LLM rewriting."""

        examples_text = ""
        if examples:
            examples_text = "\n\nSimilar conversational examples:\n"
            for i, ex in enumerate(examples[:3], 1):
                examples_text += f"{i}. {ex['content'][:200]}...\n"

        intensity = "moderate"
        if strength > 1.5:
            intensity = "aggressive"
        elif strength < 0.8:
            intensity = "light"

        prompt = f"""Transform this AI-written text to conversational register.

DETECTED AI PATTERNS:
{json.dumps(patterns, indent=2)}

TRANSFORMATION INTENSITY: {intensity}
{"- Remove most hedging and formal language" if intensity == "aggressive" else ""}
{"- Remove some hedging, keep necessary qualifications" if intensity == "moderate" else ""}
{"- Minimal changes, just remove obvious AI markers" if intensity == "light" else ""}

{examples_text}

INSTRUCTIONS:
1. Remove hedging phrases ("it's worth noting", "you might want to")
2. Replace formal transitions (furthermore → also)
3. Use active voice (can be done → do it)
4. Vary structure (not every response needs numbered lists)
5. Be direct and confident
6. PRESERVE all LaTeX, code, and technical content
7. Maintain meaning and intent

ORIGINAL TEXT:
{text}

CONVERSATIONAL VERSION:"""

        return prompt

    async def _generate_embedding(self, text: str) -> np.ndarray:
        """Generate embedding using Ollama."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/embeddings",
                json={
                    "model": "mxbai-embed-large",
                    "prompt": text
                }
            )
            return np.array(response.json()["embedding"])

    async def _call_ollama_for_rewrite(self, prompt: str) -> str:
        """Call Ollama for text rewriting."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "mistral:7b",
                    "prompt": prompt,
                    "stream": False
                }
            )
            return response.json()["response"]
```

---

## 📝 Implementation Order

### Phase 1: Testing Infrastructure (2 hours)
1. ✅ Create `tests/test_transformations.py`
2. ✅ Implement test fixtures (test texts, target stances)
3. ✅ Write systematic transformation tests
4. ✅ Run test suite and document results

### Phase 2: Custom POVM Generation (3-4 hours)
1. ✅ Create `humanizer/services/povm_generation.py`
2. ✅ Implement LLM prompt for axis generation
3. ✅ Add Madhyamaka validation logic
4. ✅ Create API endpoints (`/api/custom-povm/*`)
5. ✅ Build frontend panel
6. ✅ Test with sample narratives

### Phase 3: Personifier (4-5 hours)
1. ✅ Copy training data from humanizer-agent
2. ✅ Create `humanizer/services/personifier.py`
3. ✅ Implement pattern detection
4. ✅ Implement analysis mode (`/api/personify`)
5. ✅ Implement rewrite mode (`/api/personify/rewrite`)
6. ✅ Add frontend panel
7. ✅ Test with AI-written samples

---

## 🧪 Testing Plan

### Transformation Tests
```bash
cd /Users/tem/humanizer_root
poetry run pytest tests/test_transformations.py -v
```

**Expected outputs**:
- Test report JSON file
- Convergence metrics
- Quality scores
- Performance benchmarks

### Custom POVM Tests
```bash
# Test with Moby Dick sample
curl -X POST http://localhost:8000/api/custom-povm/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "[Moby Dick chapter]", "max_axes": 3}'

# Expected: "Obsession ↔ Acceptance" axis proposed
```

### Personifier Tests
```bash
# Analyze AI text
curl -X POST http://localhost:8000/api/personify \
  -H "Content-Type: application/json" \
  -d '{"text": "It'\''s worth noting that this approach can be beneficial."}'

# Rewrite
curl -X POST http://localhost:8000/api/personify/rewrite \
  -H "Content-Type: application/json" \
  -d '{"text": "It'\''s worth noting that this approach can be beneficial.", "strength": 1.0}'

# Expected: "This approach works well."
```

---

## 📊 Success Criteria

### Transformation Testing
- ✅ Can test same text with 4+ different targets
- ✅ Convergence consistency <2 iterations stddev
- ✅ LaTeX preserved through transformations
- ✅ Test reports generated automatically

### Custom POVM Generation
- ✅ Can generate 2-4 axes from narrative
- ✅ All axes pass Madhyamaka validation
- ✅ Confidence scores >0.7
- ✅ User can approve/reject axes
- ✅ Applied axes work with existing measurement system

### Personifier
- ✅ Detects AI patterns (hedging, formal transitions, etc.)
- ✅ Analysis mode returns suggestions
- ✅ Rewrite mode produces natural conversational text
- ✅ 30%+ word reduction typical
- ✅ Meaning preserved
- ✅ LaTeX/code preserved

---

**Status**: Ready to implement
**Estimated Time**: 9-11 hours total
**Priority**: High (user requested)
**Branch**: dev-TRM

**Next**: Start with Phase 1 (Testing Infrastructure)
