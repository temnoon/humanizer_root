/**
 * Chekhov Analyzer
 *
 * Tracks named entities through a narrative and measures "fulfillment" -
 * whether specific details introduced early pay off later.
 *
 * The Chekhov Ratio: fulfilled_specifics / total_specifics
 *
 * Human writing: 0.6-0.8 (most details pay off)
 * AI writing:    0.1-0.3 (details are decorative, not purposeful)
 *
 * Named after Chekhov's Gun: "If you show a gun in the first act,
 * it must go off in the third."
 */

import { DEFAULT_CONFIG } from './types.js';
import type {
  TrackedEntity,
  EntityType,
  EntityStatus,
  EntityOccurrence,
  OccurrenceRole,
  ChekhovAnalysis,
  ChekhovGrade,
  ChekhovSuggestion,
  V3Config
} from './types.js';

// ============================================================
// Entity Extraction
// ============================================================

/**
 * Extract potential named entities from text.
 * Uses pattern matching rather than ML for speed and portability.
 */
export function extractEntities(
  sentences: string[],
  config: V3Config = DEFAULT_CONFIG
): TrackedEntity[] {
  const entityMap = new Map<string, TrackedEntity>();
  const totalSentences = sentences.length;

  // First pass: collect all potential entities
  sentences.forEach((sentence, sentenceIndex) => {
    const position = sentenceIndex / Math.max(totalSentences - 1, 1);
    const foundEntities = extractEntitiesFromSentence(sentence);

    foundEntities.forEach(({ text, type }) => {
      const normalized = normalizeEntity(text);
      const id = `${type}:${normalized}`;

      if (entityMap.has(id)) {
        // Existing entity - add occurrence
        const entity = entityMap.get(id)!;
        const role = determineRole(position, entity, config);

        entity.occurrences.push({
          sentenceIndex,
          position,
          context: sentence,
          role
        });
        entity.mentionCount++;
        entity.lastPosition = position;

        // Update fulfillment status
        if (position >= 1 - config.chekhov.resolutionZone) {
          entity.appearsInResolution = true;
        }
      } else {
        // New entity
        const occurrence: EntityOccurrence = {
          sentenceIndex,
          position,
          context: sentence,
          role: 'INTRODUCTION'
        };

        entityMap.set(id, {
          id,
          text,
          type,
          normalizedForm: normalized,
          occurrences: [occurrence],
          firstPosition: position,
          lastPosition: position,
          mentionCount: 1,
          appearsInResolution: position >= 1 - config.chekhov.resolutionZone,
          hasPayoff: false,
          fulfillmentScore: 0,
          status: 'ORPHANED' // Default, will be updated
        });
      }
    });
  });

  // Calculate fulfillment for each entity
  const entities = Array.from(entityMap.values());
  entities.forEach(entity => calculateFulfillment(entity, config));

  return entities;
}

/**
 * Extract entities from a single sentence using pattern matching.
 * Carefully filters to reduce false positives.
 */
