import { Clock, Check, X } from 'lucide-react';
import type { ApprovalStatus } from '../types';

const STYLES: Record<ApprovalStatus, string> = {
  pending: 'bg-pending-50 text-pending-600 dark:bg-pending-500/10 dark:text-pending-400',
  approved: 'bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400',
  rejected: 'bg-reject-50 text-reject-600 dark:bg-reject-500/10 dark:text-reject-400',
};

const ICONS: Record<ApprovalStatus, React.ElementType> = {
  pending: Clock,
  approved: Check,
  rejected: X,
};

const StatusBadge = ({ status }: { status: ApprovalStatus }) => {
  const Icon = ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STYLES[status]}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
};

export default StatusBadge;
