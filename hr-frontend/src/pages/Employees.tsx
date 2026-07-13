import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Sparkles, Loader2, Users as UsersIcon, History } from 'lucide-react';
import { listEmployees, createEmployee, updateEmployee, deleteEmployee, listManagers } from '../services/resources';
import { apiErrorMessage } from '../services/api';
import type { Employee, EmployeeBase, User } from '../types';
import { DEPARTMENTS, EMPTY_EMPLOYEE } from '../lib/employeeFields';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import EmployeeForm from '../components/EmployeeForm';
import Select from '../components/Select';
import EmployeeHistory from '../components/EmployeeHistory';

const TREND_DOT: Record<string, string> = {
  improving: 'bg-approve-500',
  stable: 'bg-slate-400',
  declining: 'bg-reject-500',
};

const Employees = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === 'admin' || user?.role === 'hr';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const managerName = (id: number | null) => {
    if (id == null) return '—';
    const m = managers.find((mgr) => mgr.id === id);
    return m ? (m.full_name || m.email) : '—';
  };

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');

  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [historyFor, setHistoryFor] = useState<Employee | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEmployees(await listEmployees(0, 200));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load employees.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Manager names are only needed for the "Manager" column and the
    // assignment picker, both of which only Admin/HR interact with --
    // managers themselves get a 403 from this endpoint, which is fine.
    if (canManage) {
      listManagers().then(setManagers).catch(() => {});
    }
  }, [canManage]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch = e.full_name.toLowerCase().includes(search.toLowerCase());
      const matchesDept = department === 'all' || e.department === department;
      return matchesSearch && matchesDept;
    });
  }, [employees, search, department]);

  const handleSave = async (data: EmployeeBase) => {
    try {
      if (editing === 'new') {
        await createEmployee(data);
      } else if (editing) {
        await updateEmployee(editing.id, data);
      }
      setEditing(null);
      await load();
    } catch (err) {
      throw new Error(apiErrorMessage(err, 'Could not save this employee.'));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteEmployee(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete this employee.'));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-ink-800 border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <Select
            value={department}
            onChange={setDepartment}
            className="w-44 shrink-0"
            options={[{ value: 'all', label: 'All departments' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
          />
        </div>

        {canManage && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Add employee
          </button>
        )}
      </div>

      {error && (
        <div className="panel p-4 text-sm text-reject-600 dark:text-reject-400 border-reject-200 dark:border-reject-500/20 bg-reject-50/50 dark:bg-reject-500/5">
          {error}
        </div>
      )}

      <div className="panel overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <UsersIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {employees.length === 0 ? 'No employees yet.' : 'No employees match your filters.'}
            </p>
            {canManage && employees.length === 0 && (
              <button onClick={() => setEditing('new')} className="mt-4 text-sm font-medium text-primary-600 dark:text-primary-400">
                Add your first employee →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.06] text-left text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-3.5 font-medium">Name</th>
                  <th className="px-6 py-3.5 font-medium">Department</th>
                  {canManage && <th className="px-6 py-3.5 font-medium">Manager</th>}
                  <th className="px-6 py-3.5 font-medium">Trend</th>
                  <th className="px-6 py-3.5 font-medium">Tenure</th>
                  <th className="px-6 py-3.5 font-medium">Salary</th>
                  <th className="px-6 py-3.5 font-medium">Quality</th>
                  <th className="px-6 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 dark:border-white/[0.03] last:border-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-100">{emp.full_name}</td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">{emp.department}</td>
                    {canManage && (
                      <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">{managerName(emp.managed_by_user_id)}</td>
                    )}
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5 capitalize text-slate-500 dark:text-slate-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${TREND_DOT[emp.performance_trend]}`} />
                        {emp.performance_trend}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 tabular">{emp.tenure_years}y</td>
                    <td className="px-6 py-3.5 text-slate-700 dark:text-slate-200 tabular font-medium">
                      ${emp.current_salary.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 tabular">{emp.quality_score}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setHistoryFor(emp)}
                          title="View history"
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 dark:hover:text-primary-400 transition-colors"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate('/predictions', { state: { employeeId: emp.id } })}
                          title="Run prediction"
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 dark:hover:text-primary-400 transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => setEditing(emp)}
                              title="Edit"
                              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleting(emp)}
                              title="Delete"
                              className="p-2 rounded-lg text-slate-400 hover:text-reject-600 hover:bg-reject-50 dark:hover:bg-reject-500/10 dark:hover:text-reject-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Add employee' : `Edit ${editing.full_name}`} onClose={() => setEditing(null)} maxWidth="max-w-3xl">
          <EmployeeForm
            initial={editing === 'new' ? EMPTY_EMPLOYEE : editing}
            submitLabel={editing === 'new' ? 'Add employee' : 'Save changes'}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {historyFor && (
        <Modal title={`History · ${historyFor.full_name}`} onClose={() => setHistoryFor(null)} maxWidth="max-w-2xl">
          <EmployeeHistory employeeId={historyFor.id} />
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete employee" onClose={() => setDeleting(null)} maxWidth="max-w-md">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Remove <span className="font-medium text-slate-700 dark:text-slate-200">{deleting.full_name}</span> and their prediction history? This can't be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setDeleting(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteBusy}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-reject-500 hover:bg-reject-600 disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {deleteBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Employees;