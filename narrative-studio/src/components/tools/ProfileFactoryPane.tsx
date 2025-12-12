/**
 * ProfileFactoryPane - Create custom transformation profiles from sample text
 *
 * Flow:
 * 1. User loads text into workspace buffer (uses standard buffer system)
 * 2. LLM analyzes voice markers (sentence structure, vocabulary, tone)
 * 3. User previews and optionally edits the generated prompt
 * 4. User tests the profile with sample transformation
 * 5. User saves the profile for future use
 *
 * Access:
 * - Local (Ollama): Available to all users
 * - Cloud (Cloudflare): Available to pro/premium/admin tiers
 */

import { useState, useCallback, useMemo } from 'react';
import { useProvider } from '../../contexts/ProviderContext';
import { useAuth } from '../../contexts/AuthContext';
import { generate } from '../../services/ollamaService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev';

// Cloud extraction API call
// Available to paid tiers (pro, premium, admin)
async function extractViaCloud(
  text: string,
  type: 'style' | 'persona',
  token: string,
  isAdmin: boolean
): Promise<{
  analysis: string;
  profile: string;
  transformationPrompt: string;
  model: string;
}> {
  // Use admin endpoint for admins (can publish globally), user endpoint for paid users
  const endpoint = isAdmin
    ? `${API_BASE_URL}/admin/profiles/extract`
    : `${API_BASE_URL}/profiles/extract`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ text, type }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Cloud extraction failed');
  }

  return response.json();
}

// Text adequacy assessment criteria
interface TextAdequacyResult {
  isAdequate: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    charCount: number;
    wordCount: number;
    sentenceCount: number;
    avgSentenceLength: number;
    uniqueWordRatio: number;
  };
}

function assessTextAdequacy(text: string, profileType: 'style' | 'persona'): TextAdequacyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic stats
  const charCount = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Unique word ratio (vocabulary diversity)
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
  const uniqueWordRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0;

  const stats = { charCount, wordCount, sentenceCount, avgSentenceLength, uniqueWordRatio };

  // Minimum requirements
  if (charCount < 500) {
    errors.push(`Text too short (${charCount} chars). Need at least 500 characters for reliable extraction.`);
  }
  if (wordCount < 100) {
    errors.push(`Too few words (${wordCount}). Need at least 100 words.`);
  }
  if (sentenceCount < 5) {
    errors.push(`Too few sentences (${sentenceCount}). Need at least 5 complete sentences.`);
  }

  // Profile-type specific requirements
  if (profileType === 'style') {
    // Style extraction needs varied sentence patterns
    if (avgSentenceLength < 8) {
      warnings.push('Sentences are very short. Style extraction works better with varied sentence lengths.');
    }
    if (uniqueWordRatio < 0.3) {
      warnings.push('Low vocabulary diversity. Consider a sample with richer vocabulary.');
    }
  } else {
    // Persona extraction needs enough context to infer worldview
    if (wordCount < 200) {
      warnings.push('For persona extraction, 200+ words helps capture epistemic stance better.');
    }
    // Check for first/third person consistency
    const firstPerson = (text.match(/\b(I|me|my|mine|myself)\b/gi) || []).length;
    const thirdPerson = (text.match(/\b(he|she|they|him|her|them|his|hers|their)\b/gi) || []).length;
    if (firstPerson === 0 && thirdPerson === 0) {
      warnings.push('No clear narrative voice detected. Ensure the text has a consistent perspective.');
    }
  }

  // Quality warnings
  if (charCount > 10000) {
    warnings.push('Text is quite long. First 3000 characters will be used for extraction.');
  }

  // Check for dialogue-heavy text
  const dialogueMarkers = (text.match(/["'"]/g) || []).length;
  if (dialogueMarkers > wordCount * 0.05) {
    warnings.push('Text appears dialogue-heavy. Narrative prose works better for extraction.');
  }

  return {
    isAdequate: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

// Inline icons
const Wand = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/>
    <path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>
  </svg>
);

