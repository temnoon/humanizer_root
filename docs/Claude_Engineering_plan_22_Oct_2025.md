# SNT Quick Start for Developers

## What You're Building

A **Narrative Transformation Engine** that uses quantum-inspired math to control how AI generates and transforms stories.

## The 30-Second Pitch

We represent the "meaning" of a narrative as a **density matrix** (ρ) in concept space. As you read/generate text:
- The matrix **evolves** (like quantum state evolution)
- We can **measure** it (extract themes/emotions)  
- We can **transform** it (steer the narrative)

This gives us fine-grained control over LLM outputs while maintaining coherence.

---

## Core Problem

**Full density matrices are too big**: For 10,000 concepts, you need 10k × 10k = 100 million numbers.

**Solution**: Use low-rank approximation (store only top-20 eigenvalues + eigenvectors).

---

## System Architecture (3 Components)

```
┌──────────────────┐
│  Control Layer   │ ← User says "make this more hopeful"
└────────┬─────────┘
         ↓
┌──────────────────┐
│  QSSM Module     │ ← Maintains density matrix ρ
│  (Your Code)     │ ← Computes alignment scores
└────────┬─────────┘ ← Outputs logit biases
         ↓
┌──────────────────┐
│  LLM (GPT/etc)   │ ← Generates actual tokens
└──────────────────┘
```

**Your job**: Build the QSSM Module that sits between user requests and the LLM.

---

## Key Data Structure

```python
class NarrativeState:
    """Represents the evolving meaning of a narrative."""
    
    def __init__(self, dim=768, rank=20):
        self.eigenvalues = np.zeros(rank)       # Top eigenvalues
        self.eigenvectors = np.zeros((dim, rank))  # Corresponding vectors
    
    def evolve(self, sentence_embedding):
        """Update state as narrative progresses."""
        # Create rotation in concept space
        # Apply: ρ_new = U @ ρ @ U.conj().T
        
    def measure(self, concept_operator):
        """How much does current state align with this concept?"""
        # Return: Tr(operator @ ρ)
        
    def bias_generation(self, token_embeddings):
        """Which tokens fit the current narrative state?"""
        # Return alignment score for each token
```

---

## Three Operations You Must Implement

### 1. Initialize State (from prompt)

```python
def create_initial_state(prompt_text):
    # Get embedding from sentence encoder
    embedding = encoder.encode(prompt_text)
    
    # Convert to density matrix
    ρ = np.outer(embedding, embedding)
    ρ = ρ / np.trace(ρ)  # Normalize
    
    # Compress to low-rank
    return low_rank_approximate(ρ, rank=20)
```

### 2. Evolve State (as you generate)

```python
def update_state(current_ρ, new_sentence):
    # Get sentence embedding
    v = encoder.encode(new_sentence)
    
    # Create unitary operator (rotation)
    U = construct_rotation(v, angle=0.1)
    
    # Apply quantum evolution
    new_ρ = U @ current_ρ @ U.conj().T
    
    return new_ρ
```

### 3. Steer Generation (transform narrative)

```python
def generate_with_steering(llm, current_ρ, target_concept):
    # Get target concept embedding
    target = encoder.encode(target_concept)
    
    for _ in range(max_tokens):
        # Get LLM's natural next-token probabilities
        logits = llm.get_logits()
        
        # Compute alignment of each token with current state
        token_embeddings = llm.get_token_embeddings()
        alignment = [np.trace(np.outer(emb, emb) @ current_ρ) 
                     for emb in token_embeddings]
        
        # Bias logits toward aligned tokens
        biased_logits = logits + strength * np.array(alignment)
        
        # Sample and update state
        token = sample(biased_logits)
        current_ρ = update_state(current_ρ, token)
```

---

