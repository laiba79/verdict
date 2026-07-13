const STYLES: Record<string, string> = {
  'strong match': 'bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400',
  'good match': 'bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400',
  'partial match': 'bg-pending-50 text-pending-600 dark:bg-pending-500/10 dark:text-pending-400',
  'not a match': 'bg-reject-50 text-reject-600 dark:bg-reject-500/10 dark:text-reject-400',
};

const VerdictBadge = ({ verdict }: { verdict: string }) => {
  const cls = STYLES[verdict.toLowerCase()] ?? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {verdict}
    </span>
  );
};

export default VerdictBadge;
