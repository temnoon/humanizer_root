import { useState, useEffect } from 'react';
import { useCanvas } from '../../core/context/CanvasContext';
import { api, type QuantumAnalysisSession } from '../../core/adapters/api';

/**
 * SessionBrowser - Quantum Analysis Session Manager
 *
 * Features:
 * - List all quantum reading sessions
 * - Resume incomplete sessions
 * - View session metadata (text, sentence count, progress)
 * - Delete old sessions
 * - Load original text to Canvas
 *
 * Database: quantum_analysis_sessions table
 * API: GET /quantum-analysis/sessions, GET /quantum-analysis/:id, DELETE /quantum-analysis/sessions/:id
 */
export function SessionBrowser() {
  const { setText } = useCanvas();
  const [sessions, setSessions] = useState<QuantumAnalysisSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await api.getQuantumSessions();
      setSessions(results);
    } catch (err: any) {
      setError(err.message || 'Failed to load quantum sessions');
      console.error('Sessions load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteQuantumSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      console.error('Delete session error:', err);
      setError('Failed to delete session');
    }
  };

  const handleLoadToCanvas = (text: string) => {
    setText(text);
    console.log('Loaded original text to Canvas');
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      in_progress: { color: 'bg-blue-900/40 text-blue-200 border-blue-700', label: '🔄 In Progress' },
      completed: { color: 'bg-green-900/40 text-green-200 border-green-700', label: '✓ Completed' },
      abandoned: { color: 'bg-slate-700 text-slate-300 border-slate-600', label: '◐ Abandoned' },
    };

    const badge = badges[status as keyof typeof badges] || badges.abandoned;

    return (
      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getProgress = (session: QuantumAnalysisSession) => {
    const percentage = (session.current_index / session.total_sentences) * 100;
    return {
      percentage: Math.round(percentage),
      text: `${session.current_index} / ${session.total_sentences} sentences`,
    };
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">◈ Quantum Reading Sessions</h2>
        <p className="text-xs text-slate-400 mt-1">
          Resume or review past quantum analysis sessions
        </p>
      </div>

      {/* Actions */}
      <div className="border-b border-slate-700 p-4">
        <button
          onClick={loadSessions}
          disabled={loading}
          className="w-full rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 disabled:opacity-50"
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh Sessions'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-b border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results Count */}
      <div className="border-b border-slate-700 px-4 py-2 text-xs text-slate-400">
        {sessions.length > 0 ? (
          `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} found`
        ) : loading ? (
          'Loading...'
        ) : (
          'No sessions found'
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sessions.length > 0 ? (
          sessions.map(session => {
            const progress = getProgress(session);
            const isExpanded = expandedId === session.id;

            return (
              <div
                key={session.id}
                className="rounded border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                {/* Header */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    {/* Status Badge */}
                    <div className="flex-1">
                      {getStatusBadge(session.status)}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleLoadToCanvas(session.original_text)}
                        className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                        title="Load original text to Canvas"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : session.id)}
                        className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-red-600 hover:text-white"
                        title="Delete session"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Progress</span>
                      <span>{progress.text}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-slate-700">
                      <div
                        className={`h-full transition-all ${
                          session.status === 'completed'
                            ? 'bg-green-500'
                            : session.status === 'in_progress'
                            ? 'bg-blue-500'
                            : 'bg-slate-500'
                        }`}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Text Preview */}
                  <div className="text-sm text-slate-300 line-clamp-2 mb-2">
                    {session.original_text}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Created: {formatDate(session.created_at)}</span>
                    <span>•</span>
                    <span>Updated: {formatDate(session.updated_at)}</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-700 p-3 space-y-3">
                    {/* Full Text */}
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-1">Original Text</div>
                      <div className="rounded bg-slate-900 p-2 text-sm text-slate-300 max-h-48 overflow-y-auto">
                        {session.original_text}
                      </div>
                    </div>

                    {/* Session Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-slate-900 p-2">
                        <div className="text-slate-400 mb-1">Session ID</div>
                        <div className="font-mono text-slate-300 truncate" title={session.id}>
                          {session.id.substring(0, 16)}...
                        </div>
                      </div>
                      <div className="rounded bg-slate-900 p-2">
                        <div className="text-slate-400 mb-1">Total Sentences</div>
                        <div className="font-bold text-slate-300">{session.total_sentences}</div>
                      </div>
                      <div className="rounded bg-slate-900 p-2">
                        <div className="text-slate-400 mb-1">Current Index</div>
                        <div className="font-bold text-slate-300">{session.current_index}</div>
                      </div>
                      <div className="rounded bg-slate-900 p-2">
                        <div className="text-slate-400 mb-1">Status</div>
                        <div className="font-bold text-slate-300 capitalize">{session.status.replace('_', ' ')}</div>
                      </div>
                    </div>

                    {/* Resume Button (only for in_progress sessions) */}
                    {session.status === 'in_progress' && (
                      <button
                        onClick={() => {
                          // TODO: Integrate with MultiReadingPanel to resume session
                          console.log('Resume session:', session.id);
                          alert('Session resume functionality coming soon!\nFor now, use Multi-Reading panel to start a new analysis.');
                        }}
                        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                      >
                        🔄 Resume Analysis
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : !loading && (
          <div className="text-center text-sm text-slate-400 py-8">
            No quantum reading sessions yet
            <br />
            Use the Multi-Reading panel to start your first analysis
          </div>
        )}
      </div>
    </div>
  );
}