## Essential Functions to Write

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `create_density_matrix()` | Initialize state | text or embedding | ρ (low-rank) |
| `evolve_state()` | Update as text added | ρ, new_text | ρ' |
| `compute_alignment()` | How well does token fit? | token_emb, ρ | float score |
| `construct_operator()` | Make measurement operator | concept_name | matrix M |
| `project_state()` | Transform toward target | ρ, target_operator | ρ' |
| `low_rank_compress()` | Reduce dimensionality | full matrix | eigenvalues, eigenvectors |

---

## Math Cheat Sheet

### Density Matrix Properties
```python
# Must satisfy:
assert np.allclose(ρ, ρ.conj().T)  # Hermitian
assert np.trace(ρ) ≈ 1.0            # Normalized
assert all(eigenvalues >= 0)        # Positive semi-definite
```

### Evolution (Unitary)
```python
# Preserve trace and hermiticity
ρ_new = U @ ρ @ U.conj().T

# Where U is unitary: U @ U.conj().T = I
```

### Measurement (Projection)
```python
# Probability of measuring concept M
p = np.trace(M @ ρ)

# State after measurement
ρ_after = (M @ ρ @ M.conj().T) / p
```

### Low-Rank Approximation
```python
# Keep only top-k eigenvalues
eigenvals, eigenvecs = np.linalg.eigh(ρ)
sorted_indices = np.argsort(eigenvals)[::-1]
ρ_compressed = sum(eigenvals[i] * np.outer(eigenvecs[:, i], eigenvecs[:, i])
                   for i in sorted_indices[:k])
```

---

## Integration Points

### With LLM API
```python
# OpenAI-style
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[...],
    logit_bias={token_id: bias_value}  # ← Your QSSM biases go here
)

# HuggingFace-style
outputs = model.generate(
    input_ids,
    logits_processor=[YourQSSMProcessor()]  # ← Custom processor
)
```

### With Sentence Encoder
```python
from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer('all-MiniLM-L6-v2')
embedding = encoder.encode("Your text here")  # → 384-dim vector
```

---

## Common Pitfalls

❌ **Don't**: Compute full n×n matrices for large n  
✅ **Do**: Always work with low-rank representation

❌ **Don't**: Apply arbitrary matrix transformations  
✅ **Do**: Ensure operators preserve trace and positivity

❌ **Don't**: Directly multiply density matrices (ρ₁ @ ρ₂)  
✅ **Do**: Use unitary evolution (U @ ρ @ U†) or projection (M @ ρ @ M†)

❌ **Don't**: Forget to normalize after operations  
✅ **Do**: Always ensure trace(ρ) = 1.0 after each update

---

## Testing Checklist

```python
def test_density_matrix_properties(ρ):
    assert np.allclose(ρ, ρ.conj().T), "Not Hermitian"
    assert abs(np.trace(ρ) - 1.0) < 1e-6, "Not normalized"
    eigenvals = np.linalg.eigvalsh(ρ)
    assert all(eigenvals >= -1e-6), "Not positive semi-definite"

def test_evolution_preserves_properties(ρ, U):
    ρ_new = U @ ρ @ U.conj().T
    test_density_matrix_properties(ρ_new)

def test_end_to_end_transformation():
    text = "I am sad and lonely"
    target = "hopeful"
    
    ρ = create_initial_state(text)
    transformed = generate_with_steering(llm, ρ, target)
    
    # Check if output is more aligned with "hopeful"
    score_before = measure_concept(ρ, target)
    score_after = measure_concept(final_ρ, target)
    assert score_after > score_before
```

---

## MVP Scope (Start Here)

**Week 1**: Core matrix operations
- Create/compress density matrices
- Implement evolution and measurement
- Unit tests for quantum properties

**Week 2**: LLM integration
- Extract embeddings from LLM
- Compute alignment scores
- Implement logit bias injection

**Week 3**: Control interface  
- Parse user transformation requests
- Map concepts to operators
- Build basic API

**Week 4**: Testing & refinement
- End-to-end tests
- Performance optimization
- Example demonstrations

