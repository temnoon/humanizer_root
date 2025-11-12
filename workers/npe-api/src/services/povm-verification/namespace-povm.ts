/**
 * Namespace POVM Pack - Measures reference space (names, domains, vocabulary)
 *
 * Purpose: Detect changes in proper names, cultural references, and domain vocabulary
 * Insensitive to: Voice, tone, formality, sentence structure
 * Sensitive to: Entity names, setting references, domain terminology
 *
 * Basis Rotation Model:
 * - Namespace transformation = rotation in "reference" dimensions of ρ-space
 * - Should affect ONLY names/domains, not voice/syntax/content
 * - Leakage = drift in Persona/Style/Content POVMs
 */

export interface NamespacePOVMMeasurement {
  properNames: {
    names: string[];
    drift: number;
    evidence: string;
  };
  culturalDomain: {
    domain: string;
    drift: number;
    evidence: string;
  };
  specializedTerms: {
    terms: Array<{ term: string; domain: string }>;
    drift: number;
    evidence: string;
  };
  timestamp: string;
}

/**
 * Measure Namespace POVM for a given text
 */
export async function measureNamespacePOVM(
  text: string,
  ai: any
): Promise<NamespacePOVMMeasurement> {
  console.log('[Namespace POVM] Starting measurement');

  const [namesResult, domainResult, termsResult] = await Promise.all([
    measureProperNames(text, ai),
    measureCulturalDomain(text, ai),
    measureSpecializedTerms(text, ai)
  ]);

  return {
    properNames: namesResult,
    culturalDomain: domainResult,
    specializedTerms: termsResult,
    timestamp: new Date().toISOString()
  };
}

/**
 * M1: Proper Name Inventory
 * Extracts all proper names (people, places, organizations)
 */
async function measureProperNames(text: string, ai: any) {
  const prompt = `List all proper names (people, places, organizations) in this text.

Format your response as a simple numbered list:
1. [Name 1]
2. [Name 2]
...

Include ONLY names that are:
- Capitalized or clearly refer to specific entities
- Proper nouns (not generic terms)

Exclude:
- Generic terms like 'woman', 'garden', 'morning'
- Common nouns like 'birds', 'flowers'
- Adjectives like 'young', 'sunny'

If there are no proper names, respond with: "No proper names"

TEXT:
${text}

PROPER NAMES:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a linguist specializing in named entity recognition. Extract proper names precisely. Respond ONLY with the numbered list.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 256,
    temperature: 0.0
  });

  const names = parseNameList(response.response || '');

  return {
    names,
    drift: 0,  // Calculated during comparison
    evidence: names.join(', ') || '(none)'
  };
}

/**
 * M2: Cultural Domain Classification
 * Identifies which cultural/conceptual domain the references belong to
 */
async function measureCulturalDomain(text: string, ai: any) {
  const prompt = `What cultural/conceptual domain do the references in this text belong to?

Choose ONE primary domain:
- mythology (Greek/Roman gods, heroes, legends)
- science (physics, biology, technical concepts)
- nature (ecosystems, natural processes, organisms)
- corporate (business, management, organizational)
- medieval (kingdoms, knights, feudal)
- contemporary (modern life, technology, urbanism)
- abstract (philosophy, pure concepts, timeless)
- generic (no specific domain, everyday life)

Consider:
- What world/setting does this text evoke?
- What vocabulary/references suggest a particular domain?
- If mixed, choose the DOMINANT domain

Respond with ONLY the domain name (one word).

TEXT:
${text}

DOMAIN:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a cultural analyst. Classify domains precisely. Respond with ONLY the domain name, no explanation.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 32,
    temperature: 0.0
  });

  const domain = parseDomain(response.response || '');

  return {
    domain,
    drift: 0,  // Calculated during comparison
    evidence: domain
  };
}

/**
 * M3: Specialized Vocabulary Extraction
 * Identifies domain-specific or specialized terminology
 */