function extractEntitiesFromSentence(sentence: string): Array<{ text: string; type: EntityType }> {
  const entities: Array<{ text: string; type: EntityType }> = [];

  // Skip footnotes and annotations entirely
  if (/^\s*\[Footnote|\[\d+\]|\[Note|\[See /.test(sentence)) {
    return entities;
  }

  // Clean the sentence - remove markdown headers and normalize whitespace
  let cleanSentence = sentence
    .replace(/^#+\s+[^\n]+\n+/g, '')  // Remove markdown headers completely
    .replace(/\n+/g, ' ')              // Normalize newlines to spaces
    .replace(/\[Footnote[^\]]*\]/g, '') // Remove inline footnote references
    .replace(/\[\d+\]/g, '')           // Remove numbered references
    .replace(/\[[ivx]+\]/gi, '')       // Remove roman numeral refs
    .trim();
  if (cleanSentence.length < 3) return entities;

  // === PERSON NAMES ===
  // Look for names in dialogue attribution: said X, X said, asked X, etc.
  const dialoguePattern = /(?:said|asked|replied|answered|whispered|shouted|called|muttered)\s+([A-Z][a-z]{2,})/g;
  let match;
  while ((match = dialoguePattern.exec(cleanSentence)) !== null) {
    const name = match[1];
    if (isValidPersonName(name)) {
      entities.push({ text: name, type: 'PERSON' });
    }
  }

  // Names with titles: Dr. Smith, Mr. Jones, etc.
  const titledPattern = /\b((?:Dr|Mr|Mrs|Ms|Prof|Captain|Detective|Officer|Agent)\.?\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g;
  while ((match = titledPattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1], type: 'PERSON' });
  }

  // Possessive names: Elena's, Malik's (strong signal of a name)
  const possessivePattern = /\b([A-Z][a-z]{2,})(?:'s|'s)\b/g;
  while ((match = possessivePattern.exec(cleanSentence)) !== null) {
    const name = match[1];
    if (isValidPersonName(name)) {
      entities.push({ text: name, type: 'PERSON' });
    }
  }

  // Names as subjects before verbs: "Elena had", "Malik checked"
  const subjectPattern = /\b([A-Z][a-z]{2,})\s+(?:had|was|were|is|are|said|asked|looked|turned|walked|ran|stood|sat|felt|thought|knew|saw|heard|watched|noticed|realized|remembered)\b/g;
  while ((match = subjectPattern.exec(cleanSentence)) !== null) {
    const name = match[1];
    if (isValidPersonName(name)) {
      entities.push({ text: name, type: 'PERSON' });
    }
  }

  // === LOCATIONS ===
  // Geographic features with proper nouns - MUST have capitalized name before feature
  // Matches: "Sermitsiaq Glacier", "Mount Everest", "Lake Superior"
  // Excludes: "the glacier", "an island", "preserved in the glacier"
  const geoFeaturePattern = /\b((?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(Glacier|Mountain|River|Lake|Valley|Canyon|Island|Bay|Beach|Forest|Desert|Ocean|Sea|Coast|Peninsula|Plateau|Falls|Springs|Cave|Reef|Strait|Gulf|Pass|Peak|Range|Basin|Delta|Fjord))\b/g;
  while ((match = geoFeaturePattern.exec(cleanSentence)) !== null) {
    const fullMatch = match[1];
    const properNounPart = match[2];
    const featurePart = match[3];

    // The proper noun part must actually be a proper noun (not common words)
    if (properNounPart && !NON_NAME_WORDS.has(properNounPart) && /^[A-Z]/.test(properNounPart)) {
      const location = fullMatch.replace(/^the\s+/i, '');
      entities.push({ text: location, type: 'LOCATION' });
    }
  }

  // Places with "in/to/from [Proper Noun Place]" - strict: must be proper noun(s)
  // Match patterns like "in New York", "to San Francisco", "from Buenos Aires"
  const prepositionPlace = /\b(?:in|to|from|near|outside|toward|towards)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?=\s*[,.\-;:!?)]|\s+(?:and|or|but|where|when|while|as|that|which|who)|\s*$)/g;
  while ((match = prepositionPlace.exec(cleanSentence)) !== null) {
    const place = match[1];
    // Must be multi-word OR a known place, and not a common phrase
    if (!isCommonPhrase(place) && !NON_NAME_WORDS.has(place.split(' ')[0])) {
      // Additional check: all words should be proper nouns (capitalized)
      const words = place.split(/\s+/);
      const allProper = words.every(w => /^[A-Z][a-z]+$/.test(w));
      if (allProper && words.length >= 2) {
        entities.push({ text: place, type: 'LOCATION' });
      }
    }
  }

  // Known location patterns: cities, countries, regions
  const knownPlacePattern = /\b(New York|Los Angeles|San Francisco|Chicago|Boston|Seattle|Portland|Montreal|Toronto|London|Paris|Tokyo|Berlin|Sydney|Melbourne|Greenland|Patagonia|Alaska|Antarctica|Arctic|Mexico|Canada|Australia|Iceland|Norway|Sweden|Finland|Russia|China|Japan|India|Brazil|Argentina|Chile|Peru|Egypt|Morocco|Kenya|Nigeria|South Africa)\b/g;
  while ((match = knownPlacePattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1], type: 'LOCATION' });
  }

  // Street addresses
  const streetPattern = /\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|Avenue|Road|Boulevard|Lane|Drive|Way|Place|Court|Circle))\b/g;
  while ((match = streetPattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1], type: 'LOCATION' });
  }

  // === TIMES ===
  // Specific times with AM/PM
  const timePattern = /\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.))\b/g;
  while ((match = timePattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1], type: 'TIME' });
  }

  // Specific dates
  const datePattern = /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?)\b/g;
  while ((match = datePattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1], type: 'TIME' });
  }

  // Years in narrative context (19XX, 20XX)
  const yearPattern = /\bin\s+((?:19|20)\d{2})\b/g;
  while ((match = yearPattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1], type: 'TIME' });
  }

  // === OBJECTS (named things) ===
  // "the [Proper Noun]" when it's clearly a named thing
  const namedObjectPattern = /\bthe\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:case|file|project|operation|mission|incident|affair|massacre|treaty|agreement|act|scandal)\b/gi;
  while ((match = namedObjectPattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1] + ' ' + match[0].split(/\s+/).pop(), type: 'OBJECT' });
  }

  // === ORGANIZATIONS ===
  const orgPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Corporation|Company|Inc|LLC|Foundation|Institute|University|College|Hospital|Museum|Library|Agency|Department|Bureau|Commission|Authority|Association|Organization|Society|Club|Church|Temple|Mosque|Synagogue))\b/g;
  while ((match = orgPattern.exec(cleanSentence)) !== null) {
    entities.push({ text: match[1], type: 'ORGANIZATION' });
  }

  // Deduplicate, keeping the first occurrence of each normalized form
  const seen = new Map<string, { text: string; type: EntityType }>();
  for (const entity of entities) {
    const key = normalizeEntity(entity.text);
    if (!seen.has(key)) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

/**
 * Comprehensive list of words that should NOT be treated as person names.
 */
const NON_NAME_WORDS = new Set([
  // Pronouns
  'I', 'Me', 'My', 'Mine', 'Myself',
  'You', 'Your', 'Yours', 'Yourself',
  'He', 'Him', 'His', 'Himself',
  'She', 'Her', 'Hers', 'Herself',
  'It', 'Its', 'Itself',
  'We', 'Us', 'Our', 'Ours', 'Ourselves',
  'They', 'Them', 'Their', 'Theirs', 'Themselves',
  'Who', 'Whom', 'Whose', 'Which', 'What',

  // Determiners & Articles
  'The', 'This', 'That', 'These', 'Those',
  'A', 'An', 'Some', 'Any', 'No', 'Every', 'Each', 'All', 'Both', 'Few', 'Many', 'Most', 'Other', 'Another',

  // Conjunctions & Prepositions
  'And', 'But', 'Or', 'Nor', 'For', 'Yet', 'So',
  'In', 'On', 'At', 'To', 'From', 'With', 'By', 'About', 'Into', 'Through', 'During', 'Before', 'After', 'Above', 'Below', 'Between', 'Under', 'Over',

  // Adverbs & Common sentence starters
  'Now', 'Then', 'Here', 'There', 'Where', 'When', 'Why', 'How',
  'Never', 'Always', 'Often', 'Sometimes', 'Perhaps', 'Maybe', 'Still', 'Just', 'Only', 'Even', 'Also', 'Already', 'Again',
  'Yes', 'No', 'Not', 'Very', 'Too', 'So', 'Well', 'Right', 'Sure', 'Okay',

  // Common abstract nouns (sentence starters)
  'Something', 'Nothing', 'Everything', 'Anything',
  'Someone', 'No one', 'Everyone', 'Anyone',
  'Somewhere', 'Nowhere', 'Everywhere', 'Anywhere',
  'Time', 'Place', 'Thing', 'Way', 'Life', 'World', 'Work', 'Hand', 'Part', 'Year', 'Day', 'Night',

  // Days & Months (already handled as TIME)
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',

  // Common narrative words that get capitalized at sentence start
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'First', 'Second', 'Third', 'Last', 'Next', 'Another', 'Other',
  'Several', 'Few', 'Many', 'Much', 'More', 'Most', 'Less', 'Least',
  'Neither', 'Either', 'Both', 'Half', 'Whole', 'Same', 'Different',

  // Nature words (often capitalized incorrectly)
  'Snow', 'Rain', 'Wind', 'Storm', 'Ice', 'Fire', 'Water', 'Earth', 'Sky', 'Sun', 'Moon', 'Star',
  'Stone', 'Rock', 'Mountain', 'River', 'Lake', 'Sea', 'Ocean', 'Forest', 'Tree',
  'Glacier', 'Desert', 'Valley', 'Canyon', 'Island', 'Beach', 'Coast', 'Cave', 'Cliff', 'Hill',
  'Air', 'Fog', 'Mist', 'Smoke', 'Dust', 'Sand', 'Mud', 'Grass', 'Leaf', 'Flower', 'Root', 'Branch',

  // Emotional/abstract terms
  'Love', 'Hate', 'Fear', 'Hope', 'Joy', 'Pain', 'Death', 'Life', 'Truth', 'Silence', 'Darkness', 'Light',

  // Contractions / partial words
  'Don', 'Won', 'Can', 'Didn', 'Couldn', 'Wouldn', 'Shouldn', 'Isn', 'Aren', 'Wasn', 'Weren', 'Haven', 'Hasn', 'Hadn',

  // Other common false positives
  'Whatever', 'However', 'Whenever', 'Wherever', 'Whether', 'Although', 'Though', 'Unless', 'Until', 'While', 'Because', 'Since',
  'Perhaps', 'Indeed', 'Certainly', 'Obviously', 'Clearly', 'Suddenly', 'Finally', 'Eventually', 'Apparently', 'Actually',
]);

/**
 * Check if text is a valid person name.
 */
function isValidPersonName(text: string): boolean {
  // Must be reasonable length (3-20 characters for single name)
  if (text.length < 3 || text.length > 30) return false;

  // Check against exclusion list
  if (NON_NAME_WORDS.has(text)) return false;

  // Must start with capital letter
  if (!/^[A-Z]/.test(text)) return false;

  // Must be mostly letters
  if (!/^[A-Za-z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(text)) return false;

  // Avoid words that look like adjectives (ending in -ly, -ful, -less, -ness, -tion, -ing)
  if (/(?:ly|ful|less|ness|tion|ing|ment|able|ible)$/i.test(text)) return false;

  return true;
}

/**
 * Check if a phrase is too common to be a meaningful location.
 */
function isCommonPhrase(text: string): boolean {
  const commonPhrases = new Set([
    'The City', 'The Town', 'The Village', 'The Country',
    'New Year', 'Old Town', 'Down Town', 'Up Town',
    'Last Night', 'Next Day', 'Same Time', 'First Time',
    'Long Time', 'Short Time', 'Same Place', 'Right Place',
  ]);

  return commonPhrases.has(text);
}

/**
 * Normalize entity text for matching.
 */
function normalizeEntity(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '')
    .replace(/['']/g, "'")
    .trim();
}

/**
 * Determine the role of an occurrence based on position.
 */
function determineRole(
  position: number,
  entity: TrackedEntity,
  config: V3Config
): OccurrenceRole {
  if (entity.occurrences.length === 0) {
    return 'INTRODUCTION';
  }

  if (position >= 1 - config.chekhov.resolutionZone) {
    return 'RESOLUTION';
  }

  // If significantly later than first mention, it's development
  if (position - entity.firstPosition > 0.3) {
    return 'DEVELOPMENT';
  }

  return 'REFERENCE';
}

// ============================================================
// Fulfillment Calculation
// ============================================================

/**
 * Calculate fulfillment score for an entity.
 */
function calculateFulfillment(entity: TrackedEntity, config: V3Config): void {
  // Single mention = orphaned unless in resolution
  if (entity.mentionCount === 1) {
    if (entity.firstPosition >= 1 - config.chekhov.resolutionZone) {
      // Introduced in resolution - atmospheric, not a promise
      entity.status = 'ATMOSPHERIC';
      entity.fulfillmentScore = 0.5;
    } else {
      // Introduced early, never referenced again - orphaned
      entity.status = 'ORPHANED';
      entity.fulfillmentScore = 0;
      entity.hasPayoff = false;
    }
    return;
  }

  // Multiple mentions
  entity.status = 'RECURRING';

  // Calculate fulfillment based on:
  // 1. Does it appear in resolution?
  // 2. How far does it span in the narrative?
  // 3. Does it have meaningful development?

  let score = 0;

  // Resolution appearance (most important)
  if (entity.appearsInResolution) {
    score += 0.5;
    entity.hasPayoff = true;
  }

  // Span bonus (introduced early, referenced late)
  const span = entity.lastPosition - entity.firstPosition;
  score += Math.min(span * 0.3, 0.3);

  // Multiple mention bonus
  const mentionBonus = Math.min((entity.mentionCount - 1) * 0.1, 0.2);
  score += mentionBonus;

  entity.fulfillmentScore = Math.min(score, 1);

  // Final status determination
  if (entity.fulfillmentScore >= 0.5) {
    entity.status = 'FULFILLED';
  } else if (entity.mentionCount >= config.chekhov.minMentionsForPayoff) {
    entity.status = 'RECURRING';
  } else {
    entity.status = 'ORPHANED';
  }
}

// ============================================================
// Chekhov Analysis
// ============================================================

/**
 * Perform full Chekhov analysis on extracted entities.
 */
export function analyzeChekhovRatio(
  entities: TrackedEntity[],
  config: V3Config = DEFAULT_CONFIG
): ChekhovAnalysis {
  // Filter to entities that made "promises" (introduced in first 80%)
  const promisedEntities = entities.filter(
    e => e.firstPosition < 1 - config.chekhov.resolutionZone
  );

  const fulfilled = promisedEntities.filter(e => e.status === 'FULFILLED');
  const orphaned = promisedEntities.filter(e => e.status === 'ORPHANED');

  // Calculate ratio
  // IMPORTANT: Handle edge cases appropriately
  const totalPromised = fulfilled.length + orphaned.length;
  let chekhovRatio: number;

  if (totalPromised === 0) {
    // No specific entities found - this is NEUTRAL, not perfect
    // Could be: very generic text, poetry, or extraction failure
    // Default to 0.5 (uncertain) rather than 1.0 (perfect)
    chekhovRatio = 0.5;
  } else if (totalPromised === 1) {
    // Single entity is noisy - weight it less extremely
    chekhovRatio = fulfilled.length > 0 ? 0.7 : 0.3;
  } else {
    // Normal case: calculate actual ratio
    chekhovRatio = fulfilled.length / totalPromised;
  }

  // Determine grade
  let chekhovGrade: ChekhovGrade;
  if (chekhovRatio >= config.chekhov.gradeThresholds.humanLike) {
    chekhovGrade = 'HUMAN_LIKE';
  } else if (chekhovRatio >= config.chekhov.gradeThresholds.mixed) {
    chekhovGrade = 'MIXED';
  } else {
    chekhovGrade = 'AI_LIKE';
  }

  // Generate suggestions for orphaned entities
  const suggestions = orphaned.map(entity => generateSuggestion(entity));

  return {
    entities,
    totalEntities: entities.length,
    fulfilledCount: fulfilled.length,
    orphanedCount: orphaned.length,
    chekhovRatio,
    chekhovGrade,
    orphanedEntities: orphaned,
    suggestions
  };
}

/**
 * Generate transformation suggestion for an orphaned entity.
 */
function generateSuggestion(entity: TrackedEntity): ChekhovSuggestion {
  const { type, text, firstPosition } = entity;

  // Early introduction = stronger recommendation to fulfill
  // Late introduction = more likely to just demote
  const isEarly = firstPosition < 0.3;

  if (type === 'PERSON') {
    if (isEarly) {
      return {
        entity,
        suggestionType: 'FULFILL',
        rationale: `Character "${text}" is introduced but never returns. Either reference them in the conclusion or have another character mention them.`,
        example: `Add later: "She thought of ${text}—wondered if they'd made it through."`
      };
    } else {
      return {
        entity,
        suggestionType: 'DEMOTE',
        rationale: `Character "${text}" appears once without payoff. Consider making them unnamed ("a stranger", "the clerk").`,
        example: `Replace "${text}" with a generic descriptor.`
      };
    }
  }

  if (type === 'LOCATION') {
    if (isEarly) {
      return {
        entity,
        suggestionType: 'FULFILL',
        rationale: `Location "${text}" is specifically named but never becomes significant. Reference it in the resolution or use it for contrast.`,
        example: `Add: "Back on ${text}, everything had changed—or maybe she had."`
      };
    } else {
      return {
        entity,
        suggestionType: 'DEMOTE',
        rationale: `"${text}" is named but doesn't need to be. Generic location ("the glacier", "the street") would work here.`,
        example: `Replace specific location with generic descriptor.`
      };
    }
  }

  if (type === 'TIME') {
    return {
      entity,
      suggestionType: 'REMOVE',
      rationale: `Specific time "${text}" creates expectation but is never referenced again. Remove precision unless it matters.`,
      example: `Replace "at ${text}" with "that evening" or similar.`
    };
  }

  // Default
  return {
    entity,
    suggestionType: isEarly ? 'FULFILL' : 'DEMOTE',
    rationale: `"${text}" is introduced with specificity but doesn't pay off. ${isEarly ? 'Add a callback' : 'Make it generic'}.`
  };
}

// ============================================================
// Utility: Analyze text directly
// ============================================================

/**
 * Convenience function to analyze text directly.
 */
export function analyzeText(
  text: string,
  config: V3Config = DEFAULT_CONFIG
): ChekhovAnalysis {
  // Split into sentences
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);

  const entities = extractEntities(sentences, config);
  return analyzeChekhovRatio(entities, config);
}

/**
 * Get a summary string for quick display.
 */
export function getChekhovSummary(analysis: ChekhovAnalysis): string {
  const { chekhovRatio, chekhovGrade, fulfilledCount, orphanedCount, totalEntities } = analysis;

  const ratio = (chekhovRatio * 100).toFixed(0);
  const grade = chekhovGrade.replace('_', ' ').toLowerCase();

  return `Chekhov Ratio: ${ratio}% (${grade}) - ${fulfilledCount} fulfilled, ${orphanedCount} orphaned of ${totalEntities} entities`;
}