---

## Example Use Cases

```python
# Use Case 1: Emotional transformation
input_text = "The day was grey and meaningless."
transform(input_text, target_emotion="hopeful")
# → "Though the sky was overcast, new possibilities stirred."

# Use Case 2: Theme steering
story_start = "The warrior drew his sword..."
continue_story(story_start, target_theme="redemption", length=500)
# → Story continues with redemption arc

# Use Case 3: Style transfer
formal_text = "One must consider the implications..."
transform(formal_text, target_style="casual")
# → "So like, we should probably think about what this means..."
```

---

## Quick Reference: Key Equations

```
State evolution:     ρ(t+1) = U(t) ρ(t) U†(t)
Measurement:         p = Tr(M ρ)
Post-measurement:    ρ' = M ρ M† / Tr(M ρ M†)
Logit bias:          bias_i = λ · Tr(|token_i⟩⟨token_i| ρ)
Low-rank:            ρ ≈ Σᵢ λᵢ |vᵢ⟩⟨vᵢ|
```

---

## When You Get Stuck

1. **Matrix is not Hermitian?** → `ρ = (ρ + ρ.conj().T) / 2`
2. **Trace is not 1?** → `ρ = ρ / np.trace(ρ)`
3. **Negative eigenvalues?** → Clamp to 0, then renormalize
4. **Too slow?** → Reduce rank, cache operators, use sparse matrices
5. **Transformations don't work?** → Increase λ (bias strength), check concept embeddings

---

## Resources

- Full spec: `SNT_Engineering_Specification.md`
- Original theory: Check the research papers in main document
- Quantum computing basics: Nielsen & Chuang Chapter 2
- Sentence embeddings: https://www.sbert.net/

---

## Contact/Questions

When asking for help, provide:
1. Your current density matrix shape and rank
2. The operation you're trying to perform
3. Input/output examples
4. Any error messages or unexpected behavior

Good luck! Remember: Start simple (low rank, small vocabulary), verify properties, then scale up.

------------

# SNT Quick Start for Developers

## What You're Building

A **Narrative Transformation Engine** that uses quantum-inspired math to control how AI generates and transforms stories.

## The 30-Second Pitch

We represent the "meaning" of a narrative as a **density matrix** (ρ) in concept space. As you read/generate text:
- The matrix **evolves** (like quantum state evolution)
- We can **measure** it (extract themes/emotions)  
- We can **transform** it (steer the narrative)

This gives us fine-grained control over LLM outputs while maintaining coherence.

---

## Core Problem

**Full density matrices are too big**: For 10,000 concepts, you need 10k × 10k = 100 million numbers.

**Solution**: Use low-rank approximation (store only top-20 eigenvalues + eigenvectors).

---

## System Architecture (3 Components)

```
┌──────────────────┐
│  Control Layer   │ ← User says "make this more hopeful"
└────────┬─────────┘
         ↓
┌──────────────────┐
│  QSSM Module     │ ← Maintains density matrix ρ
│  (Your Code)     │ ← Computes alignment scores
└────────┬─────────┘ ← Outputs logit biases
         ↓
┌──────────────────┐
│  LLM (GPT/etc)   │ ← Generates actual tokens
└──────────────────┘
```

**Your job**: Build the QSSM Module that sits between user requests and the LLM.

---

## Key Data Structure

```python
class NarrativeState:
    """Represents the evolving meaning of a narrative."""
    
    def __init__(self, dim=768, rank=20):
        self.eigenvalues = np.zeros(rank)       # Top eigenvalues
        self.eigenvectors = np.zeros((dim, rank))  # Corresponding vectors
    
    def evolve(self, sentence_embedding):
        """Update state as narrative progresses."""
        # Create rotation in concept space
        # Apply: ρ_new = U @ ρ @ U.conj().T
        
    def measure(self, concept_operator):
        """How much does current state align with this concept?"""
        # Return: Tr(operator @ ρ)
        
    def bias_generation(self, token_embeddings):
        """Which tokens fit the current narrative state?"""
        # Return alignment score for each token
```

