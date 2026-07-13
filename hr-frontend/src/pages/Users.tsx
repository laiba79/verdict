import { useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, UserX, UserCheck, Users as UsersIcon } from 'lucide-react';
import { listUsers, createUser, setUserStatus } from '../services/resources';
import { apiErrorMessage } from '../services/api';
import type { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import RoleBadge from '../components/RoleBadge';
import Select from '../components/Select';

const ROLES: UserRole[] = ['manager', 'hr', 'admin'];

const NewUserForm = ({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('manager');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createUser({ email, full_name: fullName || undefined, password, role });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create this account.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Full name</label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Jane Doe" />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
      </div>
      <div>
        <label className={labelClass}>Temporary password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required minLength={6} />
      </div>
      <div>
        <label className={labelClass}>Role</label>
        <Select
          value={role}
          onChange={(v) => setRole(v as UserRole)}
          options={ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
        />
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
        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Create account
        </button>
      </div>
    </form>
  );
};

const Users = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load accounts.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (u: User) => {
    setStatusBusyId(u.id);
    setError(null);
    try {
      await setUserStatus(u.id, !u.is_active);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update that account.'));
    } finally {
      setStatusBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {users.length} account{users.length === 1 ? '' : 's'} with access to the system
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> New account
        </button>
      </div>

      {error && (
        <div className="panel p-4 flex items-center gap-3 text-sm border-reject-200 dark:border-reject-500/20 bg-reject-50/50 dark:bg-reject-500/5 text-reject-600 dark:text-reject-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="panel overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center">
            <UsersIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">No accounts yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.06] text-left text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                <th className="px-6 py-3.5 font-medium">Name</th>
                <th className="px-6 py-3.5 font-medium">Email</th>
                <th className="px-6 py-3.5 font-medium">Role</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 dark:border-white/[0.03] last:border-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-100">
                    {u.full_name || '—'} {u.id === me?.id && <span className="text-xs text-slate-400 font-normal">(you)</span>}
                  </td>
                  <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-xs">{u.email}</td>
                  <td className="px-6 py-3.5"><RoleBadge role={u.role} /></td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.is_active ? 'text-approve-600 dark:text-approve-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-approve-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => toggleStatus(u)}
                        disabled={statusBusyId === u.id}
                        title={u.is_active ? 'Disable account' : 'Re-enable account'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
                          u.is_active
                            ? 'text-reject-600 hover:bg-reject-50 dark:text-reject-400 dark:hover:bg-reject-500/10'
                            : 'text-approve-600 hover:bg-approve-50 dark:text-approve-400 dark:hover:bg-approve-500/10'
                        }`}
                      >
                        {statusBusyId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : u.is_active ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <Modal title="New account" onClose={() => setShowNew(false)} maxWidth="max-w-md">
          <NewUserForm onCreated={() => { setShowNew(false); load(); }} onCancel={() => setShowNew(false)} />
        </Modal>
      )}
    </div>
  );
};

export default Users;