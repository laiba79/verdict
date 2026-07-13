import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ClipboardCheck, Brain, TrendingUp, AlertCircle, ArrowUpRight } from 'lucide-react';
import { listEmployees, listPendingPredictions, getModelsStatus, getPipelineSnapshot } from '../services/resources';
import { apiErrorMessage } from '../services/api';
import type { Employee, PredictionHistory, PipelineSnapshot } from '../types';
import StatCard from '../components/StatCard';
import BarList from '../components/BarList';
import StatusBadge from '../components/StatusBadge';
import PipelineSnapshotWidget from '../components/PipelineSnapshotWidget';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pending, setPending] = useState<PredictionHistory[]>([]);
  const [modelsReady, setModelsReady] = useState<boolean | null>(null);
  const [pipelineSnapshot, setPipelineSnapshot] = useState<PipelineSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canSeeRecruitment = user?.role === 'admin' || user?.role === 'hr';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [emp, pend, models] = await Promise.all([
          listEmployees(0, 200),
          listPendingPredictions(),
          getModelsStatus(),
        ]);
        if (cancelled) return;
        setEmployees(emp);
        setPending(pend);
        setModelsReady(models.ready);

        // Fetched separately (not Promise.all'd with the rest) so that if
        // it fails -- e.g. role not permitted, or not yet reachable -- it
        // doesn't block the rest of the dashboard from rendering.
        if (canSeeRecruitment) {
          try {
            const snapshot = await getPipelineSnapshot();
            if (!cancelled) setPipelineSnapshot(snapshot);
          } catch {
            if (!cancelled) setPipelineSnapshot(null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load dashboard data.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeRecruitment]);

  const avgConfidence = (() => {
    const withConf = pending.filter(p => p.confidence !== null);
    if (withConf.length === 0) return null;
    return withConf.reduce((sum, p) => sum + (p.confidence as number), 0) / withConf.length;
  })();

  const byDepartment = Object.entries(
    employees.reduce<Record<string, number>>((acc, e) => {
      acc[e.department] = (acc[e.department] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const decliningCount = employees.filter(e => e.performance_trend === 'declining').length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="panel p-6 h-32 animate-pulse bg-slate-100/60 dark:bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="panel p-4 flex items-center gap-3 border-reject-200 dark:border-reject-500/20 bg-reject-50/50 dark:bg-reject-500/5 text-reject-600 dark:text-reject-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total employees"
          value={employees.length.toLocaleString()}
          icon={Users}
          accent="primary"
          hint={user?.role === 'manager' ? 'On your team' : 'Across all teams'}
        />
        <StatCard
          label="Pending approvals"
          value={pending.length.toLocaleString()}
          icon={ClipboardCheck}
          accent="pending"
          hint="Awaiting HR / Admin review"
        />
        <StatCard
          label="Avg. model confidence"
          value={avgConfidence !== null ? `${(avgConfidence * 100).toFixed(0)}%` : '—'}
          icon={TrendingUp}
          accent="approve"
          hint="Across pending predictions"
        />
        <StatCard
          label="Model status"
          value={modelsReady ? 'Ready' : 'Not loaded'}
          icon={Brain}
          accent={modelsReady ? 'approve' : 'reject'}
          hint={modelsReady ? 'All 3 targets trained' : 'Run scripts/train_models.py'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white">Employees by department</h3>
          </div>
          {byDepartment.length > 0 ? (
            <BarList items={byDepartment} />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">No employees yet — add one from the Employees page.</p>
          )}
          {decliningCount > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2 text-sm text-pending-600 dark:text-pending-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {decliningCount} employee{decliningCount === 1 ? '' : 's'} with a declining performance trend
            </div>
          )}
        </div>

        <div className="lg:col-span-3 panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white">Recent pending predictions</h3>
            <Link to="/approvals" className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:gap-1.5 transition-all">
              Review all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400 dark:text-slate-500">Nothing waiting on a decision right now.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {pending.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 dark:border-white/[0.04] last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">
                      {p.target.replace(/_/g, ' ')} <span className="text-slate-400 dark:text-slate-500 font-normal">· employee #{p.employee_id}</span>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 capitalize">Predicted: {p.prediction}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canSeeRecruitment && pipelineSnapshot && (
        <PipelineSnapshotWidget snapshot={pipelineSnapshot} />
      )}
    </div>
  );
};

export default Dashboard;
