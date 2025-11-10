import { useState } from 'react';
import { useCanvas } from '../../../core/context/CanvasContext';
import { api, type MaieuticResponse } from '../../../core/adapters/api';

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

  const getDepthColor = (d: number) => {
    const colors = [
      'text-green-400',
      'text-blue-400',
      'text-indigo-400',
      'text-purple-400',
      'text-pink-400',
    ];
    return colors[d] || colors[2];
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">🤔 Maieutic Dialogue</h2>
        <p className="text-xs text-slate-400 mt-1">
          Socratic questioning to explore ideas deeply
        </p>
      </div>

      {/* Config Form */}
      <div className="border-b border-slate-700 p-4 space-y-3">
        {/* Depth Level Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Question Depth
          </label>
          <select
            value={depth}
            onChange={(e) => setDepth(parseInt(e.target.value))}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-slate-100"
          >
            {depthLevels.map((level) => (
              <option key={level.value} value={level.value}>
                Level {level.value}: {level.label}
              </option>
            ))}
          </select>
          {depthLevels.find((l) => l.value === depth) && (
            <div className="mt-1 text-xs text-slate-400">
              {depthLevels.find((l) => l.value === depth)?.description}
            </div>
          )}
        </div>

        {/* Canvas Text Preview */}
        <div className="rounded bg-slate-800 p-3">
          <div className="text-xs text-slate-400 mb-1">Reading from Canvas</div>
          <div className="text-sm text-slate-300">
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
            className="flex-1 rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isQuestioning ? '⏳ Thinking...' : '🤔 Ask Question'}
          </button>
          {conversationHistory.length > 0 && (
            <button
              onClick={handleReset}
              className="rounded bg-slate-700 px-4 py-2 font-medium text-slate-300 hover:bg-slate-600"
              title="Reset conversation"
            >
              🔄
            </button>
          )}
        </div>

        {/* Conversation Turn Counter */}
        {conversationHistory.length > 0 && (
          <div className="text-xs text-slate-400 text-center">
            Turn {Math.floor(conversationHistory.length / 2)} • {conversationHistory.length} messages
          </div>
        )}
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
            {/* Current Question */}
            <div className="rounded bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-purple-200">Socratic Question</h3>
                <span className={`text-xs font-medium ${getDepthColor(result.depth)}`}>
                  Depth {result.depth}
                </span>
              </div>
              <p className="text-base text-slate-100 leading-relaxed">
                {result.question}
              </p>
            </div>

            {/* Reasoning */}
            <div className="rounded bg-slate-800 p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-2">
                Reasoning
              </h4>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                {result.reasoning}
              </p>
            </div>

            {/* Conversation History */}
            {conversationHistory.length > 0 && (
              <div className="rounded bg-slate-800 p-4">
                <h4 className="text-sm font-bold text-slate-300 mb-3">
                  Conversation History
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {conversationHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded p-3 ${
                        msg.role === 'user'
                          ? 'bg-blue-900/20 border border-blue-700/50'
                          : 'bg-purple-900/20 border border-purple-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-400 uppercase">
                          {msg.role === 'user' ? '👤 You' : '🤔 Socrates'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Turn {Math.floor(i / 2) + 1}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guidance */}
            <div className="rounded bg-slate-800 p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-2">
                💡 How to Continue
              </h4>
              <div className="text-xs text-slate-400 space-y-2">
                <p>
                  1. <strong className="text-slate-300">Reflect</strong> on the question above
                </p>
                <p>
                  2. <strong className="text-slate-300">Update Canvas</strong> with your response or new thoughts
                </p>
                <p>
                  3. <strong className="text-slate-300">Click "Ask Question"</strong> to continue the dialogue
                </p>
                <p className="mt-3 pt-3 border-t border-slate-700">
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
              className="w-full rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600"
            >
              📄 Copy Full Conversation
            </button>
          </>
        )}

        {!result && !isQuestioning && !error && (
          <div className="text-center text-sm text-slate-400 py-8">
            <div className="mb-4 text-4xl">🤔</div>
            <p className="mb-2">Begin your Socratic inquiry</p>
            <p className="text-xs">
              Load text to Canvas, select a depth level, and click Ask Question
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
