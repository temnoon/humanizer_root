import { useState } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api, type MaieuticResponse } from '../../../core/adapters/api';
import { PhilosophyTooltip } from '../../../components/ui/PhilosophyTooltip';

/**
 * MaieuticPanel - Socratic Questioning System
 *
 * Features:
 * - Socratic dialogue to explore ideas deeply
 * - Depth levels (0-4) controlling question complexity
 * - Multi-turn conversation support
 * - Reasoning display for each question
 * - Conversation history tracking
 */
export function MaieuticPanel() {
  const { getActiveText } = useCanvas();
  const [result, setResult] = useState<MaieuticResponse | null>(null);
  const [isQuestioning, setIsQuestioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);

  const depthLevels = [
    { value: 0, label: 'Surface', description: 'Basic clarifying questions' },
    { value: 1, label: 'Shallow', description: 'Simple exploration' },
    { value: 2, label: 'Moderate', description: 'Balanced questioning' },
    { value: 3, label: 'Deep', description: 'Philosophical inquiry' },
    { value: 4, label: 'Profound', description: 'Maximum depth analysis' },
  ];

  const handleAskQuestion = async () => {
    const text = getActiveText();

    if (!text || text.trim().length === 0) {
      setError('No text to question. Please load text to Canvas first.');
      return;
    }

    setIsQuestioning(true);
    setError(null);

    try {
      const response = await api.maieutic({
        text,
        depth,
        conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
      });

      setResult(response);

      // Update conversation history
      setConversationHistory([
        ...conversationHistory,
        { role: 'user', content: text },
        { role: 'assistant', content: response.question },
      ]);
    } catch (err: any) {
      setError(err.message || 'Maieutic questioning failed');
      console.error('Maieutic error:', err);
    } finally {
      setIsQuestioning(false);
    }
  };

  const handleReset = () => {
    setConversationHistory([]);
    setResult(null);
    setError(null);
  };

  const getDepthBadge = (d: number) => {
    const badges = ['badge-success', 'badge-info', 'badge-primary', 'badge-secondary', 'badge-accent'];
    return badges[d] || badges[2];
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h2 className="text-lg font-bold text-base-content">🤔 Maieutic Dialogue</h2>
        <p className="text-xs mt-1 text-base-content opacity-70">
          Socratic questioning to explore ideas deeply
        </p>
      </div>

      {/* Philosophy Context */}
      <PhilosophyTooltip
        title="Socratic Midwifery — Birth of Understanding from Within"
        description="Maieutic dialogue practices what Socrates called 'midwifery of ideas' — the art of helping consciousness give birth to understanding it already contains. Questions don't inject knowledge from outside; they draw out latent understanding from within your own experiential horizon. This is phenomenological reflection made dialogical: through questioning, you make explicit what was implicit, turning unreflected experience into articulated understanding."
        learnMoreUrl="https://humanizer.com/docs/tools/maieutic"
      />

      {/* Config Form */}
      <div className="border-b border-base-300 p-4 space-y-3">
        {/* Depth Level Selection */}
        <div>
          <label className="block text-xs font-medium mb-1 text-base-content">
            Question Depth
          </label>
          <select
            value={depth}
            onChange={(e) => setDepth(parseInt(e.target.value))}
            className="select select-bordered w-full text-sm"
          >
            {depthLevels.map((level) => (
              <option key={level.value} value={level.value}>
                Level {level.value}: {level.label}
              </option>
            ))}
          </select>
          {depthLevels.find((l) => l.value === depth) && (
            <div className="mt-1 text-xs text-base-content opacity-70">
              {depthLevels.find((l) => l.value === depth)?.description}
            </div>
          )}
        </div>

        {/* Canvas Text Preview */}
        <div className="card bg-base-200 rounded-lg p-3">
          <div className="text-xs mb-1 text-base-content opacity-70">Reading from Canvas</div>
          <div className="text-sm text-base-content">
            {getActiveText()
              ? `${getActiveText().substring(0, 100)}${getActiveText().length > 100 ? '...' : ''}`
              : 'No text in Canvas'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleAskQuestion}
            disabled={!getActiveText() || isQuestioning}
            className="btn btn-primary flex-1"
          >
            {isQuestioning ? '⏳ Thinking...' : '🤔 Ask Question'}
          </button>
          {conversationHistory.length > 0 && (
            <button
              onClick={handleReset}
              className="btn btn-ghost"
              title="Reset conversation"
            >
              🔄
            </button>
          )}
        </div>

        {/* Conversation Turn Counter */}
        {conversationHistory.length > 0 && (
          <div className="text-xs text-center text-base-content opacity-70">
            Turn {Math.floor(conversationHistory.length / 2)} • {conversationHistory.length} messages
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error border-none">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {result && (
          <>
            {/* Current Question */}
            <div className="card bg-base-200 rounded-lg p-4 border-l-4 border-primary">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-primary">Socratic Question</h3>
                <span className={`badge ${getDepthBadge(result.depth)}`}>
                  Depth {result.depth}
                </span>
              </div>
              <p className="text-base leading-relaxed text-base-content">
                {result.question}
              </p>
            </div>

            {/* Reasoning */}
            <div className="card bg-base-200 rounded-lg p-4">
              <h4 className="text-sm font-bold mb-2 text-base-content">
                Reasoning
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-base-content opacity-80">
                {result.reasoning}
              </p>
            </div>

            {/* Conversation History */}
            {conversationHistory.length > 0 && (
              <div className="card bg-base-200 rounded-lg p-4">
                <h4 className="text-sm font-bold mb-3 text-base-content">
                  Conversation History
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {conversationHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`card rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-info/10 border border-info/30'
                          : 'bg-primary/10 border border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium uppercase text-base-content opacity-70">
                          {msg.role === 'user' ? '👤 You' : '🤔 Socrates'}
                        </span>
                        <span className="text-xs text-base-content opacity-50">
                          Turn {Math.floor(i / 2) + 1}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-base-content">
                        {msg.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guidance */}
            <div className="card bg-base-200 rounded-lg p-4">
              <h4 className="text-sm font-bold mb-2 text-base-content">
                💡 How to Continue
              </h4>
              <div className="text-xs space-y-2 text-base-content opacity-80">
                <p>
                  1. <strong className="text-base-content">Reflect</strong> on the question above
                </p>
                <p>
                  2. <strong className="text-base-content">Update Canvas</strong> with your response or new thoughts
                </p>
                <p>
                  3. <strong className="text-base-content">Click "Ask Question"</strong> to continue the dialogue
                </p>
                <p className="mt-3 pt-3 border-t border-base-300">
                  The conversation builds on previous turns, creating a deep exploration of your ideas.
                </p>
              </div>
            </div>

            {/* Export Conversation */}
            <button
              onClick={() => {
                const conversation = conversationHistory
                  .map((msg) => `${msg.role === 'user' ? 'You' : 'Socrates'}: ${msg.content}`)
                  .join('\n\n');
                navigator.clipboard.writeText(conversation);
              }}
              className="btn btn-ghost w-full"
            >
              📄 Copy Full Conversation
            </button>
          </>
        )}

        {!result && !isQuestioning && !error && (
          <div className="text-center text-sm py-8 text-base-content opacity-70">
            <div className="mb-4 text-4xl">🤔</div>
            <p className="mb-2 text-base-content">Begin your Socratic inquiry</p>
            <p className="text-xs">
              Load text to Canvas, select a depth level, and click Ask Question
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
