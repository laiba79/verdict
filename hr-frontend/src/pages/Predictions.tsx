import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, Loader2, AlertCircle, Save, Info } from 'lucide-react';
import { predictQuick, predictForEmployee, getEmployee } from '../services/resources';
import { apiErrorMessage } from '../services/api';
import { DEPARTMENTS, TRENDS, NUMERIC_FIELDS, EMPTY_EMPLOYEE } from '../lib/employeeFields';
import type { EmployeeBase, PredictResponse } from '../types';
import ImpactBars from '../components/ImpactBars';
import Select from '../components/Select';

const RESULT_STYLE: Record<string, string> = {
  increase: 'border-approve-200 dark:border-approve-500/20 bg-approve-50/60 dark:bg-approve-500/[0.06]',
  yes: 'border-approve-200 dark:border-approve-500/20 bg-approve-50/60 dark:bg-approve-500/[0.06]',
  decrease: 'border-reject-200 dark:border-reject-500/20 bg-reject-50/60 dark:bg-reject-500/[0.06]',
  no: 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.03]',
  no_change: 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.03]',
};

const resultStyle = (prediction: string) =>
  RESULT_STYLE[prediction.toLowerCase()] ?? 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.03]';

const Predictions = () => {
  const location = useLocation();
  const preloadEmployeeId = (location.state as { employeeId?: number } | null)?.employeeId;

  const [formData, setFormData] = useState<EmployeeBase>(EMPTY_EMPLOYEE);
  const [saveEmployee, setSaveEmployee] = useState(false);
  const [results, setResults] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(!!preloadEmployeeId);

  useEffect(() => {
    if (!preloadEmployeeId) return;
    let cancelled = false;
    (async () => {
      try {
        const emp = await getEmployee(preloadEmployeeId);
        if (cancelled) return;
        setEmployeeName(emp.full_name);
        const { id, created_at, updated_at, ...base } = emp;
        setFormData(base);
      } catch {
        // fall back to blank quick-predict form
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [preloadEmployeeId]);

  const updateField = (key: keyof EmployeeBase, value: string | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = preloadEmployeeId
        ? await predictForEmployee(preloadEmployeeId)
        : await predictQuick({ ...formData, save_employee: saveEmployee });
      setResults(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5";

  if (prefillLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {employeeName && (
        <div className="panel px-5 py-3.5 flex items-center gap-2.5 text-sm">
          <Info className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="text-slate-600 dark:text-slate-300">
            Running against saved employee <span className="font-semibold text-slate-800 dark:text-white">{employeeName}</span>. This will be logged to their history.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="panel p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={labelClass}>Full name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
              className={inputClass}
              disabled={!!preloadEmployeeId}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <Select
              value={formData.department}
              onChange={(v) => updateField('department', v)}
              options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
              disabled={!!preloadEmployeeId}
            />
          </div>
          <div>
            <label className={labelClass}>Performance trend</label>
            <Select
              value={formData.performance_trend}
              onChange={(v) => updateField('performance_trend', v)}
              options={TRENDS.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
              disabled={!!preloadEmployeeId}
            />
          </div>

          {NUMERIC_FIELDS.map(({ key, label, step, min, max }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input
                type="number"
                step={step}
                min={min}
                max={max}
                value={formData[key] as number}
                onChange={(e) => updateField(key, parseFloat(e.target.value))}
                className={inputClass}
                disabled={!!preloadEmployeeId}
                required
              />
            </div>
          ))}
        </div>

        {!preloadEmployeeId && (
          <label className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={saveEmployee}
              onChange={(e) => setSaveEmployee(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-500"
            />
            <Save className="w-3.5 h-3.5" />
            Save this as a new employee record (so the prediction is logged to their history)
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Running models…' : 'Get AI recommendation'}
        </button>
      </form>

      {error && (
        <div className="panel p-5 flex items-start gap-3 border-reject-200 dark:border-reject-500/20 bg-reject-50/50 dark:bg-reject-500/5 text-reject-600 dark:text-reject-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {results && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Object.entries(results.results).map(([target, result]) => (
            <div key={target} className={`panel p-6 border animate-fadeUp ${resultStyle(result.prediction)}`}>
              <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mb-2">
                {target.replace(/_/g, ' ')}
              </h3>
              <p className="font-display text-2xl font-semibold text-slate-800 dark:text-white capitalize mb-1">
                {result.prediction.replace(/_/g, ' ')}
              </p>
              {result.confidence !== null && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 tabular">
                  {(result.confidence * 100).toFixed(1)}% confidence
                </p>
              )}

              {result.top_features.length > 0 && (
                <div className="pt-4 border-t border-slate-200/70 dark:border-white/10">
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">Why</p>
                  <ImpactBars features={result.top_features} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Predictions;