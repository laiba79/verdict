import { Link } from 'react-router-dom';
import { Briefcase, FileText, Target, ArrowUpRight } from 'lucide-react';
import type { PipelineSnapshot } from '../types';
import BarList from './BarList';

const PipelineSnapshotWidget = ({ snapshot }: { snapshot: PipelineSnapshot }) => {
  const hasReports = snapshot.reports_generated > 0;

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display font-semibold text-slate-900 dark:text-white">Hiring pipeline snapshot</h3>
        <Link
          to="/recruitment"
          className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:gap-1.5 transition-all"
        >
          Open Recruitment <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 mb-2">
            <Briefcase className="w-[18px] h-[18px]" />
          </div>
          <div className="font-display text-xl font-semibold text-slate-900 dark:text-white tabular">
            {snapshot.open_job_descriptions}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">Open roles</div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 mb-2">
            <FileText className="w-[18px] h-[18px]" />
          </div>
          <div className="font-display text-xl font-semibold text-slate-900 dark:text-white tabular">
            {snapshot.candidates_uploaded}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">Candidates</div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400 mb-2">
            <Target className="w-[18px] h-[18px]" />
          </div>
          <div className="font-display text-xl font-semibold text-slate-900 dark:text-white tabular">
            {snapshot.average_match_score !== null ? `${snapshot.average_match_score}%` : '—'}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">Avg. match score</div>
        </div>
      </div>

      {hasReports ? (
        <div className="pt-5 border-t border-slate-100 dark:border-white/[0.06] space-y-5">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Verdict breakdown</div>
            <BarList
              items={snapshot.verdict_breakdown.map(v => ({ label: v.verdict, value: v.count }))}
              colorClass="bg-primary-500"
            />
          </div>

          {snapshot.top_missing_keywords.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Most commonly missing keywords
              </div>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.top_missing_keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-2 py-1 rounded-md bg-reject-50 text-reject-600 dark:bg-reject-500/10 dark:text-reject-400"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500 pt-5 border-t border-slate-100 dark:border-white/[0.06]">
          No candidates analyzed yet — upload a resume against a job description in Recruitment to see match stats here.
        </p>
      )}
    </div>
  );
};

export default PipelineSnapshotWidget;
