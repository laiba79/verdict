import { useEffect, useState } from 'react';
import { History, Loader2, AlertCircle } from 'lucide-react';
import { getPredictionHistory } from '../services/resources';
import { apiErrorMessage } from '../services/api';
import type { PredictionHistory as PredictionHistoryEntry } from '../types';
import StatusBadge from './StatusBadge';
import ImpactBars from './ImpactBars';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// Per-employee decision timeline -- every prediction ever run for this
// person, newest first, with the outcome, the model's reasoning (SHAP
// features via ImpactBars), and how it was resolved if it needed sign-off.
const EmployeeHistory = ({ employeeId }: { employeeId: number }) => {
  const [entries, setEntries] = useState<PredictionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPredictionHistory(employeeId);
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load this employee\'s history.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [employeeId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>;
  }

  if (error) {
    return (
      <div className="panel p-4 flex items-center gap-3 border-reject-200 dark:border-reject-500/20 bg-reject-50/50 dark:bg-reject-500/5 text-reject-600 dark:text-reject-400 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400 dark:text-slate-500">
          No predictions have been run for this employee yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry.id} className="panel panel-settle p-5 animate-fadeUp">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-display font-semibold text-slate-800 dark:text-white capitalize">
                {entry.target.replace(/_/g, ' ')}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(entry.created_at)}</p>
            </div>
            <StatusBadge status={entry.status} />
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Model predicted: <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{entry.prediction.replace(/_/g, ' ')}</span>
            {entry.confidence !== null && (
              <span className="tabular"> · {(entry.confidence * 100).toFixed(1)}% confidence</span>
            )}
          </p>

          {entry.review_note && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3">"{entry.review_note}"</p>
          )}

          {entry.reviewed_at && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
              Reviewed {formatDate(entry.reviewed_at)}
            </p>
          )}

          {entry.top_features && entry.top_features.length > 0 && (
            <div className="pt-3 border-t border-primary-400/20 dark:border-white/10">
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">Why</p>
              <ImpactBars features={entry.top_features} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default EmployeeHistory;