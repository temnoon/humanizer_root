// Personalizer Transformation Service
// Transforms text using discovered personas and styles
import type { Env } from '../../shared/types';

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Generate embedding for text using Workers AI
 */
async function generateEmbedding(env: Env, text: string): Promise<number[]> {
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: text
  });

  return (response as any).data[0];
}

/**
 * Transform text using a persona and style
 * Returns transformed text with semantic similarity score
 */
export async function transformWithPersonalizer(
  env: Env,
  userId: string,
  inputText: string,
  personaId?: number,
  styleId?: number,
  model: string = '@cf/meta/llama-3.1-8b-instruct'
): Promise<{
  outputText: string;
  semanticSimilarity: number;
  tokensUsed: number;
  modelUsed: string;
  transformationId: number;
}> {
  // Validate input
  if (!inputText || inputText.trim().length === 0) {
    throw new Error('Input text is required');
  }

  // Generate embedding for input text
  const inputEmbedding = await generateEmbedding(env, inputText);

  // Initialize prompt parts
  let personaDescription = '';
  let personaExamples = '';
  let styleCharacteristics = '';

  // Load persona if provided
  if (personaId) {
    // Try user's personal personas first
    let persona = await env.DB.prepare(
      'SELECT * FROM personal_personas WHERE id = ? AND user_id = ?'
    ).bind(personaId, userId).first();

    // Fall back to global personas if not found
    if (!persona) {
      persona = await env.DB.prepare(
        'SELECT * FROM npe_personas WHERE id = ?'
      ).bind(personaId).first();
    }

    if (!persona) {
      throw new Error('Persona not found');
    }

    personaDescription = `PERSONA: ${persona.name}${persona.description ? ' - ' + persona.description : ''}\n`;

    // Add example texts if available
    if (persona.example_texts) {
      const examples = JSON.parse(persona.example_texts as string) as string[];
      personaExamples = examples.map((ex, idx) =>
        `Example ${idx + 1}:\n${ex}\n`
      ).join('\n');
    }
  }

  // Load style if provided
  if (styleId) {
    const style = await env.DB.prepare(
      'SELECT * FROM personal_styles WHERE id = ? AND user_id = ?'
    ).bind(styleId, userId).first();

    if (!style) {
      throw new Error('Style not found or does not belong to user');
    }

    styleCharacteristics = 'STYLE CHARACTERISTICS:\n';

    if (style.formality_score !== null) {
      const formalityPercent = ((style.formality_score as number) * 100).toFixed(0);
      styleCharacteristics += `- Formality: ${formalityPercent}%\n`;
    }

    if (style.complexity_score !== null) {
      const complexityPercent = ((style.complexity_score as number) * 100).toFixed(0);
      styleCharacteristics += `- Complexity: ${complexityPercent}%\n`;
    }

    if (style.avg_sentence_length !== null) {
      styleCharacteristics += `- Average sentence length: ${(style.avg_sentence_length as number).toFixed(1)} words\n`;
    }

    if (style.tone_markers) {
      const markers = JSON.parse(style.tone_markers as string) as string[];
      if (markers.length > 0) {
        styleCharacteristics += `- Tone markers: ${markers.join(', ')}\n`;
      }
    }
  }

  // Construct the transformation prompt
  const prompt = `You are helping express content through a specific person's authentic voice.

${personaDescription}${personaExamples ? '\n' + personaExamples : ''}
${styleCharacteristics ? '\n' + styleCharacteristics : ''}
ORIGINAL TEXT:
${inputText}

Rewrite the text to express the same ideas through this person's authentic voice and style.
Preserve the core meaning (95%+ semantic similarity) while adopting their linguistic patterns.
This is about authentic expression, NOT hiding authorship.

OUTPUT:`;

  // Call Workers AI to transform the text
  const response = await env.AI.run(model, {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000
  }) as any;

  const outputText = response.response || '';

  if (!outputText || outputText.trim().length === 0) {
    throw new Error('Transformation produced empty output');
  }

  // Generate embedding for output text
  const outputEmbedding = await generateEmbedding(env, outputText);

  // Calculate semantic similarity
  const semanticSimilarity = cosineSimilarity(inputEmbedding, outputEmbedding);

  // Estimate tokens used (rough approximation)
  const tokensUsed = Math.ceil((inputText.length + outputText.length + prompt.length) / 4);

  // Save transformation to database
  const result = await env.DB.prepare(`
    INSERT INTO personalizer_transformations
    (user_id, input_text, output_text, persona_id, style_id, semantic_similarity,
     tokens_used, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    inputText,
    outputText,
    personaId || null,
    styleId || null,
    semanticSimilarity,
    tokensUsed,
    model
  ).run();

  return {
    outputText,
    semanticSimilarity,
    tokensUsed,
    modelUsed: model,
    transformationId: result.meta.last_row_id as number
  };
}

/**
 * Get transformation history for a user
 */
export async function getTransformationHistory(
  env: Env,
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<any[]> {
  const result = await env.DB.prepare(`
    SELECT
      t.id,
      t.input_text,
      t.output_text,
      t.semantic_similarity,
      t.tokens_used,
      t.model_used,
      t.created_at,
      p.name as persona_name,
      s.name as style_name
    FROM personalizer_transformations t
    LEFT JOIN personal_personas p ON t.persona_id = p.id
    LEFT JOIN personal_styles s ON t.style_id = s.id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all();

  return result.results;
}
