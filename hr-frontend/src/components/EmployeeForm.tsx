import { useEffect, useState } from 'react';
import type { EmployeeBase, User } from '../types';
import { DEPARTMENTS, TRENDS, NUMERIC_FIELDS } from '../lib/employeeFields';
import { listManagers } from '../services/resources';
import { Loader2 } from 'lucide-react';
import Select from './Select';

interface EmployeeFormProps {
  initial: EmployeeBase;
  submitLabel: string;
  onSubmit: (data: EmployeeBase) => Promise<void>;
  onCancel: () => void;
}

const EmployeeForm = ({ initial, submitLabel, onSubmit, onCancel }: EmployeeFormProps) => {
  const [form, setForm] = useState<EmployeeBase>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [managers, setManagers] = useState<User[]>([]);
  const [managersError, setManagersError] = useState(false);

  useEffect(() => {
    listManagers()
      .then(setManagers)
      .catch(() => setManagersError(true)); // e.g. logged in as a role without access -- picker just won't show options
  }, []);

  const update = (key: keyof EmployeeBase, value: string | number | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err?.message ?? 'Could not save this employee.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className={labelClass}>Full name</label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Department</label>
          <Select
            value={form.department}
            onChange={(v) => update('department', v)}
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          />
        </div>
        <div>
          <label className={labelClass}>Performance trend</label>
          <Select
            value={form.performance_trend}
            onChange={(v) => update('performance_trend', v)}
            options={TRENDS.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Manager</label>
        <Select
          value={form.managed_by_user_id != null ? String(form.managed_by_user_id) : ''}
          onChange={(v) => update('managed_by_user_id', v === '' ? null : Number(v))}
          options={[
            { value: '', label: 'Unassigned' },
            ...managers.map((m) => ({ value: String(m.id), label: m.full_name || m.email })),
          ]}
        />
        {managersError && (
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            Couldn't load the list of managers -- you can still save without assigning one.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {NUMERIC_FIELDS.map(({ key, label, step, min, max }) => (
          <div key={key}>
            <label className={labelClass}>{label}</label>
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              value={form[key] as number}
              onChange={(e) => update(key, parseFloat(e.target.value))}
              className={inputClass}
              required
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-reject-50 dark:bg-reject-500/10 border border-reject-200 dark:border-reject-500/20 text-reject-600 dark:text-reject-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export default EmployeeForm;