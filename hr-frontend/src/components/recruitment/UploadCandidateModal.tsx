import { useRef, useState } from 'react';
import { Loader2, UploadCloud, FileText, X } from 'lucide-react';
import { uploadCandidate } from '../../services/resources';
import { apiErrorMessage } from '../../services/api';
import type { Candidate } from '../../types';
import Modal from '../Modal';

interface QueuedFile {
  file: File;
  fullName: string;
}

const UploadCandidateModal = ({
  jobDescriptionId,
  onClose,
  onUploaded,
}: {
  jobDescriptionId: number;
  onClose: () => void;
  onUploaded: (candidate: Candidate) => void;
}) => {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => /\.(pdf|docx)$/i.test(f.name));
    setQueue((prev) => [...prev, ...valid.map((file) => ({ file, fullName: file.name.replace(/\.(pdf|docx)$/i, '') }))]);
  };

  const handleUploadAll = async () => {
    setUploading(true);
    setError(null);
    try {
      for (const item of queue) {
        const candidate = await uploadCandidate(jobDescriptionId, item.file, item.fullName);
        onUploaded(candidate);
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title="Upload candidate resumes" onClose={onClose}>
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
              : 'border-primary-400/40 dark:border-white/10 hover:border-primary-500'
          }`}
        >
          <UploadCloud className="w-8 h-8 mx-auto mb-2.5 text-primary-500" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop resumes here or click to browse</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PDF or DOCX, one or more files</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {queue.length > 0 && (
          <div className="space-y-2">
            {queue.map((item, i) => (
              <div key={i} className="panel px-4 py-2.5 flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary-500 shrink-0" />
                <input
                  value={item.fullName}
                  onChange={(e) => setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, fullName: e.target.value } : q))}
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none"
                  placeholder="Candidate name"
                />
                <span className="text-[11px] text-slate-400 shrink-0">{item.file.name}</span>
                <button
                  type="button"
                  onClick={() => setQueue((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-1 rounded-lg text-slate-400 hover:text-reject-500 hover:bg-reject-50 dark:hover:bg-reject-500/10 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-reject-500">{error}</p>}

        <button
          onClick={handleUploadAll}
          disabled={uploading || queue.length === 0}
          className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
          {uploading ? 'Uploading…' : `Upload ${queue.length || ''} resume${queue.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  );
};

export default UploadCandidateModal;
