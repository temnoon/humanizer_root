import { useState, useEffect } from 'react';
import { useArchive } from '../../core/context/ArchiveContext';
import { useCanvas } from '../../core/context/CanvasContext';

const ARCHIVE_API = 'http://localhost:3002';

interface ConversationMetadata {
  id: string;
  title: string;
  folder: string;
  message_count: number;
  created_at?: number;
  updated_at?: number;
}

type LeftPaneTab = 'conversations' | 'messages';

export function ArchiveBrowser() {
  const { selectedConv, selectedMessageIndex, setSelectedConv, setSelectedMessageIndex } = useArchive();
  const { setText } = useCanvas();

  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [leftTab, setLeftTab] = useState<LeftPaneTab>('conversations');
  const [filter, setFilter] = useState('');

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch(`${ARCHIVE_API}/api/conversations`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      setConversations(data.conversations || []);
      console.log(`Loaded ${data.conversations?.length || 0} conversations`);
    } catch (error: any) {
      console.error('Archive connection error:', error);
      alert('Could not connect to archive server.\n\nMake sure it\'s running:\n  node archive-server.js');
    }
  };

  const loadConversation = async (folder: string) => {
    try {
      const response = await fetch(`${ARCHIVE_API}/api/conversations/${encodeURIComponent(folder)}`);
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const conversation = await response.json();
      setSelectedConv(conversation);
      setLeftTab('messages');
      setSelectedMessageIndex(null);
      setFilter(''); // Clear filter when loading new conversation
      console.log(`Loaded "${conversation.title}" - ${conversation.messages.length} messages`);
    } catch (error: any) {
      console.error('Error loading conversation:', error);
      alert(`Could not load conversation: ${error.message}`);
    }
  };

  const selectMessage = (index: number) => {
    setSelectedMessageIndex(index);
  };

  const loadMessageToCanvas = () => {
    if (selectedMessageIndex !== null && selectedConv) {
      const message = selectedConv.messages[selectedMessageIndex];
      setText(message.content);
      console.log('Loaded message to Canvas:', message.content.substring(0, 50) + '...');
    }
  };

  // Import conversation.json file
  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Read file content
      const content = await file.text();
      const conversation = JSON.parse(content);

      // Send to archive server
      const response = await fetch(`${ARCHIVE_API}/api/import/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation,
          filename: file.name
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      console.log('✓ Imported:', result);

      // Show success message
      alert(`✓ Imported: ${result.title}\n${result.message_count} messages`);

      // Reload conversations list
      await loadConversations();

      // Reset file input
      event.target.value = '';
    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
      event.target.value = '';
    }
  };

  // Filtering
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(filter.toLowerCase()) ||
    conv.folder.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredMessages = selectedConv?.messages.filter((msg) =>
    msg.content.toLowerCase().includes(filter.toLowerCase())
  ) || [];

  console.log('[ArchiveBrowser] leftTab:', leftTab);
  console.log('[ArchiveBrowser] filteredMessages:', filteredMessages.slice(0, 3));
  console.log('[ArchiveBrowser] filteredConversations:', filteredConversations.slice(0, 3));

  // MESSAGES TAB - early return to prevent any possibility of showing conversations
  if (leftTab === 'messages' && selectedConv) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* TABS */}
        <div className="flex flex-shrink-0 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setLeftTab('conversations')}
            className="flex-1 px-4 py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}
          >
            📚 All Conversations
          </button>
          <button
            className="flex-1 px-4 py-2 text-sm font-medium border-b-2" style={{ borderColor: 'var(--accent-purple)', color: 'var(--text-primary)' }}
          >
            💬 Conv Messages
          </button>
        </div>

        {/* MESSAGES CONTENT */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b p-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => setLeftTab('conversations')}
                className="btn-secondary rounded px-2 py-1 text-xs"
              >
                ← Back
              </button>
              <div className="flex-1 text-sm font-medium line-clamp-1" style={{ color: 'var(--text-primary)' }}>{selectedConv.title}</div>
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter messages..."
              className="input w-full rounded px-2 py-1 text-xs"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {filter ? `${filteredMessages.length} of ${selectedConv.messages.length}` : `${selectedConv.messages.length} messages`}
              </div>
              {selectedMessageIndex !== null && (
                <button
                  onClick={loadMessageToCanvas}
                  className="btn-primary rounded px-3 py-1 text-xs font-medium"
                >
                  Load to Canvas →
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {filteredMessages.map((msg, idx) => (
              <div
                key={`msg-${idx}`}
                className="cursor-pointer rounded border p-2 transition-colors"
                style={{
                  borderColor: selectedMessageIndex === idx ? 'var(--accent-purple)' : 'var(--border-color)',
                  borderWidth: selectedMessageIndex === idx ? '2px' : '1px',
                  background: selectedMessageIndex === idx ? 'rgba(167, 139, 250, 0.1)' : 'var(--bg-secondary)',
                }}
                onClick={() => selectMessage(idx)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-bold"
                    style={{
                      background: msg.role === 'user' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(167, 139, 250, 0.3)',
                      color: msg.role === 'user' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
                    }}
                  >
                    {msg.role.toUpperCase()}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>#{idx + 1}</span>
                </div>
                <div className="text-xs line-clamp-3" style={{ color: 'var(--text-primary)' }}>{msg.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // CONVERSATIONS TAB
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* LEFT PANE TABS - Conversations / Messages */}
      <div className="flex flex-shrink-0 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => setLeftTab('conversations')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            leftTab === 'conversations'
              ? 'border-b-2 text-sm font-medium'
              : ''
          }`}
        >
          📚 All Conversations
        </button>
        <button
          onClick={() => setLeftTab('messages')}
          disabled={!selectedConv}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            leftTab === 'messages'
              ? 'border-b-2 text-sm font-medium'
              : ''
          } disabled:opacity-30`}
        >
          💬 Conv Messages
        </button>
      </div>

      {/* Tab Content - Completely replaces based on active tab */}
      {leftTab === 'conversations' ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Filter + Import */}
          <div className="flex-shrink-0 border-b p-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="mb-2 flex gap-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter conversations..."
                className="input flex-1 rounded px-2 py-1 text-xs"
              />
              <label className="btn-secondary cursor-pointer rounded px-3 py-1 text-xs font-medium">
                📥 Import JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {filter ? `${filteredConversations.length} of ${conversations.length}` : `${conversations.length} total`}
            </div>
          </div>

          {/* Scrollable Conversation List */}
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {filteredConversations.map((conv) => (
              <div
                key={conv.folder}
                className="cursor-pointer rounded border p-2 transition-colors"
                style={{
                  borderColor: selectedConv?.id === conv.id ? 'var(--accent-purple)' : 'var(--border-color)',
                  borderWidth: selectedConv?.id === conv.id ? '2px' : '1px',
                  background: selectedConv?.id === conv.id ? 'rgba(167, 139, 250, 0.1)' : 'var(--bg-secondary)',
                }}
                onClick={() => loadConversation(conv.folder)}
              >
                <div className="mb-1 text-sm font-medium line-clamp-2" style={{ color: 'var(--text-primary)' }}>{conv.title}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{conv.message_count} messages</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Conversation Title + Back Button */}
          <div className="flex-shrink-0 border-b p-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => setLeftTab('conversations')}
                className="btn-secondary rounded px-2 py-1 text-xs"
              >
                ← Back
              </button>
              <div className="flex-1 text-sm font-medium line-clamp-1" style={{ color: 'var(--text-primary)' }}>{selectedConv?.title}</div>
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter messages..."
              className="input w-full rounded px-2 py-1 text-xs"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {filter ? `${filteredMessages.length} of ${selectedConv?.messages.length || 0}` : `${selectedConv?.messages.length || 0} messages`}
              </div>
              {selectedMessageIndex !== null && (
                <button
                  onClick={loadMessageToCanvas}
                  className="btn-primary rounded px-3 py-1 text-xs font-medium"
                >
                  Load to Canvas →
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Message List */}
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {filteredMessages.map((msg) => {
              const originalIndex = selectedConv!.messages.indexOf(msg);
              return (
                <div
                  key={originalIndex}
                  className={`cursor-pointer rounded border p-2 transition-colors ${
                    selectedMessageIndex === originalIndex
                      ? 'border-2'
                      : 'border'
                  }`}
                  onClick={() => selectMessage(originalIndex)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                      msg.role === 'user'
                        ? 'role-badge'
                        : 'assistant-badge'
                    }`}>
                      {msg.role.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>#{originalIndex + 1}</span>
                  </div>
                  <div className="text-xs line-clamp-3" style={{ color: 'var(--text-primary)' }}>{msg.content}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
