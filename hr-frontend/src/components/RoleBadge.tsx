import { ShieldCheck, Briefcase, User as UserIcon } from 'lucide-react';
import type { UserRole } from '../types';

const STYLES: Record<UserRole, string> = {
  admin: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400',
  hr: 'bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400',
  manager: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
};

const ICONS: Record<UserRole, React.ElementType> = {
  admin: ShieldCheck,
  hr: Briefcase,
  manager: UserIcon,
};

const LABELS: Record<UserRole, string> = { admin: 'Administrator', hr: 'HR', manager: 'Manager' };

const RoleBadge = ({ role }: { role: UserRole }) => {
  const Icon = ICONS[role];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STYLES[role]}`}>
      <Icon className="w-3.5 h-3.5" />
      {LABELS[role]}
    </span>
  );
};

export default RoleBadge;
