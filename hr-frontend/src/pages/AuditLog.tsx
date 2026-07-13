import { useEffect, useState } from 'react';
import { ScrollText, Loader2, AlertCircle, Search } from 'lucide-react';
import { getAuditLog } from '../services/resources';
import { apiErrorMessage } from '../services/api';
import type { AuditLogEntry } from '../types';
import StatusBadge from '../components/StatusBadge';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// System-wide decision audit trail: every prediction ever logged, across
// every employee, regardless of status -- as opposed to /approvals, which
// only shows what's still pending a decision. Restricted to HR/Admin on
// both the route (RoleRoute) and the API (require_roles), same as
// approve/reject.
const AuditLog = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setEntries(await getAuditLog());
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load the audit log.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = entries.filter((e) =>
    e.employee_name.toLowerCase().includes(search.toLowerCase()) ||
    e.target.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="panel px-5 py-3.5 flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
        <ScrollText className="w-4 h-4 text-primary-500 shrink-0" />
        Every prediction ever logged, across all employees and every status — the full decision record, not just what's still pending.
      </div>

      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by employee or target…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-ink-800 border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-primary-500 transition-colors"
        />
      </div>

      {error && (
        <div className="panel p-4 flex items-center gap-3 text-sm border-reject-200 dark:border-reject-500/20 bg-reject-50/50 dark:bg-reject-500/5 text-reject-600 dark:text-reject-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="panel overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <ScrollText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {entries.length === 0 ? 'No decisions have been logged yet.' : 'Nothing matches that search.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.06] text-left text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-3.5 font-medium">Employee</th>
                  <th className="px-6 py-3.5 font-medium">Target</th>
                  <th className="px-6 py-3.5 font-medium">Prediction</th>
                  <th className="px-6 py-3.5 font-medium">Status</th>
                  <th className="px-6 py-3.5 font-medium">Requested by</th>
                  <th className="px-6 py-3.5 font-medium">Reviewed by</th>
                  <th className="px-6 py-3.5 font-medium">Logged</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 dark:border-white/[0.03] last:border-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{e.employee_name}</td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 capitalize whitespace-nowrap">{e.target.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-3.5 text-slate-700 dark:text-slate-200 capitalize whitespace-nowrap">
                      {e.prediction.replace(/_/g, ' ')}
                      {e.confidence !== null && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 tabular"> · {(e.confidence * 100).toFixed(0)}%</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5"><StatusBadge status={e.status} /></td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.requested_by_name ?? '—'}</td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.reviewed_by_name ?? '—'}</td>
                    <td className="px-6 py-3.5 text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">{formatDate(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;