async function measureSpecializedTerms(text: string, ai: any) {
  const prompt = `Identify domain-specific or specialized vocabulary in this text.

These are words that belong to a particular field, culture, or namespace.
NOT general English vocabulary.

Format your response as a numbered list:
1. [term] - [domain]
2. [term] - [domain]
...

Examples:
- photosynthesis - biology
- Zeus - Greek mythology
- synergy - corporate
- knight - medieval
- algorithm - computer science

Only include words that are NOT common everyday language.
If there are no specialized terms, respond with: "No specialized terms"

TEXT:
${text}

SPECIALIZED TERMS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a terminology expert. Identify specialized vocabulary precisely. Respond ONLY with the numbered list.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 512,
    temperature: 0.0
  });

  const terms = parseTermsList(response.response || '');

  return {
    terms,
    drift: 0,  // Calculated during comparison
    evidence: terms.map(t => `${t.term} (${t.domain})`).join(', ') || '(none)'
  };
}

/**
 * Compute drift between two Namespace POVM measurements
 */
export async function computeNamespaceDrift(
  before: NamespacePOVMMeasurement,
  after: NamespacePOVMMeasurement,
  ai: any
): Promise<NamespacePOVMMeasurement> {
  console.log('[Namespace POVM] Computing drift');

  // M1: Proper names drift (set difference)
  const namesDrift = computeNamesDrift(
    before.properNames.names,
    after.properNames.names
  );

  // M2: Cultural domain drift (binary: same or different)
  const domainDrift = before.culturalDomain.domain === after.culturalDomain.domain ? 0 : 1.0;

  // M3: Specialized terms drift (Jaccard similarity)
  const termsDrift = computeTermsDrift(
    before.specializedTerms.terms,
    after.specializedTerms.terms
  );

  return {
    properNames: {
      ...after.properNames,
      drift: namesDrift
    },
    culturalDomain: {
      ...after.culturalDomain,
      drift: domainDrift
    },
    specializedTerms: {
      ...after.specializedTerms,
      drift: termsDrift
    },
    timestamp: after.timestamp
  };
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

function parseNameList(response: string): string[] {
  // Check for "no proper names"
  if (response.toLowerCase().includes('no proper names')) {
    return [];
  }

  const lines = response.split('\n').filter(line => line.trim().length > 0);
  const names: string[] = [];

  for (const line of lines) {
    // Match numbered list: "1. Name" or "1) Name"
    const match = line.match(/^\s*\d+[\.)]\s*(.+)$/);
    if (match) {
      names.push(match[1].trim());
    }
  }

  return names;
}

function parseDomain(response: string): string {
  // Extract single word domain
  const cleaned = response.trim().toLowerCase();

  // Valid domains
  const validDomains = [
    'mythology', 'science', 'nature', 'corporate',
    'medieval', 'contemporary', 'abstract', 'generic'
  ];

  for (const domain of validDomains) {
    if (cleaned.includes(domain)) {
      return domain;
    }
  }

  // Default to generic if unclear
  return 'generic';
}

function parseTermsList(response: string): Array<{ term: string; domain: string }> {
  // Check for "no specialized terms"
  if (response.toLowerCase().includes('no specialized terms')) {
    return [];
  }

  const lines = response.split('\n').filter(line => line.trim().length > 0);
  const terms: Array<{ term: string; domain: string }> = [];

  for (const line of lines) {
    // Match "1. term - domain" or "1) term - domain"
    const match = line.match(/^\s*\d+[\.)]\s*(.+?)\s*-\s*(.+)$/);
    if (match) {
      terms.push({
        term: match[1].trim(),
        domain: match[2].trim()
      });
    }
  }

  return terms;
}

// ============================================================================
// DRIFT CALCULATION UTILITIES
// ============================================================================

/**
 * Compute drift between two name lists using set operations
 */
function computeNamesDrift(names1: string[], names2: string[]): number {
  // Fast path: identical lists
  if (names1.length === names2.length &&
      names1.every((name, i) => name === names2[i])) {
    return 0;
  }

  // Handle edge cases
  if (names1.length === 0 && names2.length === 0) return 0;
  if (names1.length === 0 || names2.length === 0) return 1.0;

  // Convert to sets for comparison (case-insensitive)
  const set1 = new Set(names1.map(n => n.toLowerCase()));
  const set2 = new Set(names2.map(n => n.toLowerCase()));

  // Jaccard distance: 1 - (intersection / union)
  const intersection = new Set([...set1].filter(n => set2.has(n)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;

  const jaccard = intersection.size / union.size;
  return 1 - jaccard;
}

/**
 * Compute drift between two term lists using Jaccard similarity
 */
function computeTermsDrift(
  terms1: Array<{ term: string; domain: string }>,
  terms2: Array<{ term: string; domain: string }>
): number {
  // Fast path: identical lists
  if (terms1.length === terms2.length &&
      terms1.every((t, i) => t.term === terms2[i].term && t.domain === terms2[i].domain)) {
    return 0;
  }

  // Handle edge cases
  if (terms1.length === 0 && terms2.length === 0) return 0;
  if (terms1.length === 0 || terms2.length === 0) return 1.0;

  // Convert to sets of "term:domain" strings (case-insensitive)
  const set1 = new Set(terms1.map(t => `${t.term.toLowerCase()}:${t.domain.toLowerCase()}`));
  const set2 = new Set(terms2.map(t => `${t.term.toLowerCase()}:${t.domain.toLowerCase()}`));

  // Jaccard distance
  const intersection = new Set([...set1].filter(t => set2.has(t)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;

  const jaccard = intersection.size / union.size;
  return 1 - jaccard;
}
