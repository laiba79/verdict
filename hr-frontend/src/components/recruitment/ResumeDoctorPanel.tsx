import { useRef, useState } from 'react';
import { Loader2, Stethoscope, UploadCloud, FileText } from 'lucide-react';
import { resumeDoctor } from '../../services/resources';
import { apiErrorMessage } from '../../services/api';
import type { ResumeDoctorResult } from '../../types';

const ResumeDoctorPanel = () => {
  const [jdText, setJdText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ResumeDoctorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (files: FileList | null) => {
    const f = files?.[0];
    if (f && /\.(pdf|docx)$/i.test(f.name)) setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await resumeDoctor(jdText, file));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="panel p-6 space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-800 dark:text-white mb-1">Resume Doctor</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload a resume plus the job it's targeting, and get specific, actionable improvement suggestions —
            not generic resume advice.
          </p>
        </div>

        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the target job description here…"
          minLength={20}
          maxLength={20000}
          className="w-full min-h-[140px] resize-y px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 outline-none transition-colors"
        />

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10' : 'border-primary-400/40 dark:border-white/10 hover:border-primary-500'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <FileText className="w-4 h-4 text-primary-500" /> {file.name}
            </div>
          ) : (
            <>
              <UploadCloud className="w-7 h-7 mx-auto mb-2 text-primary-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop resume here or click to browse</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PDF or DOCX</p>
            </>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => pickFile(e.target.files)} />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !file || jdText.trim().length < 20}
          className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
          {loading ? 'Analyzing…' : 'Get feedback'}
        </button>
        {error && <p className="text-sm text-reject-500">{error}</p>}
      </div>

      <div className="panel p-6">
        {!result && (
          <div className="h-full flex flex-col items-center justify-center text-center py-16 text-slate-400 dark:text-slate-500">
            <Stethoscope className="w-8 h-8 mb-3" />
            <p className="text-sm">Feedback will appear here.</p>
          </div>
        )}
        {result && (
          <div className="space-y-5 animate-fadeUp">
            <p className="text-sm text-slate-600 dark:text-slate-300">{result.overall_feedback}</p>

            {result.missing_keywords_to_add.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                  Keywords worth adding (if genuinely applicable)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.missing_keywords_to_add.map((k) => (
                    <span key={k} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-pending-50 text-pending-600 dark:bg-pending-500/10 dark:text-pending-400">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.section_suggestions.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">Section-by-section</p>
                <div className="space-y-2.5">
                  {result.section_suggestions.map((s, i) => (
                    <div key={i} className="panel-settle panel p-3.5">
                      <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">{s.section}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{s.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.rewrite_example && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">Example rewrite</p>
                <pre className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.04] rounded-xl p-4 font-sans">
                  {result.rewrite_example}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeDoctorPanel;
