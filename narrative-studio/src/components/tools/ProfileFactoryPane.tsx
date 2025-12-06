/**
 * ProfileFactoryPane - Create custom transformation profiles from sample text
 *
 * Flow:
 * 1. User pastes sample text (e.g., from Project Gutenberg)
 * 2. LLM analyzes voice markers (sentence structure, vocabulary, tone)
 * 3. User previews and optionally edits the generated prompt
 * 4. User tests the profile with sample transformation
 * 5. User saves the profile for future use
 */

import { useState, useCallback } from 'react';
import { useProvider } from '../../contexts/ProviderContext';
import { useAuth } from '../../contexts/AuthContext';
import { generate } from '../../services/ollamaService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://npe-api.tem-527.workers.dev';

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

// Voice analysis prompt
const VOICE_ANALYSIS_PROMPT = `Analyze the following text excerpt and create a transformation prompt that captures its distinctive voice.

Focus on:
1. Sentence structure (length, complexity, rhythm)
2. Vocabulary register (formal/informal, specialized terms)
3. Rhetorical devices (repetition, parallelism, irony)
4. Perspective and tone (authoritative, reflective, conversational)
5. Distinctive phrases or patterns

Output Format:
First, write 2-3 sentences describing the voice characteristics (ANALYSIS:).
Then, write a concise transformation prompt that an AI could use to rewrite text in this style (PROMPT:).

The prompt should:
- Be actionable (starts with "Rewrite..." or "Transform...")
- Focus on ADDING voice markers, not removing content
- Emphasize preserving all factual content and terminology

TEXT TO ANALYZE:
---
{TEXT}
---

ANALYSIS:`;

interface ProfileFactoryPaneProps {
  content: string;  // Content from buffer (optional use for testing)
}

export function ProfileFactoryPane({ content }: ProfileFactoryPaneProps) {
  const { isLocalAvailable, useOllamaForLocal } = useProvider();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Step tracking
  const [step, setStep] = useState<'input' | 'analyze' | 'edit' | 'test' | 'save'>('input');
  const [isPublishing, setIsPublishing] = useState(false);

  // Input state
  const [sampleText, setSampleText] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileType, setProfileType] = useState<'persona' | 'style'>('persona');

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

  // Analyze voice from sample text
  const handleAnalyze = useCallback(async () => {
    if (!sampleText.trim()) {
      setError('Please paste sample text to analyze');
      return;
    }

    if (sampleText.length < 200) {
      setError('Sample text should be at least 200 characters for reliable analysis');
      return;
    }

    if (!isLocalAvailable && !useOllamaForLocal) {
      setError('Ollama is required for voice analysis. Please start Ollama.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setStep('analyze');

    try {
      const prompt = VOICE_ANALYSIS_PROMPT.replace('{TEXT}', sampleText.substring(0, 3000));

      const response = await generate(prompt, {
        temperature: 0.7,
        system: 'You are an expert literary analyst. Analyze writing styles precisely and create actionable transformation prompts.',
      });

      // Parse response for ANALYSIS and PROMPT sections
      const analysisMatch = response.match(/ANALYSIS:\s*([\s\S]*?)(?=PROMPT:|$)/i);
      const promptMatch = response.match(/PROMPT:\s*([\s\S]*?)$/i);

      if (analysisMatch) {
        setAnalysisNotes(analysisMatch[1].trim());
      } else {
        // Fallback: use first paragraph as analysis
        const firstPara = response.split('\n\n')[0];
        setAnalysisNotes(firstPara);
      }

      if (promptMatch) {
        let extracted = promptMatch[1].trim();
        // Add preservation instruction if not present
        if (!extracted.toLowerCase().includes('preserve')) {
          extracted += '\n\nCRITICAL: Preserve ALL factual content, names, dates, technical terms, and specific details. Transform ONLY the voice and style, not the information.';
        }
        setGeneratedPrompt(extracted);
      } else {
        // Fallback: create a basic prompt from the analysis
        setGeneratedPrompt(`Rewrite in the style analyzed above, maintaining the characteristic voice patterns. Preserve all factual content and technical terminology.`);
      }

      setStep('edit');
    } catch (err) {
      console.error('Voice analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('input');
    } finally {
      setIsAnalyzing(false);
    }
  }, [sampleText, isLocalAvailable, useOllamaForLocal]);

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
      sourceExcerpt: sampleText.substring(0, 200),
      analysisNotes,
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedProfiles, newProfile];
    setSavedProfiles(updated);
    localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(updated));

    setStep('save');
    setError(null);

    // Reset form after a delay
    setTimeout(() => {
      setSampleText('');
      setProfileName('');
      setAnalysisNotes('');
      setGeneratedPrompt('');
      setTestInput('');
      setTestOutput('');
      setStep('input');
    }, 2000);
  }, [profileName, profileType, generatedPrompt, sampleText, analysisNotes, savedProfiles]);

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

      // Reset form after a delay
      setTimeout(() => {
        setSampleText('');
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
    setSampleText('');
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

      {/* Step: Input sample text */}
      {(step === 'input' || step === 'analyze') && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Sample Text</label>
            <textarea
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="Paste 500-2000 words of text in the style you want to capture..."
              style={textareaStyle}
              rows={8}
            />
            <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {sampleText.length} characters • {sampleText.split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

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
            <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !sampleText.trim()}
            style={{
              ...runButtonStyle,
              opacity: isAnalyzing || !sampleText.trim() ? 0.5 : 1,
              cursor: isAnalyzing || !sampleText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {isAnalyzing ? (
              <>⏳ Analyzing Voice...</>
            ) : (
              <><Wand size={16} /> Analyze Voice</>
            )}
          </button>
        </>
      )}

      {/* Step: Edit generated prompt */}
      {(step === 'edit' || step === 'test') && (
        <>
          {/* Analysis Notes (read-only) */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Voice Analysis</label>
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
            <label style={labelStyle}>Transformation Prompt (editable)</label>
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
