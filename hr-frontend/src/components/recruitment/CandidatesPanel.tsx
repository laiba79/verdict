import { useEffect, useState } from 'react';
import { UploadCloud, Sparkles, Loader2, Trophy, FileText } from 'lucide-react';
import type { JobDescription, Candidate, MatchReport, RankingEntry } from '../../types';
import { getRanking, analyzeCandidate, getCandidateReports } from '../../services/resources';
import { apiErrorMessage } from '../../services/api';
import UploadCandidateModal from './UploadCandidateModal';
import MatchReportModal from './MatchReportModal';
import VerdictBadge from './VerdictBadge';

const CandidatesPanel = ({ jd, onCandidateAdded }: { jd: JobDescription; onCandidateAdded: () => void }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<{ candidate: Candidate; report: MatchReport } | null>(null);

  const refreshRanking = async () => {
    const data = await getRanking(jd.id);
    setRanking(data.ranking);
  };

  useEffect(() => {
    setCandidates([]);
    setRanking([]);
    refreshRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jd.id]);

  const handleUploaded = (candidate: Candidate) => {
    setCandidates((prev) => [...prev, candidate]);
    onCandidateAdded();
  };

  const handleAnalyze = async (candidate: Candidate) => {
    setAnalyzingId(candidate.id);
    setError(null);
    try {
      const report = await analyzeCandidate(candidate.id);
      await refreshRanking();
      setActiveReport({ candidate, report });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleViewReport = async (entry: RankingEntry) => {
    const candidate = candidates.find((c) => c.id === entry.candidate_id) ?? {
      id: entry.candidate_id,
      job_description_id: jd.id,
      full_name: entry.candidate_name,
      file_name: entry.file_name,
      created_at: '',
    };
    const reports = await getCandidateReports(entry.candidate_id);
    if (reports[0]) setActiveReport({ candidate, report: reports[0] });
  };

  const rankedIds = new Set(ranking.map((r) => r.candidate_id));
  const unanalyzed = candidates.filter((c) => !rankedIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-800 dark:text-white">{jd.title}</h2>
            {jd.department && <p className="text-sm text-slate-400 dark:text-slate-500">{jd.department}</p>}
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
          >
            <UploadCloud className="w-4 h-4" /> Upload resumes
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 line-clamp-3">{jd.raw_text}</p>
      </div>

      {error && <div className="panel p-4 text-sm text-reject-500 border-reject-200 dark:border-reject-500/20">{error}</div>}

      {unanalyzed.length > 0 && (
        <div className="panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">
            Awaiting analysis
          </p>
          <div className="space-y-2">
            {unanalyzed.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-200 truncate">
                  {c.full_name || c.file_name}
                </span>
                <button
                  onClick={() => handleAnalyze(c)}
                  disabled={analyzingId === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white transition-colors shrink-0"
                >
                  {analyzingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {analyzingId === c.id ? 'Analyzing…' : 'Analyze'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Ranking
        </p>
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">
            No candidates analyzed yet. Upload resumes and analyze them to see the ranking.
          </p>
        ) : (
          <div className="space-y-2">
            {ranking.map((entry, i) => (
              <button
                key={entry.report_id}
                onClick={() => handleViewReport(entry)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors text-left"
              >
                <span className="font-display text-sm font-bold text-slate-300 dark:text-slate-600 w-5 shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {entry.candidate_name || entry.file_name}
                </span>
                <VerdictBadge verdict={entry.verdict} />
                <span className="font-display text-sm font-bold text-slate-800 dark:text-white tabular w-10 text-right shrink-0">
                  {Math.round(entry.match_score)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadCandidateModal
          jobDescriptionId={jd.id}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {activeReport && (
        <MatchReportModal
          candidate={activeReport.candidate}
          report={activeReport.report}
          onClose={() => setActiveReport(null)}
          onUpdated={(report) => setActiveReport((prev) => prev && { ...prev, report })}
        />
      )}
    </div>
  );
};

export default CandidatesPanel;