const Play = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const Save = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);

const Trash = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const Globe = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// Styles matching ToolPanes.tsx
const runButtonStyle = {
  width: '100%',
  backgroundImage: 'var(--accent-primary-gradient)',
  backgroundColor: 'transparent',
  color: 'var(--text-inverse)',
  padding: '10px 12px',
  fontSize: '0.875rem',
  minHeight: '40px',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const secondaryButtonStyle = {
  ...runButtonStyle,
  backgroundImage: 'none',
  backgroundColor: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
};

const labelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const textareaStyle = {
  width: '100%',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  padding: '8px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  resize: 'vertical' as const,
  minHeight: '100px',
};

const inputStyle = {
  width: '100%',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8125rem',
};

// Storage key for custom profiles
const CUSTOM_PROFILES_KEY = 'custom-transformation-profiles';

export interface CustomProfile {
  id: string;
  name: string;
  type: 'persona' | 'style';
  prompt: string;
  sourceExcerpt: string;  // First 200 chars of source for reference
  analysisNotes: string;
  createdAt: string;
}

// Style extraction prompt - focuses on HOW the narrator tells events
const STYLE_EXTRACTION_PROMPT = `You are a literary style analyst. Your task is to extract the distinctive WRITING STYLE from this text sample—not the narrator's identity, worldview, or values, but the mechanical and aesthetic patterns of how language is deployed.

═══════════════════════════════════════════════════════════════════════════════
WHAT STYLE IS (analyze these)
═══════════════════════════════════════════════════════════════════════════════

SENTENCE ARCHITECTURE:
• Average sentence length (short <15 words / medium 15-25 / long 25+)
• Sentence variety (uniform vs high variation)
• Clause complexity (simple / compound / complex / periodic)
• Fragment usage (none / occasional / frequent)
• Punctuation patterns (semicolon chains, em-dashes, parentheticals)

LEXICAL REGISTER:
• Formality level (colloquial / neutral / formal / archaic)
• Vocabulary density (common words vs specialized/rare)
• Latinate vs Anglo-Saxon word preference
• Contractions (frequent / occasional / avoided)

FIGURATIVE LANGUAGE:
• Metaphor/simile density (sparse / moderate / dense)
• Preferred image domains (nature, domestic, industrial, abstract, etc.)
• Personification tendency
• Sound devices (alliteration, assonance—light use or heavy)

RHETORICAL PATTERNS:
• Direct address rate (does the prose address "you"?)
• Rhetorical questions (none / occasional / frequent)
• Parallelism and anaphora
• Repetition for emphasis

PACING & RHYTHM:
• Scene vs summary ratio
• Dialogue integration style (tagged, untagged, embedded)
• Paragraph length tendency
• Transitional phrase patterns ("however" / "and so" / minimal)

═══════════════════════════════════════════════════════════════════════════════
WHAT STYLE IS NOT (do not analyze these—they belong to PERSONA)
═══════════════════════════════════════════════════════════════════════════════

❌ The narrator's beliefs about the world
❌ What the narrator notices or finds important
❌ The narrator's moral stance or values
❌ Why the narrator is telling the story
❌ The narrator's relationship to the reader
❌ The narrator's expertise or knowledge domain

═══════════════════════════════════════════════════════════════════════════════
TEXT TO ANALYZE:
═══════════════════════════════════════════════════════════════════════════════
{TEXT}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════════

STYLE ANALYSIS:
[2-3 sentences summarizing the dominant style characteristics]

STYLE PROFILE:
- Sentence pattern: [describe]
- Register: [colloquial/neutral/formal/archaic]
- Figurative density: [sparse/moderate/dense]
- Rhetorical signature: [key devices used]
- Pacing: [describe rhythm and flow]

TRANSFORMATION PROMPT:
[Write a concise prompt that captures ONLY the style mechanics. Start with "Apply this writing style:" and focus on sentence patterns, register, and rhythm. Do NOT include persona elements like worldview, values, or narrator identity.]

IMPORTANT: End the prompt with this vocabulary rule:
"VOCABULARY RULE: Keep all specific nouns, names, and key terms from the original. Transform sentence structure and hedging style only."`;

// Persona extraction prompt - focuses on WHO is speaking
const PERSONA_EXTRACTION_PROMPT = `You are a narrative voice analyst specializing in narrator characterization. Your task is to extract the distinctive PERSONA from this text—not the writing style (sentence patterns, vocabulary choices), but the narrator's identity as a perceiving, knowing, valuing entity.

A persona is a stable epistemic operator: it determines WHO perceives, WHAT counts as salient, WHAT is taken for granted, and HOW uncertainty is handled.

═══════════════════════════════════════════════════════════════════════════════
THE 5-LAYER PERSONA STACK (analyze each)
═══════════════════════════════════════════════════════════════════════════════

LAYER 1: ONTOLOGICAL POSITION
What kind of world does this narrator believe they inhabit?
• Is the world orderly, chaotic, tragic, improvable, absurd?
• Are systems primary, or individuals?
• Is meaning discovered, constructed, or illusory?
• Is change possible, or are things fixed?

LAYER 2: EPISTEMIC STANCE (most important)
How does this narrator come to know things?
• Observer vs participant vs analyst?
• High certainty vs comfortable with doubt?
• Explains causes or describes phenomena?
• Judges quickly, delays judgment, or suspends it entirely?
• Trusts evidence, intuition, authority, or experience?

LAYER 3: ATTENTION & SALIENCE MODEL
What does this narrator naturally notice? What do they ignore?
• Objects vs people vs systems vs symbols?
• Sensory details vs abstract concepts vs procedures?
• What is "background noise" to them?
• What do they linger on? What do they skip past?

LAYER 4: NORMATIVE BIAS
What does this narrator implicitly approve, disapprove, or normalize?
(This should be IMPLICIT, not preachy)
• What is admirable to them?
• What is regrettable but inevitable?
• What is invisible because it's "normal"?
• What provokes their skepticism?

LAYER 5: RELATIONSHIP TO READER
Why is this narrator telling the story at all?
• Instructing, witnessing, confessing, recording, persuading, entertaining?
• Do they assume the reader shares their values?
• Do they explain, or let events stand?
• Intimate or formal distance?

═══════════════════════════════════════════════════════════════════════════════
WHAT PERSONA IS NOT (do not analyze these—they belong to STYLE)
═══════════════════════════════════════════════════════════════════════════════

❌ Sentence length and structure
❌ Vocabulary register (formal/informal word choices)
❌ Figurative language density
❌ Punctuation patterns
❌ Paragraph rhythm
❌ Rhetorical devices (parallelism, anaphora)

═══════════════════════════════════════════════════════════════════════════════
TEXT TO ANALYZE:
═══════════════════════════════════════════════════════════════════════════════
{TEXT}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════════

PERSONA ANALYSIS:
[2-3 sentences capturing WHO this narrator is as a mind]

THE 5 LAYERS:
1. Ontology: [what world do they inhabit?]
2. Epistemics: [how do they know? certainty level? judgment speed?]
3. Attention: [what do they notice first? what's invisible to them?]
4. Values: [implicit approvals/disapprovals—not stated, shown]
5. Reader contract: [why tell this? what's the reader's role?]

TRANSFORMATION PROMPT:
[Write a persona prompt that captures the narrator's MIND, not their style. Start with "Adopt the perspective of a narrator who..." and describe their worldview, how they know things, what they notice, and their relationship to the reader. Do NOT include style elements like sentence patterns or vocabulary choices.]

IMPORTANT: End the prompt with this vocabulary rule:
"VOCABULARY RULE: Keep all specific nouns, verbs, names, and key terms from the original. Only change the FRAMING and PERSPECTIVE, not the vocabulary."`;

interface ProfileFactoryPaneProps {
  content: string;  // Content from workspace buffer - PRIMARY source
}

// Helper to check if user has paid tier access
function canUseCloudExtraction(role: string | undefined): boolean {
  return ['pro', 'premium', 'admin'].includes(role || 'free');
}

export function ProfileFactoryPane({ content }: ProfileFactoryPaneProps) {
  const { isLocalAvailable } = useProvider();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canUseCloud = canUseCloudExtraction(user?.role);

  // Step tracking
  const [step, setStep] = useState<'input' | 'analyze' | 'edit' | 'test' | 'save'>('input');
  const [isPublishing, setIsPublishing] = useState(false);

  // Input state - now uses content from buffer, not paste
  const [profileName, setProfileName] = useState('');
  const [profileType, setProfileType] = useState<'persona' | 'style'>('persona');

  // Text adequacy assessment (computed from buffer content)
  const textAdequacy = useMemo(
    () => assessTextAdequacy(content, profileType),
    [content, profileType]
  );

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Test state
  const [isTesting, setIsTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');

  // Saved profiles
  const [savedProfiles, setSavedProfiles] = useState<CustomProfile[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_PROFILES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Analyze text to extract style or persona
  const handleAnalyze = useCallback(async () => {
    if (!content.trim()) {
      setError('Load sample text into the workspace buffer first');
      return;
    }

    // Run text adequacy assessment
    if (!textAdequacy.isAdequate) {
      setError(textAdequacy.errors.join(' '));
      return;
    }

    // Determine which provider to use
    // BUG FIX: Only check isLocalAvailable (actual connectivity), not useOllamaForLocal (user setting)
    const canUseLocal = isLocalAvailable;
    const token = localStorage.getItem('narrative-studio-auth-token') || localStorage.getItem('post-social:token');
    const hasCloudAccess = canUseCloud && token;

    if (!canUseLocal && !hasCloudAccess) {
      const tierMsg = canUseCloud
        ? 'Please sign in to use cloud extraction.'
        : 'Upgrade to Pro tier for cloud extraction, or run local Ollama.';
      setError(`No extraction provider available. ${tierMsg}`);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setStep('analyze');

    try {
      let response: string;

      if (canUseLocal) {
        // Use local Ollama
        const extractionPrompt = profileType === 'style'
          ? STYLE_EXTRACTION_PROMPT
          : PERSONA_EXTRACTION_PROMPT;

        const prompt = extractionPrompt.replace('{TEXT}', content.substring(0, 3000));

        const systemPrompt = profileType === 'style'
          ? 'You are an expert literary style analyst. Extract writing mechanics precisely—sentence patterns, register, figurative language, pacing. Do NOT analyze the narrator\'s worldview or values.'
          : 'You are an expert narrative voice analyst. Extract the narrator\'s epistemic stance and worldview—how they know, what they notice, what they value. Do NOT analyze sentence patterns or vocabulary choices.';

        response = await generate(prompt, {
          temperature: 0.7,
          system: systemPrompt,
        });
      } else {
        // Use cloud extraction (paid tier)
        const cloudResult = await extractViaCloud(content, profileType, token!, isAdmin);
        // Combine analysis and profile for display
        const combinedNotes = cloudResult.analysis + '\n\n' + cloudResult.profile;
        setAnalysisNotes(combinedNotes || `${profileType === 'style' ? 'Style' : 'Persona'} analysis complete (via ${cloudResult.model})`);
        setGeneratedPrompt(cloudResult.transformationPrompt);
        setStep('edit');
        return;
      }

      // Parse response based on profile type
      if (profileType === 'style') {
        // Parse STYLE ANALYSIS and TRANSFORMATION PROMPT
        const analysisMatch = response.match(/STYLE ANALYSIS:\s*([\s\S]*?)(?=STYLE PROFILE:|TRANSFORMATION PROMPT:|$)/i);
        const profileMatch = response.match(/STYLE PROFILE:\s*([\s\S]*?)(?=TRANSFORMATION PROMPT:|$)/i);
        const promptMatch = response.match(/TRANSFORMATION PROMPT:\s*([\s\S]*?)$/i);

        // Combine analysis and profile for notes
        let notes = '';
        if (analysisMatch) notes += analysisMatch[1].trim();
        if (profileMatch) notes += '\n\n' + profileMatch[1].trim();
        setAnalysisNotes(notes || 'Style analysis not available');

        if (promptMatch) {
          let extracted = promptMatch[1].trim();
          // Ensure it starts correctly
          if (!extracted.toLowerCase().startsWith('apply')) {
            extracted = 'Apply this writing style: ' + extracted;
          }
          // Add vocabulary preservation rule (key improvement from Opus vs Qwen testing)
          extracted += '\n\nVOCABULARY RULE: Keep all specific nouns, names, and key terms from the original. Transform sentence structure and hedging style only.';
          extracted += '\n\nCRITICAL: Preserve ALL factual content. Transform ONLY the writing style mechanics.';
          setGeneratedPrompt(extracted);
        } else {
          setGeneratedPrompt('Apply this writing style: Use the sentence patterns, register, and rhythm identified in the analysis.\n\nVOCABULARY RULE: Keep all specific nouns and names from the original.\n\nCRITICAL: Preserve all factual content.');
        }
      } else {
        // Parse PERSONA ANALYSIS, THE 5 LAYERS, and TRANSFORMATION PROMPT
        const analysisMatch = response.match(/PERSONA ANALYSIS:\s*([\s\S]*?)(?=THE 5 LAYERS:|TRANSFORMATION PROMPT:|$)/i);
        const layersMatch = response.match(/THE 5 LAYERS:\s*([\s\S]*?)(?=TRANSFORMATION PROMPT:|$)/i);
        const promptMatch = response.match(/TRANSFORMATION PROMPT:\s*([\s\S]*?)$/i);

        // Combine analysis and layers for notes
        let notes = '';
        if (analysisMatch) notes += analysisMatch[1].trim();
        if (layersMatch) notes += '\n\n' + layersMatch[1].trim();
        setAnalysisNotes(notes || 'Persona analysis not available');

        if (promptMatch) {
          let extracted = promptMatch[1].trim();
          // Ensure it starts correctly
          if (!extracted.toLowerCase().startsWith('adopt')) {
            extracted = 'Adopt the perspective of a narrator who ' + extracted;
          }
          // Add vocabulary preservation rule (key improvement from Opus vs Qwen testing)
          extracted += '\n\nVOCABULARY RULE: Keep all specific nouns, verbs, names, and key terms from the original. Only change the FRAMING and PERSPECTIVE, not the vocabulary.';
          extracted += '\n\nCRITICAL: Preserve ALL factual content and writing mechanics. Transform ONLY the epistemic stance.';
          setGeneratedPrompt(extracted);
        } else {
          setGeneratedPrompt('Adopt the perspective of a narrator with the worldview and attention patterns identified in the analysis.\n\nVOCABULARY RULE: Keep all specific nouns and key terms from the original.\n\nCRITICAL: Preserve all factual content and events.');
        }
      }

      setStep('edit');
    } catch (err) {
      console.error('Profile extraction failed:', err);
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setStep('input');
    } finally {
      setIsAnalyzing(false);
    }
  }, [content, profileType, isLocalAvailable, canUseCloud, isAdmin, textAdequacy]);

  // Test the profile with sample text
  const handleTest = useCallback(async () => {
    const textToTest = testInput.trim() || content.trim();
    if (!textToTest) {
      setError('Enter test text or load content from archive');
      return;
    }

    if (!generatedPrompt.trim()) {
      setError('No prompt to test');
      return;
    }

    setIsTesting(true);
    setError(null);
    setStep('test');

    try {
      const prompt = `${generatedPrompt}

Original text to transform:
---
${textToTest}
---

Transformed text:`;

      const response = await generate(prompt, {
        temperature: 0.7,
        system: 'You are a text transformation tool. Output ONLY the transformed text, no explanations.',
      });

      // Strip any preamble
      let cleaned = response.trim();
      if (cleaned.toLowerCase().startsWith('here')) {
        const firstNewline = cleaned.indexOf('\n');
        if (firstNewline > 0 && firstNewline < 100) {
          cleaned = cleaned.substring(firstNewline + 1).trim();
        }
      }

      setTestOutput(cleaned);
    } catch (err) {
      console.error('Test transformation failed:', err);
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setIsTesting(false);
    }
  }, [testInput, content, generatedPrompt]);

  // Save the profile
  const handleSave = useCallback(() => {
    if (!profileName.trim()) {
      setError('Please enter a profile name');
      return;
    }

    if (!generatedPrompt.trim()) {
      setError('No prompt to save');
      return;
    }

    // Create profile ID from name
    const id = profileName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Check for duplicates
    if (savedProfiles.some(p => p.id === id)) {
      setError(`Profile "${profileName}" already exists`);
      return;
    }

    const newProfile: CustomProfile = {
      id,
      name: profileName.trim(),
      type: profileType,
      prompt: generatedPrompt,
      sourceExcerpt: content.substring(0, 200),
      analysisNotes,
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedProfiles, newProfile];
    setSavedProfiles(updated);
    localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(updated));

    setStep('save');
    setError(null);

    // Reset form after a delay (buffer content managed externally)
    setTimeout(() => {
      setProfileName('');
      setAnalysisNotes('');
      setGeneratedPrompt('');
      setTestInput('');
      setTestOutput('');
      setStep('input');
    }, 2000);
  }, [profileName, profileType, generatedPrompt, content, analysisNotes, savedProfiles]);

  // Delete a saved profile
  const handleDelete = useCallback((id: string) => {
    const updated = savedProfiles.filter(p => p.id !== id);
    setSavedProfiles(updated);
    localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(updated));
  }, [savedProfiles]);

  // Publish profile globally (admin only)
  const handlePublishGlobal = useCallback(async () => {
    if (!isAdmin) {
      setError('Admin access required');
      return;
    }

    if (!profileName.trim()) {
      setError('Please enter a profile name');
      return;
    }

    if (!generatedPrompt.trim()) {
      setError('No prompt to publish');
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const token = localStorage.getItem('narrative-studio-auth-token') ||
                    localStorage.getItem('post-social:token');

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Create profile ID from name
      const id = profileName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      // Determine endpoint based on profile type
      const endpoint = profileType === 'persona'
        ? `${API_BASE_URL}/admin/profiles/personas`
        : `${API_BASE_URL}/admin/profiles/styles`;

      const body = profileType === 'persona'
        ? {
            name: id,
            description: `${profileName} - ${analysisNotes.substring(0, 100)}...`,
            system_prompt: generatedPrompt,
            status: 'active', // Publish as active
          }
        : {
            name: id,
            style_prompt: generatedPrompt,
            status: 'active',
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Publish failed');
      }

      setStep('save');

      // Reset form after a delay (buffer content managed externally)
      setTimeout(() => {
        setProfileName('');
        setAnalysisNotes('');
        setGeneratedPrompt('');
        setTestInput('');
        setTestOutput('');
        setStep('input');
      }, 2000);
    } catch (err) {
      console.error('Publish global failed:', err);
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  }, [isAdmin, profileName, profileType, generatedPrompt, analysisNotes]);

  // Reset to start
  const handleReset = useCallback(() => {
    setProfileName('');
    setAnalysisNotes('');
    setGeneratedPrompt('');
    setTestInput('');
    setTestOutput('');
    setError(null);
    setStep('input');
  }, []);

  return (
    <div style={{ padding: '12px' }}>
      {/* Step indicator */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '12px',
        fontSize: '0.625rem',
        color: 'var(--text-tertiary)',
      }}>
        {['input', 'analyze', 'edit', 'test', 'save'].map((s, i) => (
          <span
            key={s}
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: step === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: step === s ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              textTransform: 'uppercase',
            }}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {/* Step: Input - shows buffer status and adequacy assessment */}
      {(step === 'input' || step === 'analyze') && (
        <>
          {/* Buffer Content Status */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Source Text (from Workspace Buffer)</label>
            <div style={{
              padding: '8px',
              backgroundColor: content.trim() ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: content.trim() ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
              minHeight: '60px',
            }}>
              {content.trim() ? (
                <>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    maxHeight: '80px',
                    overflow: 'hidden',
                    marginBottom: '6px',
                  }}>
                    {content.substring(0, 300)}
                    {content.length > 300 && '...'}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '0.625rem',
                    color: 'var(--text-tertiary)',
                  }}>
                    <span>{textAdequacy.stats.charCount.toLocaleString()} chars</span>
                    <span>{textAdequacy.stats.wordCount.toLocaleString()} words</span>
                    <span>{textAdequacy.stats.sentenceCount} sentences</span>
                  </div>
                </>
              ) : (
                <div style={{
                  color: 'var(--text-tertiary)',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  padding: '12px 0',
                }}>
                  Load sample text into the workspace to extract a profile.
                  <br />
                  <span style={{ fontSize: '0.625rem' }}>
                    Use archive, import, or paste text in the editor.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Text Adequacy Assessment */}
          {content.trim() && (
            <div style={{ marginBottom: '12px' }}>
              {/* Errors */}
              {textAdequacy.errors.length > 0 && (
                <div style={{
                  padding: '6px 8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem',
                  color: 'var(--error)',
                  marginBottom: '6px',
                }}>
                  {textAdequacy.errors.map((err, i) => (
                    <div key={i}>⚠️ {err}</div>
                  ))}
                </div>
              )}
              {/* Warnings */}
              {textAdequacy.warnings.length > 0 && (
                <div style={{
                  padding: '6px 8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem',
                  color: 'var(--warning)',
                  marginBottom: '6px',
                }}>
                  {textAdequacy.warnings.map((warn, i) => (
                    <div key={i}>💡 {warn}</div>
                  ))}
                </div>
              )}
              {/* Success indicator */}
              {textAdequacy.isAdequate && textAdequacy.warnings.length === 0 && (
                <div style={{
                  padding: '6px 8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem',
                  color: 'var(--success)',
                }}>
                  ✓ Text is adequate for {profileType} extraction
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Profile Name</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g., darwin_naturalist"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Profile Type</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={profileType === 'persona'}
                  onChange={() => setProfileType('persona')}
                />
                Persona
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={profileType === 'style'}
                  onChange={() => setProfileType('style')}
                />
                Style
              </label>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              {profileType === 'persona'
                ? 'Persona = WHO is speaking. Extracts worldview, epistemic stance, attention patterns, values, and reader relationship.'
                : 'Style = HOW they speak. Extracts sentence patterns, vocabulary register, figurative language, and pacing.'}
            </div>
          </div>

          {/* Provider indicator */}
          <div style={{
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
            marginBottom: '6px',
            textAlign: 'center',
          }}>
            {isLocalAvailable ? '🖥️ Local (Ollama)' : canUseCloud ? '☁️ Cloud (Cloudflare)' : '⚠️ No provider'}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !content.trim() || !textAdequacy.isAdequate}
            style={{
              ...runButtonStyle,
              opacity: isAnalyzing || !content.trim() || !textAdequacy.isAdequate ? 0.5 : 1,
              cursor: isAnalyzing || !content.trim() || !textAdequacy.isAdequate ? 'not-allowed' : 'pointer',
            }}
          >
            {isAnalyzing ? (
              <>⏳ Extracting {profileType === 'style' ? 'Style' : 'Persona'}...</>
            ) : (
              <><Wand size={16} /> Extract {profileType === 'style' ? 'Style' : 'Persona'}</>
            )}
          </button>
        </>
      )}

      {/* Step: Edit generated prompt */}
      {(step === 'edit' || step === 'test') && (
        <>
          {/* Analysis Notes (read-only) */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{profileType === 'style' ? 'Style Analysis' : 'Persona Analysis (5 Layers)'}</label>
            <div style={{
              padding: '8px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              {analysisNotes || 'No analysis available'}
            </div>
          </div>

          {/* Editable Prompt */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{profileType === 'style' ? 'Style Prompt' : 'Persona Prompt'} (editable)</label>
            <textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              style={{ ...textareaStyle, minHeight: '120px' }}
              rows={6}
            />
          </div>

          {/* Test Input */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Test Text (optional)</label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder={content ? 'Using content from buffer...' : 'Enter text to test transformation...'}
              style={{ ...textareaStyle, minHeight: '60px' }}
              rows={3}
            />
          </div>

          {/* Test button */}
          <button
            onClick={handleTest}
            disabled={isTesting || (!testInput.trim() && !content.trim())}
            style={{
              ...secondaryButtonStyle,
              marginBottom: '8px',
              opacity: isTesting || (!testInput.trim() && !content.trim()) ? 0.5 : 1,
              cursor: isTesting || (!testInput.trim() && !content.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {isTesting ? (
              <>⏳ Testing...</>
            ) : (
              <><Play size={14} /> Test Transformation</>
            )}
          </button>

          {/* Test Output */}
          {testOutput && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Test Output</label>
              <div style={{
                padding: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                maxHeight: '150px',
                overflow: 'auto',
              }}>
                {testOutput}
              </div>
            </div>
          )}

          {/* Save buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              onClick={handleSave}
              disabled={!profileName.trim() || !generatedPrompt.trim()}
              style={{
                ...runButtonStyle,
                flex: 1,
                opacity: !profileName.trim() || !generatedPrompt.trim() ? 0.5 : 1,
                cursor: !profileName.trim() || !generatedPrompt.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={14} /> Save Local
            </button>

            {/* Admin-only: Publish Global button */}
            {isAdmin && (
              <button
                onClick={handlePublishGlobal}
                disabled={isPublishing || !profileName.trim() || !generatedPrompt.trim()}
                title="Publish to all users (Admin only)"
                style={{
                  ...runButtonStyle,
                  flex: 1,
                  backgroundImage: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  opacity: isPublishing || !profileName.trim() || !generatedPrompt.trim() ? 0.5 : 1,
                  cursor: isPublishing || !profileName.trim() || !generatedPrompt.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isPublishing ? (
                  <>⏳ Publishing...</>
                ) : (
                  <><Globe size={14} /> Publish Global</>
                )}
              </button>
            )}
          </div>

          {/* Reset link */}
          <button
            onClick={handleReset}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
            }}
          >
            Start Over
          </button>
        </>
      )}

      {/* Step: Save confirmation */}
      {step === 'save' && (
        <div style={{
          padding: '16px',
          textAlign: 'center',
          color: 'var(--success)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
          <div style={{ fontWeight: 600 }}>Profile Saved!</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            "{profileName}" is now available in {profileType === 'persona' ? 'Personas' : 'Styles'}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          marginTop: '8px',
          padding: '6px 8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--error)',
          fontSize: '0.6875rem',
        }}>
          {error}
        </div>
      )}

      {/* Saved Profiles List */}
      {savedProfiles.length > 0 && step === 'input' && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <label style={labelStyle}>Your Custom Profiles ({savedProfiles.length})</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {savedProfiles.map(profile => (
              <div
                key={profile.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{profile.name}</span>
                  <span style={{ marginLeft: '8px', color: 'var(--text-tertiary)', fontSize: '0.625rem' }}>
                    {profile.type}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(profile.id)}
                  title="Delete profile"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export helper to get custom profiles
export function getCustomProfiles(): CustomProfile[] {
  try {
    const stored = localStorage.getItem(CUSTOM_PROFILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default ProfileFactoryPane;