---

## Three Operations You Must Implement

### 1. Initialize State (from prompt)

```python
def create_initial_state(prompt_text):
    # Get embedding from sentence encoder
    embedding = encoder.encode(prompt_text)
    
    # Convert to density matrix
    ρ = np.outer(embedding, embedding)
    ρ = ρ / np.trace(ρ)  # Normalize
    
    # Compress to low-rank
    return low_rank_approximate(ρ, rank=20)
```

### 2. Evolve State (as you generate)

```python
def update_state(current_ρ, new_sentence):
    # Get sentence embedding
    v = encoder.encode(new_sentence)
    
    # Create unitary operator (rotation)
    U = construct_rotation(v, angle=0.1)
    
    # Apply quantum evolution
    new_ρ = U @ current_ρ @ U.conj().T
    
    return new_ρ
```

### 3. Steer Generation (transform narrative)

```python
def generate_with_steering(llm, current_ρ, target_concept):
    # Get target concept embedding
    target = encoder.encode(target_concept)
    
    for _ in range(max_tokens):
        # Get LLM's natural next-token probabilities
        logits = llm.get_logits()
        
        # Compute alignment of each token with current state
        token_embeddings = llm.get_token_embeddings()
        alignment = [np.trace(np.outer(emb, emb) @ current_ρ) 
                     for emb in token_embeddings]
        
        # Bias logits toward aligned tokens
        biased_logits = logits + strength * np.array(alignment)
        
        # Sample and update state
        token = sample(biased_logits)
        current_ρ = update_state(current_ρ, token)
```

---

## Essential Functions to Write

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `create_density_matrix()` | Initialize state | text or embedding | ρ (low-rank) |
| `evolve_state()` | Update as text added | ρ, new_text | ρ' |
| `compute_alignment()` | How well does token fit? | token_emb, ρ | float score |
| `construct_operator()` | Make measurement operator | concept_name | matrix M |
| `project_state()` | Transform toward target | ρ, target_operator | ρ' |
| `low_rank_compress()` | Reduce dimensionality | full matrix | eigenvalues, eigenvectors |

---

## Math Cheat Sheet

### Density Matrix Properties
```python
# Must satisfy:
assert np.allclose(ρ, ρ.conj().T)  # Hermitian
assert np.trace(ρ) ≈ 1.0            # Normalized
assert all(eigenvalues >= 0)        # Positive semi-definite
```

### Evolution (Unitary)
```python
# Preserve trace and hermiticity
ρ_new = U @ ρ @ U.conj().T

# Where U is unitary: U @ U.conj().T = I
```

### Measurement (Projection)
```python
# Probability of measuring concept M
p = np.trace(M @ ρ)

# State after measurement
ρ_after = (M @ ρ @ M.conj().T) / p
```

### Low-Rank Approximation
```python
# Keep only top-k eigenvalues
eigenvals, eigenvecs = np.linalg.eigh(ρ)
sorted_indices = np.argsort(eigenvals)[::-1]
ρ_compressed = sum(eigenvals[i] * np.outer(eigenvecs[:, i], eigenvecs[:, i])
                   for i in sorted_indices[:k])
```

---

## Integration Points

### With LLM API
```python
# OpenAI-style
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[...],
    logit_bias={token_id: bias_value}  # ← Your QSSM biases go here
)

# HuggingFace-style
outputs = model.generate(
    input_ids,
    logits_processor=[YourQSSMProcessor()]  # ← Custom processor
)
```

### With Sentence Encoder
```python
from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer('all-MiniLM-L6-v2')
embedding = encoder.encode("Your text here")  # → 384-dim vector
```

---

## Common Pitfalls

❌ **Don't**: Compute full n×n matrices for large n  
✅ **Do**: Always work with low-rank representation

