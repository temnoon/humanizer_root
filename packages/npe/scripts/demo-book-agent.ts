#!/usr/bin/env npx tsx
/**
 * Book Agent Demo
 *
 * Demonstrates autonomous book making with Rho-based quality control.
 *
 * Usage:
 *   npx tsx scripts/demo-book-agent.ts
 *   npx tsx scripts/demo-book-agent.ts --text "Your text here"
 *   npx tsx scripts/demo-book-agent.ts --persona scientist
 *
 * Requires:
 *   - Ollama running locally (ollama serve)
 *   - Models: nomic-embed-text (embeddings), llama3.1:8b (generation)
 */

import { BookAgent, createBookAgent } from '../src/agents/book-agent.js';
import { OllamaAdapter } from '../src/llm/ollama-adapter.js';

// ═══════════════════════════════════════════════════════════════════════════
// SAMPLE PERSONAS
// ═══════════════════════════════════════════════════════════════════════════

const PERSONAS = {
  scientist: {
    name: 'Research Scientist',
    systemPrompt: `An analytical mind in the tradition of careful scientific inquiry.
- ONTOLOGY: The world is knowable through observation and measurement
- EPISTEMICS: Claims require evidence; uncertainty should be acknowledged
- ATTENTION: Notices patterns, anomalies, quantifiable relationships
- VALUES: Precision, reproducibility, intellectual humility
- READER: Sharing observations so you can evaluate the evidence yourself`,
  },
  poet: {
    name: 'Contemplative Poet',
    systemPrompt: `A contemplative voice that finds meaning in the interplay of language and silence.
- ONTOLOGY: Reality has depths that logic cannot fully capture
- EPISTEMICS: Metaphor and imagery reveal truths that propositions miss
- ATTENTION: Notices resonance, rhythm, the weight of particular words
- VALUES: Beauty, authentic expression, the courage to sit with mystery
- READER: Inviting you into a space where meaning unfolds slowly`,
  },
  journalist: {
    name: 'Investigative Journalist',
    systemPrompt: `A clear-eyed reporter focused on what happened and why it matters.
- ONTOLOGY: Facts exist and can be discovered through diligent inquiry
- EPISTEMICS: Multiple sources, documentation, follow the evidence
- ATTENTION: Notices who benefits, what's missing, patterns of behavior
- VALUES: Clarity, public interest, holding power accountable
- READER: Giving you the information you need to understand what's happening`,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SAMPLE TEXTS
// ═══════════════════════════════════════════════════════════════════════════

const SAMPLE_TEXTS = {
  quantum: `The density matrix represents our uncertainty about a quantum system. When we make a measurement, we don't learn about an objective state that was always there. Instead, the measurement itself participates in creating what we observe. This is not mysticism—it's the mathematical structure of quantum theory taken seriously.`,

  consciousness: `Consciousness seems to be the one thing we cannot doubt. Even in doubting, we are conscious of doubting. Yet when we try to explain consciousness scientifically, we find ourselves chasing our own tail. The explainer is the explained. The observer is the observed. This loop isn't a bug—it's the fundamental feature.`,

  language: `Words are pebbles dropped into the pond of meaning. The pebble itself is finite, discrete, localized. But the ripples spread outward, interfere with each other, create patterns that weren't in any single pebble. Meaning isn't in the words. It's in what happens after the words.`,
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BOOK AGENT DEMO - Autonomous Transformation with Rho Control');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Parse args
  const args = process.argv.slice(2);
  const textArg = args.find((a) => a.startsWith('--text='))?.slice(7);
  const personaArg = args.find((a) => a.startsWith('--persona='))?.slice(10);
  const analyzeOnly = args.includes('--analyze-only');

  const text = textArg || SAMPLE_TEXTS.consciousness;
  const personaKey = (personaArg || 'poet') as keyof typeof PERSONAS;
  const persona = PERSONAS[personaKey] || PERSONAS.poet;

  console.log(`📖 Input text (${text.split(/[.!?]+/).filter(Boolean).length} sentences):`);
  console.log(`   "${text.slice(0, 100)}..."\n`);
  console.log(`🎭 Persona: ${persona.name}\n`);

  // Create adapter and discover models
  console.log('🔌 Connecting to Ollama...');
  const adapter = new OllamaAdapter({
    baseUrl: 'http://localhost:11434',
  });

  if (!(await adapter.isAvailable())) {
    console.error('   ✗ Ollama not running. Start with: ollama serve');
    process.exit(1);
  }

  // List available models
  const availableModels = await adapter.listModels();
  console.log(`   ✓ Ollama connected (${availableModels.length} models available)`);

  // Find suitable models for completion and embedding
  const embeddingModels = availableModels.filter(
    (m) => m.includes('embed') || m.includes('nomic') || m.includes('bge') || m.includes('mxbai')
  );
  const completionModels = availableModels.filter(
    (m) => !m.includes('embed') && !m.includes('bge') && !m.includes('mxbai')
  );

  // Select completion model (prefer certain families)
  const preferredCompletion = ['qwen3', 'llama3', 'mistral', 'gemma'];
  let selectedModel = completionModels[0];
  for (const pref of preferredCompletion) {
    const match = completionModels.find((m) => m.includes(pref));
    if (match) {
      selectedModel = match;
      break;
    }
  }

  // Select embedding model - PREFER nomic-embed-text for archive consistency (768 dims)
  // Archive uses nomic-embed-text, so Rho analysis should use same latent space
  const preferredEmbed = ['nomic-embed', 'nomic', 'bge', 'mxbai'];
  let selectedEmbedModel = embeddingModels[0] || 'nomic-embed-text:latest';
  for (const pref of preferredEmbed) {
    const match = embeddingModels.find((m) => m.includes(pref));
    if (match) {
      selectedEmbedModel = match;
      break;
    }
  }

  console.log(`   📝 Completion model: ${selectedModel}`);
  console.log(`   🔢 Embedding model: ${selectedEmbedModel}\n`);

  // Reconfigure adapter with discovered models
  const configuredAdapter = new OllamaAdapter({
    baseUrl: 'http://localhost:11434',
    model: selectedModel,
    embedModel: selectedEmbedModel,
  });

  const embedder = async (text: string): Promise<number[]> => {
    const result = await configuredAdapter.embed(text);
    return result.embedding;
  };

  // Create agent
  const agent = createBookAgent(configuredAdapter, embedder, {
    verbose: true,
    thresholds: {
      minPurity: 0.12,
      maxEntropy: 3.0,
      maxPurityDrop: 0.15,
      maxEntropyIncrease: 0.4,
    },
    retry: {
      maxRetries: 3,
      temperatureAdjustment: -0.1,
    },
  });

  // Analyze original
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 1: Rho Analysis of Original Text');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const analysis = await agent.analyzeRho(text);

  console.log('\n📊 Rho Trajectory:');
  console.log('   Purity:  ', analysis.purityTrajectory.map((p) => p.toFixed(3)).join(' → '));
  console.log('   Entropy: ', analysis.entropyTrajectory.map((e) => e.toFixed(3)).join(' → '));
  console.log(`   Quality: ${analysis.quality.toUpperCase()}`);

  console.log('\n🎯 Load-Bearing Sentences (highest semantic weight):');
  analysis.loadBearingSentences.forEach((s, i) => {
    console.log(`   ${i + 1}. [weight=${s.distance.toFixed(3)}] "${s.sentence.slice(0, 60)}..."`);
  });

  if (analyzeOnly) {
    console.log('\n(--analyze-only flag set, skipping transformation)');
    return;
  }

  // Transform with quality control
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PHASE 2: Transformation with Rho Quality Control');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const result = await agent.transformWithPersona(text, persona);

  console.log('\n📈 Results:');
  console.log(`   Success: ${result.success ? '✓' : '✗'}`);
  console.log(`   Attempts: ${result.attempts.length}`);
  console.log(`   Duration: ${result.totalDurationMs}ms`);
  console.log(`   Purity delta: ${result.qualityDelta.purity >= 0 ? '+' : ''}${result.qualityDelta.purity.toFixed(3)}`);
  console.log(`   Entropy delta: ${result.qualityDelta.entropy >= 0 ? '+' : ''}${result.qualityDelta.entropy.toFixed(3)}`);

  console.log('\n📝 Transformation History:');
  result.attempts.forEach((attempt) => {
    const status = attempt.passed ? '✓' : '✗';
    console.log(
      `   Attempt ${attempt.attempt}: ${status} (purity=${attempt.analysis.finalState.purity.toFixed(3)}, entropy=${attempt.analysis.finalState.entropy.toFixed(3)})${attempt.failureReason ? ` - ${attempt.failureReason}` : ''}`
    );
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FINAL OUTPUT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Original:');
  console.log(`"${text}"\n`);

  console.log(`Transformed (${persona.name}):`);
  console.log(`"${result.text}"\n`);

  // Final analysis
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  QUALITY ASSESSMENT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const originalQuality = analysis.quality;
  const finalQuality = result.finalAnalysis.quality;

  console.log(`   Original quality: ${originalQuality.toUpperCase()}`);
  console.log(`   Final quality:    ${finalQuality.toUpperCase()}`);

  if (result.qualityDelta.purity >= 0) {
    console.log('\n   ✓ Meaning CONCENTRATED (purity increased)');
    console.log('     → Transformation added intentional constraint');
  } else if (result.qualityDelta.purity > -0.05) {
    console.log('\n   ~ Meaning PRESERVED (purity stable)');
    console.log('     → Transformation maintained semantic weight');
  } else {
    console.log('\n   ✗ Meaning DILUTED (purity decreased)');
    console.log('     → Transformation smoothed constraint (more AI-like)');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  THE PEBBLE-RIPPLE INSIGHT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
  "Words are pebbles. Meaning is ripples."

  The original text created interference patterns (measured by ρ).
  The transformation created new patterns.

  If purity INCREASED: The new pebbles created more coherent ripples.
  If purity DECREASED: The new pebbles smoothed the water.

  Human writing = intentional interference patterns (high SIC)
  AI writing = surface smoothing (low SIC)

  The BookAgent ensures transformations don't smooth away meaning.
`);
}

main().catch(console.error);
