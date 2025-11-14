import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { useAuth } from '../../../core/context/AuthContext';
import { api, type AllegoricalResponse } from '../../../core/adapters/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AttributeBuilder } from '../../attributes/AttributeBuilder';
import { listUserAttributes, saveAttribute } from '../../attributes/api';
import type { AttributeType, AttributeDefinition, UserAttribute } from '../../attributes/types';
import { PhilosophyTooltip } from '../../../components/ui/PhilosophyTooltip';

/**
 * AllegoricalPanel - 5-stage allegorical projection transformation
 *
 * Pipeline: Deconstruct → Map → Reconstruct → Stylize → Reflect
 *
 * Features:
 * - Persona/namespace/style selection
 * - Canvas text integration
 * - Progress indicator for 5 stages
 * - Markdown rendering for all outputs
 * - Load result back to Canvas
 */

export function AllegoricalPanel() {
  const { getActiveText, setText } = useCanvas();
  const { requiresAuth, isAuthenticated } = useAuth();

  // Form state
  const [persona, setPersona] = useState('neutral');
  const [namespace, setNamespace] = useState('mythology');
  const [style, setStyle] = useState('standard');

  // Config options (loaded from API)
  const [personas, setPersonas] = useState<Array<{ id: string; name: string }>>([]);
  const [namespaces, setNamespaces] = useState<Array<{ id: string; name: string }>>([]);
  const [styles, setStyles] = useState<Array<{ id: string; name: string }>>([]);

  // User custom attributes
  const [userPersonas, setUserPersonas] = useState<UserAttribute[]>([]);
  const [userNamespaces, setUserNamespaces] = useState<UserAttribute[]>([]);
  const [userStyles, setUserStyles] = useState<UserAttribute[]>([]);

  // Attribute builder state
  const [showAttributeBuilder, setShowAttributeBuilder] = useState(false);
  const [builderType, setBuilderType] = useState<AttributeType>('persona');

  // Transformation state
  const [result, setResult] = useState<AllegoricalResponse | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load config options
  useEffect(() => {
    loadConfig();
    loadUserAttributes();
  }, []);

  const loadConfig = async () => {
    try {
      const [pData, nData, sData] = await Promise.all([
        api.getPersonas(),
        api.getNamespaces(),
        api.getStyles(),
      ]);
      setPersonas(pData);
      setNamespaces(nData);
      setStyles(sData);
    } catch (err: any) {
      console.error('Error loading config:', err);
    }
  };

  const loadUserAttributes = async () => {
    try {
      const [pData, nData, sData] = await Promise.all([
        listUserAttributes('persona'),
        listUserAttributes('namespace'),
        listUserAttributes('style'),
      ]);
      setUserPersonas(pData);
      setUserNamespaces(nData);
      setUserStyles(sData);
    } catch (err: any) {
      console.error('Error loading user attributes:', err);
    }
  };

  const handleTransform = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to transform. Please load text to Canvas first.');
      return;
    }

    // Check authentication for remote API
    if (requiresAuth() && !isAuthenticated) {
      setError('Please login to use remote transformations.');
      return;
    }

    setIsTransforming(true);
    setError(null);
    setResult(null);

    try {
      console.log('[Allegorical] Making API call with text length:', text.length);
      console.log('[Allegorical] Parameters:', { persona, namespace, style });

      const response = await api.allegorical({
        text,
        persona,
        namespace,
        style,
      });

      console.log('[Allegorical] API response received:', response);
      console.log('[Allegorical] Response has final_text:', !!response?.final_text);
      setResult(response);
      console.log('Allegorical transformation complete');
    } catch (err: any) {
      console.log('[Allegorical] Transformation failed:', err.message);
      setError(err.message || 'Transformation failed');
    } finally {
      setIsTransforming(false);
    }
  };

  const loadToCanvas = () => {
    if (result) {
      setText(result.final_text);
      console.log('Loaded final text to Canvas');
    }
  };

  const handleCreateCustom = (type: AttributeType) => {
    setBuilderType(type);
    setShowAttributeBuilder(true);
  };

  const handleAttributeComplete = async (definition: AttributeDefinition) => {
    try {
      // Save the attribute
      const saved = await saveAttribute(builderType, definition);

      // Add to appropriate list
      switch (builderType) {
        case 'persona':
          setUserPersonas(prev => [...prev, saved]);
          setPersona(`custom_${saved.id}`);
          break;
        case 'namespace':
          setUserNamespaces(prev => [...prev, saved]);
          setNamespace(`custom_${saved.id}`);
          break;
        case 'style':
          setUserStyles(prev => [...prev, saved]);
          setStyle(`custom_${saved.id}`);
          break;
      }

      setShowAttributeBuilder(false);
      console.log('Custom attribute saved:', saved);
    } catch (err: any) {
      console.error('Error saving attribute:', err);
      setError('Failed to save custom attribute');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>🌟 Allegorical Projection</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          5-stage transformation: Deconstruct → Map → Reconstruct → Stylize → Reflect
        </p>
      </div>

      {/* Philosophy Context */}
      <PhilosophyTooltip
        title="Phenomenological Reduction Through Perspectival Projection"
        description="Allegorical projection reveals the latent intentionality of your narrative by projecting it through different experiential horizons (persona, namespace, style). This isn't 'rephrasing' — it's phenomenological reduction, exposing what-was-always-there-but-unseen. By shifting perspective, you bracket your natural attitude and see the invariant structures of meaning that persist across different modes of consciousness."
        learnMoreUrl="https://humanizer.com/docs/tools/allegorical"
      />

      {/* Config Form */}
      <div className="border-b p-4 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              Persona
            </label>
            <button
              onClick={() => handleCreateCustom('persona')}
              className="text-xs"
              style={{ color: 'var(--accent-purple)' }}
            >
              + Create Custom
            </button>
          </div>
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="input w-full rounded px-3 py-2 text-sm"
          >
            <optgroup label="Presets">
              {personas.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            {userPersonas.length > 0 && (
              <optgroup label="Custom">
                {userPersonas.map((p) => (
                  <option key={p.id} value={p.name}>
                    ✨ {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              Namespace
            </label>
            <button
              onClick={() => handleCreateCustom('namespace')}
              className="text-xs"
              style={{ color: 'var(--accent-purple)' }}
            >
              + Create Custom
            </button>
          </div>
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="input w-full rounded px-3 py-2 text-sm"
          >
            <optgroup label="Presets">
              {namespaces.map((n) => (
                <option key={n.id} value={n.name}>
                  {n.name}
                </option>
              ))}
            </optgroup>
            {userNamespaces.length > 0 && (
              <optgroup label="Custom">
                {userNamespaces.map((n) => (
                  <option key={n.id} value={n.name}>
                    ✨ {n.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              Style
            </label>
            <button
              onClick={() => handleCreateCustom('style')}
              className="text-xs"
              style={{ color: 'var(--accent-purple)' }}
            >
              + Create Custom
            </button>
          </div>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="input w-full rounded px-3 py-2 text-sm"
          >
            <optgroup label="Presets">
              {styles.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            {userStyles.length > 0 && (
              <optgroup label="Custom">
                {userStyles.map((s) => (
                  <option key={s.id} value={s.name}>
                    ✨ {s.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <button
          onClick={handleTransform}
          disabled={isTransforming}
          className="btn-primary w-full rounded px-4 py-2 font-medium disabled:opacity-50"
        >
          {isTransforming ? '⏳ Transforming...' : '✨ Transform'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="border-b px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--accent-red)',
            background: 'rgba(220, 38, 38, 0.2)',
            color: 'var(--accent-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {result && (
          <>
            {/* Final Projection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Final Projection</h3>
                <button
                  onClick={loadToCanvas}
                  className="btn-primary rounded px-3 py-1 text-xs font-medium"
                >
                  Load to Canvas →
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none card rounded p-3" style={{ color: 'var(--text-primary)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.final_text}
                </ReactMarkdown>
              </div>
            </div>

            {/* Stages (Collapsible) */}
            <details className="card rounded" style={{ border: '1px solid var(--border-color)' }}>
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm hover-bg-accent" style={{ color: 'var(--text-primary)' }}>
                View {result.stages.length} Stages
              </summary>
              <div className="space-y-3 p-3">
                {result.stages.map((stage, idx) => (
                  <div key={idx}>
                    <h4 className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {stage.stage_number}. {stage.stage_name}
                    </h4>
                    <div className="prose prose-invert prose-xs max-w-none" style={{ color: 'var(--text-primary)' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {stage.output_text}
                      </ReactMarkdown>
                    </div>
                    {stage.transformation_description && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--text-tertiary)' }}>
                        {stage.transformation_description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </>
        )}

        {!result && !isTransforming && !error && (
          <div className="text-center text-sm py-8" style={{ color: 'var(--text-secondary)' }}>
            Configure settings and click Transform to begin
          </div>
        )}
      </div>

      {/* Attribute Builder Modal */}
      {showAttributeBuilder && (
        <AttributeBuilder
          type={builderType}
          onComplete={handleAttributeComplete}
          onCancel={() => setShowAttributeBuilder(false)}
        />
      )}
    </div>
  );
}
