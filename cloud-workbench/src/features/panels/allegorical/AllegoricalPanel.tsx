import { useState, useEffect } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { useAuth } from '../../../core/context/AuthContext';
import { api, type AllegoricalResponse } from '../../../core/adapters/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AttributeBuilder } from '../../attributes/AttributeBuilder';
import { listUserAttributes, saveAttribute } from '../../attributes/api';
import type { AttributeType, AttributeDefinition, UserAttribute } from '../../attributes/types';

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
      const response = await api.allegorical({
        text,
        persona,
        namespace,
        style,
      });

      setResult(response);
      console.log('Allegorical transformation complete');
    } catch (err: any) {
      setError(err.message || 'Transformation failed');
      console.error('Transformation error:', err);
    } finally {
      setIsTransforming(false);
    }
  };

  const loadToCanvas = () => {
    if (result) {
      setText(result.final_projection);
      console.log('Loaded final projection to Canvas');
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
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">🌟 Allegorical Projection</h2>
        <p className="text-xs text-slate-400 mt-1">
          5-stage transformation: Deconstruct → Map → Reconstruct → Stylize → Reflect
        </p>
      </div>

      {/* Config Form */}
      <div className="border-b border-slate-700 p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              Persona
            </label>
            <button
              onClick={() => handleCreateCustom('persona')}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Create Custom
            </button>
          </div>
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-slate-100"
          >
            <optgroup label="Presets">
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            {userPersonas.length > 0 && (
              <optgroup label="Custom">
                {userPersonas.map((p) => (
                  <option key={p.id} value={`custom_${p.id}`}>
                    ✨ {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              Namespace
            </label>
            <button
              onClick={() => handleCreateCustom('namespace')}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Create Custom
            </button>
          </div>
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-slate-100"
          >
            <optgroup label="Presets">
              {namespaces.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </optgroup>
            {userNamespaces.length > 0 && (
              <optgroup label="Custom">
                {userNamespaces.map((n) => (
                  <option key={n.id} value={`custom_${n.id}`}>
                    ✨ {n.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              Style
            </label>
            <button
              onClick={() => handleCreateCustom('style')}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Create Custom
            </button>
          </div>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-slate-100"
          >
            <optgroup label="Presets">
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            {userStyles.length > 0 && (
              <optgroup label="Custom">
                {userStyles.map((s) => (
                  <option key={s.id} value={`custom_${s.id}`}>
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
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isTransforming ? '⏳ Transforming...' : '✨ Transform'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-b border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
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
                <h3 className="font-bold text-sm text-slate-100">Final Projection</h3>
                <button
                  onClick={loadToCanvas}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Load to Canvas →
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none rounded bg-slate-800 p-3 text-slate-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.final_projection}
                </ReactMarkdown>
              </div>
            </div>

            {/* Reflection */}
            <div>
              <h3 className="font-bold text-sm text-slate-100 mb-2">Reflection</h3>
              <div className="prose prose-invert prose-sm max-w-none rounded bg-slate-800 p-3 text-slate-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.reflection}
                </ReactMarkdown>
              </div>
            </div>

            {/* Stages (Collapsible) */}
            <details className="rounded border border-slate-700 bg-slate-800">
              <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-slate-100 hover:bg-slate-700">
                View 5 Stages
              </summary>
              <div className="space-y-3 p-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-1">1. Deconstruct</h4>
                  <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.deconstruct}
                    </ReactMarkdown>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-1">2. Map</h4>
                  <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.map}
                    </ReactMarkdown>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-1">3. Reconstruct</h4>
                  <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.reconstruct}
                    </ReactMarkdown>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-1">4. Stylize</h4>
                  <div className="prose prose-invert prose-xs max-w-none text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.stages.stylize}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </details>
          </>
        )}

        {!result && !isTransforming && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
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
