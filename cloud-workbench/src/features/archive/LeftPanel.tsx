/**
 * Left Panel with Archive and Remote tabs
 */

import { useState } from 'react';
import { ArchiveBrowser } from './ArchiveBrowser';
import { RemoteContentSource } from '../remote/RemoteContentSource';

type TopLevelTab = 'archive' | 'remote';

export function LeftPanel() {
  // Default to Remote for cloud deployments (non-localhost)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const [topTab, setTopTab] = useState<TopLevelTab>(isLocalhost ? 'archive' : 'remote');

  return (
    <div className="flex flex-col h-full">
      {/* Top-level tabs: Archive | Remote */}
      <div className="flex border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => setTopTab('archive')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            topTab === 'archive'
              ? 'border-indigo-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📂 Archive
        </button>
        <button
          onClick={() => setTopTab('remote')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            topTab === 'remote'
              ? 'border-indigo-500 text-slate-100'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          ☁️ Remote
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {topTab === 'archive' ? <ArchiveBrowser /> : <RemoteContentSource />}
      </div>
    </div>
  );
}
