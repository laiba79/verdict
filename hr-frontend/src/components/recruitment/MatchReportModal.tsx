import { useState } from 'react';
import { CheckCircle2, XCircle, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import type { MatchReport, Candidate } from '../../types';
import { generateInterviewQuestions } from '../../services/resources';
import { apiErrorMessage } from '../../services/api';
import Modal from '../Modal';
import ScoreRing from './ScoreRing';
import VerdictBadge from './VerdictBadge';

const BREAKDOWN_LABELS: { key: keyof MatchReport['breakdown']; label: string }[] = [
  { key: 'skills_match', label: 'Skills' },
  { key: 'experience_match', label: 'Experience' },
  { key: 'education_match', label: 'Education' },
];

const MatchReportModal = ({
  candidate,
  report,
  onClose,
  onUpdated,
}: {
  candidate: Candidate;
  report: MatchReport;
  onClose: () => void;
  onUpdated: (report: MatchReport) => void;
}) => {
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateQuestions = async () => {
    setLoadingQuestions(true);
    setError(null);
    try {
      const updated = await generateInterviewQuestions(candidate.id);
      onUpdated(updated);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingQuestions(false);
    }
  };

  return (
    <Modal title={candidate.full_name || candidate.file_name} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-6">
        <div className="flex items-start gap-5">
          <div className="flex items-end gap-3 shrink-0">
            <div className="text-center">
              <ScoreRing score={report.match_score} />
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wide">AI Match</div>
            </div>
            {report.semantic_similarity != null && (
              <div className="text-center">
                <ScoreRing score={report.semantic_similarity} size={64} />
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wide">Semantic</div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2.5 mb-2">
              <VerdictBadge verdict={report.verdict} />
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {candidate.file_name}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{report.summary}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {BREAKDOWN_LABELS.map(({ key, label }) => (
            <div key={key} className="panel p-4 text-center">
              <div className="font-display text-2xl font-bold text-slate-800 dark:text-white tabular">
                {Math.round(report.breakdown[key])}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-approve-500" /> Matched keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {report.matched_keywords.length === 0 && <span className="text-xs text-slate-400">None found</span>}
              {report.matched_keywords.map((k) => (
                <span key={k} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400">
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-reject-500" /> Missing keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {report.missing_keywords.length === 0 && <span className="text-xs text-slate-400">None — full coverage</span>}
              {report.missing_keywords.map((k) => (
                <span key={k} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-reject-50 text-reject-600 dark:bg-reject-500/10 dark:text-reject-400">
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2.5">Strengths</p>
            <ul className="space-y-1.5">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex gap-2">
                  <span className="text-approve-500 shrink-0">+</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2.5">Gaps</p>
            <ul className="space-y-1.5">
              {report.gaps.map((g, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex gap-2">
                  <span className="text-reject-500 shrink-0">−</span>{g}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Suggested interview questions
            </p>
            {!report.interview_questions && (
              <button
                onClick={handleGenerateQuestions}
                disabled={loadingQuestions}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-60"
              >
                {loadingQuestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate
              </button>
            )}
          </div>
          {error && <p className="text-xs text-reject-500 mb-2">{error}</p>}
          {report.interview_questions ? (
            <div className="space-y-3">
              {report.interview_questions.map((q, i) => (
                <div key={i} className="panel-settle panel p-4">
                  <p className="text-sm font-medium text-slate-800 dark:text-white mb-1">{q.question}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{q.why}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Generate a set of interview questions targeted at this candidate's specific gaps.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MatchReportModal;
