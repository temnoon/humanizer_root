import { useEffect, useState } from "react";
import { api, Gem } from "../../core/adapters/api";
import { ArchiveBrowser } from "../archive/ArchiveBrowser";

type VaultTab = 'remote' | 'archive';

export function GemVault() {
  const [items, setItems] = useState<Gem[]>([]);
  const [activeTab, setActiveTab] = useState<VaultTab>('archive');

  useEffect(()=>{
    if (activeTab === 'remote') {
      api.listGems().then(setItems);
    }
  },[activeTab]);

  return (
    <div className="flex h-full flex-col">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('archive')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'archive'
              ? 'border-b-2 border-indigo-500 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📂 Archive
        </button>
        <button
          onClick={() => setActiveTab('remote')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'remote'
              ? 'border-b-2 border-indigo-500 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ☁️ Remote
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'archive' ? (
          <ArchiveBrowser />
        ) : (
          <div className="space-y-2 overflow-y-auto p-2">
            {items.map(g=>(
              <div key={g.id} className="rounded bg-slate-800 p-2">
                <div className="text-sm font-medium">{g.title}</div>
                <div className="text-xs opacity-70">{g.snippet ?? ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