❌ **Don't**: Apply arbitrary matrix transformations  
✅ **Do**: Ensure operators preserve trace and positivity

❌ **Don't**: Directly multiply density matrices (ρ₁ @ ρ₂)  
✅ **Do**: Use unitary evolution (U @ ρ @ U†) or projection (M @ ρ @ M†)

❌ **Don't**: Forget to normalize after operations  
✅ **Do**: Always ensure trace(ρ) = 1.0 after each update

---

## Testing Checklist

```python
def test_density_matrix_properties(ρ):
    assert np.allclose(ρ, ρ.conj().T), "Not Hermitian"
    assert abs(np.trace(ρ) - 1.0) < 1e-6, "Not normalized"
    eigenvals = np.linalg.eigvalsh(ρ)
    assert all(eigenvals >= -1e-6), "Not positive semi-definite"

def test_evolution_preserves_properties(ρ, U):
    ρ_new = U @ ρ @ U.conj().T
    test_density_matrix_properties(ρ_new)

def test_end_to_end_transformation():
    text = "I am sad and lonely"
    target = "hopeful"
    
    ρ = create_initial_state(text)
    transformed = generate_with_steering(llm, ρ, target)
    
    # Check if output is more aligned with "hopeful"
    score_before = measure_concept(ρ, target)
    score_after = measure_concept(final_ρ, target)
    assert score_after > score_before
```

---

## MVP Scope (Start Here)

**Week 1**: Core matrix operations
- Create/compress density matrices
- Implement evolution and measurement
- Unit tests for quantum properties

**Week 2**: LLM integration
- Extract embeddings from LLM
- Compute alignment scores
- Implement logit bias injection

**Week 3**: Control interface  
- Parse user transformation requests
- Map concepts to operators
- Build basic API

**Week 4**: Testing & refinement
- End-to-end tests
- Performance optimization
- Example demonstrations

---

## Example Use Cases

```python
# Use Case 1: Emotional transformation
input_text = "The day was grey and meaningless."
transform(input_text, target_emotion="hopeful")
# → "Though the sky was overcast, new possibilities stirred."

# Use Case 2: Theme steering
story_start = "The warrior drew his sword..."
continue_story(story_start, target_theme="redemption", length=500)
# → Story continues with redemption arc

# Use Case 3: Style transfer
formal_text = "One must consider the implications..."
transform(formal_text, target_style="casual")
# → "So like, we should probably think about what this means..."
```

---

## Quick Reference: Key Equations

```
State evolution:     ρ(t+1) = U(t) ρ(t) U†(t)
Measurement:         p = Tr(M ρ)
Post-measurement:    ρ' = M ρ M† / Tr(M ρ M†)
Logit bias:          bias_i = λ · Tr(|token_i⟩⟨token_i| ρ)
Low-rank:            ρ ≈ Σᵢ λᵢ |vᵢ⟩⟨vᵢ|
```

---

## When You Get Stuck

1. **Matrix is not Hermitian?** → `ρ = (ρ + ρ.conj().T) / 2`
2. **Trace is not 1?** → `ρ = ρ / np.trace(ρ)`
3. **Negative eigenvalues?** → Clamp to 0, then renormalize
4. **Too slow?** → Reduce rank, cache operators, use sparse matrices
5. **Transformations don't work?** → Increase λ (bias strength), check concept embeddings

---

## Resources

- Full spec: `SNT_Engineering_Specification.md`
- Original theory: Check the research papers in main document
- Quantum computing basics: Nielsen & Chuang Chapter 2
- Sentence embeddings: https://www.sbert.net/

---

## Contact/Questions

When asking for help, provide:
1. Your current density matrix shape and rank
2. The operation you're trying to perform
3. Input/output examples
4. Any error messages or unexpected behavior

Good luck! Remember: Start simple (low rank, small vocabulary), verify properties, then scale up.