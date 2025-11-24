import { useState, useRef } from 'react';
import { ImportPreviewModal } from './ImportPreviewModal';

const ARCHIVE_SERVER_URL = 'http://localhost:3002';

interface ImportJob {
  id: string;
  status: 'uploaded' | 'parsing' | 'previewing' | 'ready' | 'applying' | 'completed' | 'failed';
  progress: number;
  filename?: string;
  error?: string;
  preview?: any;
}

export function ImportArchiveButton() {
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollJobStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/status/${id}`);
        const jobData: ImportJob = await res.json();

        setJob(jobData);

        if (jobData.status === 'ready') {
          clearInterval(interval);
          // Fetch preview
          const previewRes = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/preview/${id}`);
          const previewData = await previewRes.json();
          setJob({ ...jobData, preview: previewData.preview });
          setShowPreview(true);
          setUploading(false);
        } else if (jobData.status === 'completed') {
          clearInterval(interval);
          setUploading(false);
          setJobId(null);
          setJob(null);
          // Refresh archive list
          window.location.reload(); // Simple refresh for now
        } else if (jobData.status === 'failed') {
          clearInterval(interval);
          setUploading(false);
          alert(`Import failed: ${jobData.error}`);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 1000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      alert('Please select a ZIP file');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('archive', file);

      const uploadRes = await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const { jobId: newJobId } = await uploadRes.json();
      setJobId(newJobId);

      // Step 2: Trigger parsing
      await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: newJobId }),
      });

      // Step 3: Poll for status
      pollJobStatus(newJobId);
    } catch (err) {
      console.error('Error uploading archive:', err);
      alert('Failed to upload archive');
      setUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyImport = async () => {
    if (!jobId) return;

    try {
      setShowPreview(false);
      setUploading(true);

      await fetch(`${ARCHIVE_SERVER_URL}/api/import/archive/apply/${jobId}`, {
        method: 'POST',
      });

      // Poll for completion
      pollJobStatus(jobId);
    } catch (err) {
      console.error('Error applying import:', err);
      alert('Failed to apply import');
      setUploading(false);
    }
  };

  const handleCancelImport = () => {
    setShowPreview(false);
    setJobId(null);
    setJob(null);
  };

  return (
    <>
      <label
        className={`btn ${uploading ? 'btn-secondary' : 'btn-primary'}`}
        style={{
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.6 : 1,
        }}
        title="Import ZIP archive of OpenAI or Claude conversations"
      >
        {uploading ? (
          <>
            <span>⏳</span>
            <span>{job?.status === 'parsing' ? 'Parsing' : job?.status === 'applying' ? 'Importing' : 'Uploading'}...</span>
            {job?.progress && job.progress > 0 && (
              <span style={{ fontSize: '0.85em' }}>({job.progress}%)</span>
            )}
          </>
        ) : (
          <>
            <span>📦</span>
            <span>Import Archive</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={uploading}
        />
      </label>

      {showPreview && job?.preview && (
        <ImportPreviewModal
          preview={job.preview}
          filename={job.filename || 'archive.zip'}
          onApply={handleApplyImport}
          onCancel={handleCancelImport}
        />
      )}
    </>
  );
}
