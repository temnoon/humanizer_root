import { useState } from 'react';
import './ArchiveIngestionPanel.css';
import apiClient, { ChatGPTIngestRequest, ChatGPTIngestResponse, ClaudeIngestRequest, ClaudeIngestResponse } from '@/lib/api-client';

type Provider = 'chatgpt' | 'claude';

interface IngestionState {
  isLoading: boolean;
  result: ChatGPTIngestResponse | ClaudeIngestResponse | null;
  error: string | null;
}

/**
 * ArchiveIngestionPanel - Import ChatGPT and Claude conversation archives
 *
 * Features:
 * - Dual provider support (ChatGPT and Claude)
 * - File path input
 * - Progress tracking
 * - Results display
 * - Error handling
 */
export default function ArchiveIngestionPanel() {
  const [selectedProvider, setSelectedProvider] = useState<Provider>('claude');
  const [ingestionState, setIngestionState] = useState<IngestionState>({
    isLoading: false,
    result: null,
    error: null,
  });

  // ChatGPT form state
  const [chatgptForm, setChatgptForm] = useState<ChatGPTIngestRequest>({
    home_dir: '~',
    archive_pattern: 'chat[2-8]',
    force_reimport: false,
  });

  // Claude form state
  const [claudeForm, setClaudeForm] = useState<ClaudeIngestRequest>({
    archive_path: '',
    force_reimport: false,
    import_projects: true,
  });

  const handleChatGPTIngest = async () => {
    setIngestionState({ isLoading: true, result: null, error: null });

    try {
      const result = await apiClient.ingestChatGPTArchive(chatgptForm);
      setIngestionState({ isLoading: false, result, error: null });
    } catch (error) {
      setIngestionState({
        isLoading: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleClaudeIngest = async () => {
    setIngestionState({ isLoading: true, result: null, error: null });

    try {
      const result = await apiClient.ingestClaudeArchive(claudeForm);
      setIngestionState({ isLoading: false, result, error: null });
    } catch (error) {
      setIngestionState({
        isLoading: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProvider === 'chatgpt') {
      handleChatGPTIngest();
    } else {
      handleClaudeIngest();
    }
  };

  const renderChatGPTForm = () => (
    <div className="archive-form">
      <div className="form-group">
        <label htmlFor="home_dir">
          Home Directory
          <span className="field-help">Path where chat folders are located</span>
        </label>
        <input
          id="home_dir"
          type="text"
          value={chatgptForm.home_dir}
          onChange={(e) => setChatgptForm({ ...chatgptForm, home_dir: e.target.value })}
          placeholder="e.g., ~"
          disabled={ingestionState.isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="archive_pattern">
          Archive Pattern
          <span className="field-help">Glob pattern to match archive folders</span>
        </label>
        <input
          id="archive_pattern"
          type="text"
          value={chatgptForm.archive_pattern}
          onChange={(e) => setChatgptForm({ ...chatgptForm, archive_pattern: e.target.value })}
          placeholder="e.g., chat[2-8]"
          disabled={ingestionState.isLoading}
        />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={chatgptForm.force_reimport}
            onChange={(e) => setChatgptForm({ ...chatgptForm, force_reimport: e.target.checked })}
            disabled={ingestionState.isLoading}
          />
          <span>Force Reimport</span>
          <span className="field-help">Re-import existing conversations</span>
        </label>
      </div>
    </div>
  );

  const renderClaudeForm = () => (
    <div className="archive-form">
      <div className="form-group">
        <label htmlFor="archive_path">
          Archive Path
          <span className="field-help">Path to zip file or extracted directory</span>
        </label>
        <input
          id="archive_path"
          type="text"
          value={claudeForm.archive_path}
          onChange={(e) => setClaudeForm({ ...claudeForm, archive_path: e.target.value })}
          placeholder="e.g., ~/Downloads/data-2025-10-25-*.zip"
          disabled={ingestionState.isLoading}
        />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={claudeForm.import_projects}
            onChange={(e) => setClaudeForm({ ...claudeForm, import_projects: e.target.checked })}
            disabled={ingestionState.isLoading}
          />
          <span>Import Projects</span>
          <span className="field-help">Include Claude Projects with docs</span>
        </label>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={claudeForm.force_reimport}
            onChange={(e) => setClaudeForm({ ...claudeForm, force_reimport: e.target.checked })}
            disabled={ingestionState.isLoading}
          />
          <span>Force Reimport</span>
          <span className="field-help">Re-import existing conversations</span>
        </label>
      </div>
    </div>
  );

  const renderResults = (result: ChatGPTIngestResponse | ClaudeIngestResponse) => {
    const isClaudeResult = 'conversations_new' in result;

    return (
      <div className="ingestion-results">
        <h3>✅ Import Complete!</h3>

        <div className="results-grid">
          <div className="result-item">
            <span className="result-label">Archives Found:</span>
            <span className="result-value">{result.archives_found}</span>
          </div>

          <div className="result-item">
            <span className="result-label">Conversations Processed:</span>
            <span className="result-value">{result.conversations_processed}</span>
          </div>

          {isClaudeResult && (
            <>
              <div className="result-item">
                <span className="result-label">New Conversations:</span>
                <span className="result-value">{result.conversations_new}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Updated Conversations:</span>
                <span className="result-value">{result.conversations_updated}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Projects Imported:</span>
                <span className="result-value">{result.projects_imported}</span>
              </div>
            </>
          )}

          <div className="result-item">
            <span className="result-label">Messages Imported:</span>
            <span className="result-value highlight">{result.messages_imported}</span>
          </div>

          <div className="result-item">
            <span className="result-label">Media Files Found:</span>
            <span className="result-value">{result.media_files_found}</span>
          </div>

          <div className="result-item">
            <span className="result-label">Media Files Matched:</span>
            <span className="result-value">{result.media_files_matched}</span>
          </div>

          <div className="result-item">
            <span className="result-label">Processing Time:</span>
            <span className="result-value">{result.processing_time_seconds.toFixed(2)}s</span>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="results-errors">
            <h4>⚠️ Errors ({result.errors.length})</h4>
            <ul>
              {result.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="btn btn-secondary"
          onClick={() => setIngestionState({ isLoading: false, result: null, error: null })}
        >
          Import Another Archive
        </button>
      </div>
    );
  };

  return (
    <div className="archive-ingestion-panel">
      <div className="panel-header">
        <h2>📦 Archive Ingestion</h2>
        <p>Import conversation archives from ChatGPT and Claude/Anthropic</p>
      </div>

      {!ingestionState.result && !ingestionState.error && (
        <>
          {/* Provider Tabs */}
          <div className="provider-tabs">
            <button
              className={`tab ${selectedProvider === 'claude' ? 'active' : ''}`}
              onClick={() => setSelectedProvider('claude')}
              disabled={ingestionState.isLoading}
            >
              <span className="tab-icon">🤖</span>
              Claude
            </button>
            <button
              className={`tab ${selectedProvider === 'chatgpt' ? 'active' : ''}`}
              onClick={() => setSelectedProvider('chatgpt')}
              disabled={ingestionState.isLoading}
            >
              <span className="tab-icon">💬</span>
              ChatGPT
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="archive-form-container">
            {selectedProvider === 'chatgpt' ? renderChatGPTForm() : renderClaudeForm()}

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={ingestionState.isLoading}
              >
                {ingestionState.isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Importing...
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    Import Archive
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Helper Text */}
          <div className="helper-text">
            {selectedProvider === 'claude' ? (
              <>
                <h4>Claude Archive Format</h4>
                <ul>
                  <li>Download your Claude conversations from <strong>claude.ai</strong></li>
                  <li>Supports both <strong>zip files</strong> and <strong>extracted directories</strong></li>
                  <li>Archive must contain <code>conversations.json</code></li>
                  <li>Media files stored in UUID-named directories</li>
                  <li>Projects imported if <code>projects.json</code> exists</li>
                </ul>
              </>
            ) : (
              <>
                <h4>ChatGPT Archive Format</h4>
                <ul>
                  <li>Download your ChatGPT data from <strong>OpenAI account settings</strong></li>
                  <li>Extract archives to separate folders (e.g., <code>chat2</code>, <code>chat5</code>)</li>
                  <li>Each archive must contain <code>conversations.json</code></li>
                  <li>Use glob patterns to match multiple archives</li>
                </ul>
              </>
            )}
          </div>
        </>
      )}

      {/* Loading State */}
      {ingestionState.isLoading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Importing {selectedProvider === 'claude' ? 'Claude' : 'ChatGPT'} archive...</p>
          <p className="loading-subtext">This may take a few moments</p>
        </div>
      )}

      {/* Results */}
      {ingestionState.result && renderResults(ingestionState.result)}

      {/* Error State */}
      {ingestionState.error && (
        <div className="error-state">
          <h3>❌ Import Failed</h3>
          <p className="error-message">{ingestionState.error}</p>
          <button
            className="btn btn-secondary"
            onClick={() => setIngestionState({ isLoading: false, result: null, error: null })}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
