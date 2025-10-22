import { useState } from 'react';
import PipelinePanel from './PipelinePanel';
import IngestionPanel from '../documents/IngestionPanel';
import './CombinedPipelinePanel.css';

type PipelineTab = 'embeddings' | 'documents';

export default function CombinedPipelinePanel() {
  const [activeTab, setActiveTab] = useState<PipelineTab>('documents');

  return (
    <div className="combined-pipeline-panel">
      <div className="pipeline-tabs">
        <button
          className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          📥 Document Ingestion
        </button>
        <button
          className={`tab-button ${activeTab === 'embeddings' ? 'active' : ''}`}
          onClick={() => setActiveTab('embeddings')}
        >
          ⚡ Embedding Pipeline
        </button>
      </div>

      <div className="pipeline-content">
        {activeTab === 'documents' && <IngestionPanel />}
        {activeTab === 'embeddings' && <PipelinePanel />}
      </div>
    </div>
  );
}
