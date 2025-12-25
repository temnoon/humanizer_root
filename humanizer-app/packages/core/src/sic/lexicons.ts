/**
 * SIC Detection Lexicons
 *
 * Pattern libraries for detecting SIC signals without LLM.
 * These are heuristic indicators, not definitive classifiers.
 */

/**
 * P1: Irreversibility / Commitment markers
 * "I decided / I did / I will / I can't undo / it cost"
 */
export const IRREVERSIBILITY_PATTERNS = [
  // Commitment verbs
  /\b(I|we)\s+(decided|committed|chose|resolved|determined)\b/gi,
  /\b(I|we)\s+(did|made|took)\s+(the|a)\s+(decision|choice|commitment)\b/gi,

  // Irreversibility markers
  /\bcan('?t|not)\s+(undo|take back|reverse|unsay)\b/gi,
  /\b(no|never)\s+(going|turning)\s+back\b/gi,
  /\birreversible|irretrievable|permanent(ly)?\b/gi,

  // Consequence acknowledgment
  /\bit\s+cost\s+(me|us)\b/gi,
  /\b(paid|suffered)\s+(the|a)\s+(price|consequence)\b/gi,
  /\bconsequences?\s+(of|from)\s+(my|our)\b/gi,

  // Finality
  /\bthat('?s| is)\s+(it|done|final|over)\b/gi,
  /\bno\s+way\s+(back|out)\b/gi,
];

/**
 * P2: Temporal Pressure & Sequencing markers
 * Urgency, deadlines, "before I could," "in the moment"
 */
export const TEMPORAL_PRESSURE_PATTERNS = [
  // Urgency
  /\b(suddenly|immediately|instantly|abruptly)\b/gi,
  /\bbefore\s+(I|we)\s+(could|had|knew)\b/gi,
  /\b(too|so)\s+late\b/gi,

  // In-the-moment
  /\bin\s+th(at|e)\s+moment\b/gi,
  /\bright\s+then\b/gi,
  /\bas\s+(it|this)\s+was\s+happening\b/gi,

  // Deadlines
  /\b(deadline|time\s+ran\s+out|running\s+out\s+of\s+time)\b/gi,
  /\bhad\s+to\s+(decide|choose|act)\s+(now|immediately|quickly)\b/gi,

  // Temporal asymmetry
  /\bafterward(s)?\s*(I|we)\s+(realized|understood|saw)\b/gi,
  /\blooking\s+back\b/gi,
  /\bat\s+the\s+time\s*,?\s*(I|we)\s+(didn'?t|couldn'?t)\b/gi,
];

/**
 * P3: Epistemic Incompleteness - Lived, Not Hedged
 * Being wrong, surprises, misreadings
 */
export const EPISTEMIC_INCOMPLETENESS_PATTERNS = [
  // Being wrong
  /\bI\s+(was|had\s+been)\s+wrong\b/gi,
  /\bturns?\s+out\s+(I|we)\b/gi,
  /\b(I|we)\s+(didn'?t|couldn'?t)\s+(know|see|realize|understand)\b/gi,

  // Surprises
  /\b(surprised|shocked|stunned)\s+(me|us|to)\b/gi,
  /\bunexpected(ly)?\b/gi,
  /\b(I|we)\s+never\s+(thought|expected|imagined)\b/gi,

  // Misreadings corrected
  /\bI\s+thought\s+.{5,50}\s+but\b/gi,
  /\bI\s+assumed\b/gi,
  /\b(I|we)\s+(misunderstood|misjudged|misread)\b/gi,

  // Genuine uncertainty (not decorative hedging)
  /\bI\s+(still\s+)?(don'?t|didn'?t)\s+(know|understand)\s+(what|why|how)\b/gi,
];

/**
 * P4: Value Tradeoffs & Sacrifice
 * Explicit "X over Y" with acknowledged loss
 */
export const VALUE_TRADEOFF_PATTERNS = [
  // Explicit tradeoffs
  /\b(chose|picked|selected)\s+.{3,30}\s+(over|instead\s+of|rather\s+than)\b/gi,
  /\b(had\s+to\s+)?(sacrifice|give\s+up|let\s+go\s+of)\b/gi,
  /\bat\s+the\s+(expense|cost)\s+of\b/gi,

  // Acknowledged loss
  /\b(lost|gave\s+up|abandoned)\s+.{3,30}\s+(for|to)\b/gi,
  /\bworth\s+(it|the\s+(cost|sacrifice))\b/gi,
  /\b(couldn'?t|can'?t)\s+have\s+(both|it\s+all)\b/gi,

  // Moral tension that remains
  /\bstill\s+(feel|felt)\s+(guilty|conflicted|torn)\b/gi,
  /\bnot\s+sure\s+(if|whether)\s+(I|we)\s+(made|did)\s+the\s+right\b/gi,
];

/**
 * P5: Scar Tissue / Residue
 * Defensiveness, embarrassment, lingering regret
 */
export const SCAR_TISSUE_PATTERNS = [
  // Defensiveness
  /\b(I|we)\s+(shouldn'?t|should\s+not)\s+have\b/gi,
  /\bI\s+know\s+(it\s+)?(sounds?|seems?|looks?)\b/gi,
  /\b(don'?t|please\s+don'?t)\s+judge\b/gi,

  // Embarrassment
  /\b(embarrass(ed|ing)|ashamed|humiliat(ed|ing))\b/gi,
  /\b(I|we)\s+(hate|cringe)\s+(to\s+)?(admit|say|think)\b/gi,

  // Lingering regret
  /\bstill\s+(regret|haunts?|bothers?)\b/gi,
  /\b(can'?t|couldn'?t)\s+(forget|shake|get\s+over)\b/gi,
  /\bif\s+only\s+(I|we)\s+had\b/gi,

  // Awkwardness that persists
  /\b(awkward|uncomfortable|difficult)\s+to\s+(talk|think)\s+about\b/gi,
  /\beven\s+now\b/gi,
];

/**
 * P6: Situated Embodiment & Stakes
 * Body, place, social risk, consequences, friction
 */
export const EMBODIMENT_PATTERNS = [
  // Physical sensation
  /\b(my|our)\s+(heart|stomach|hands|chest|throat)\b/gi,
  /\b(felt|feeling)\s+(sick|nauseous|dizzy|shaky|cold|hot)\b/gi,
  /\bcouldn'?t\s+(breathe|move|speak|think)\b/gi,

  // Place anchoring
  /\bstanding\s+(there|in|at|outside)\b/gi,
  /\bsat\s+(there|down|in)\s+.{5,30}\s+(and|when|while)\b/gi,

  // Social stakes
  /\b(everyone|they|people)\s+(was|were)\s+(watching|looking|staring)\b/gi,
  /\bwhat\s+(would|will)\s+(they|people|everyone)\s+think\b/gi,
  /\b(reputation|relationship|friendship)\s+(on\s+the\s+line|at\s+stake|could)\b/gi,

  // Real consequences
  /\b(if|when)\s+(this|I|we)\s+(fail(ed|s)?|lose|lost)\b/gi,
  /\b(job|marriage|friendship|trust)\s+(was|is)\s+(on|at)\b/gi,
];

/**
 * N1: Resolution Without Cost
 * Conflict introduced → instantly harmonized
 */
export const RESOLUTION_WITHOUT_COST_PATTERNS = [
  // Instant resolution
  /\b(but|however)\s+(in\s+the\s+end|ultimately|finally)\s+(it\s+)?(all\s+)?(worked\s+out|was\s+fine|turned\s+out)\b/gi,
  /\b(everything|it\s+all)\s+(worked\s+out|turned\s+out\s+(fine|okay|well))\b/gi,

  // Reassurance after tension
  /\bdon'?t\s+worry.{0,20}(it|everything)\s+(will|is|was)\s+(be\s+)?(okay|fine|alright)\b/gi,

  // Magical resolution
  /\b(luckily|fortunately|thankfully)\s*,?\s*(everything|it\s+all)\b/gi,
];

/**
 * N2: Manager Voice / Expository Smoothing
 * "In conclusion / it is important / this suggests"
 */
export const MANAGER_VOICE_PATTERNS = [
  // Meta-exposition
  /\bin\s+conclusion\b/gi,
  /\bit\s+is\s+(important|worth|essential)\s+to\s+(note|mention|consider|remember)\b/gi,
  /\bthis\s+(suggests|implies|indicates|demonstrates|shows)\s+that\b/gi,

  // Generic frameworks
  /\b(key|main|important)\s+(takeaway|point|thing|lesson)\s+(is|here)\b/gi,
  /\blet('?s|us)\s+(explore|examine|consider|look\s+at)\b/gi,
  /\b(overall|in\s+summary|to\s+summarize)\b/gi,

  // Distancing language
  /\bone\s+(might|could|should|would)\s+(argue|say|think|consider)\b/gi,
  /\bit\s+is\s+(clear|evident|obvious|apparent)\s+that\b/gi,
];

/**
 * N3: Symmetry & Coverage Obsession
 * Enumerating all sides, all caveats
 */
export const SYMMETRY_COVERAGE_PATTERNS = [
  // Balanced hedging
  /\bon\s+(the\s+)?(one|the\s+other)\s+hand\b/gi,
  /\b(both|various|different|multiple)\s+(sides|perspectives|viewpoints|aspects)\b/gi,

  // Exhaustive enumeration
  /\b(first(ly)?|second(ly)?|third(ly)?|finally|lastly|additionally|furthermore|moreover)\b/gi,

  // Over-qualification
  /\b(although|while|whereas|that\s+said|having\s+said\s+that)\s*,?\s*(it\s+is\s+also|we\s+should\s+also|one\s+must\s+also)\b/gi,

  // Nuance signaling
  /\b(nuanced|balanced|fair|comprehensive)\s+(view|perspective|approach|analysis)\b/gi,
];

/**
 * N4: Generic Human Facsimile
 * Stock empathy lines; motivational filler
 */
export const GENERIC_FACSIMILE_PATTERNS = [
  // Stock empathy
  /\b(I|we)\s+(understand|know)\s+(how\s+)?(hard|difficult|challenging|tough)\s+(it|this|that)\s+(is|can\s+be|must\s+be)\b/gi,
  /\b(you'?re|you\s+are)\s+not\s+alone\b/gi,
  /\b(everyone|we\s+all)\s+(goes|go)\s+through\s+(this|these|hard\s+times)\b/gi,

  // Motivational filler
  /\b(believe\s+in\s+yourself|you\s+can\s+do\s+(it|this)|stay\s+strong)\b/gi,
  /\b(at\s+the\s+end\s+of\s+the\s+day|when\s+all\s+is\s+said\s+and\s+done)\b/gi,

  // Ornamental vividness
  /\b(beautiful|amazing|wonderful|incredible|extraordinary)\s+(journey|experience|moment|story)\b/gi,
  /\b(truly|deeply|profoundly)\s+(grateful|thankful|blessed|moved)\b/gi,
];
