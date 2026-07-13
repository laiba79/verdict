interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: 'primary' | 'approve' | 'pending' | 'reject';
  hint?: string;
}

const ACCENTS = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400',
  approve: 'bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400',
  pending: 'bg-pending-50 text-pending-600 dark:bg-pending-500/10 dark:text-pending-400',
  reject: 'bg-reject-50 text-reject-600 dark:bg-reject-500/10 dark:text-reject-400',
};

const StatCard = ({ label, value, icon: Icon, accent, hint }: StatCardProps) => (
  <div className="group panel panel-hover p-6 animate-fadeUp">
    <div className="flex items-start justify-between mb-6">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${ACCENTS[accent]}`}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
    </div>
    <div className="font-display text-3xl font-semibold text-slate-900 dark:text-white tabular">{value}</div>
    {hint && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{hint}</div>}
  </div>
);

export default StatCard;
