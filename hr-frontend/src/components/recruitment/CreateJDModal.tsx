import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createJobDescription } from '../../services/resources';
import { apiErrorMessage } from '../../services/api';
import type { JobDescription } from '../../types';
import Modal from '../Modal';

const CreateJDModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: (jd: JobDescription) => void }) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const jd = await createJobDescription({ title, department: department || undefined, raw_text: rawText });
      onCreated(jd);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New job description" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Job title</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div>
            <label className={labelClass}>Department (optional)</label>
            <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Full job description text</label>
          <textarea
            className={`${inputClass} min-h-[220px] resize-y`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the full job description here — responsibilities, required skills, experience level, etc. The more detail, the more accurate the AI matching will be."
            required
            minLength={20}
            maxLength={20000}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{rawText.length}/20000 characters</p>
        </div>
        {error && <p className="text-sm text-reject-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Creating…' : 'Create job description'}
        </button>
      </form>
    </Modal>
  );
};

export default CreateJDModal;
