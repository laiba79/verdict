interface BarItem {
  label: string;
  value: number;
}

const BarList = ({ items, colorClass = 'bg-primary-500' }: { items: BarItem[]; colorClass?: string }) => {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-3.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-600 dark:text-slate-300 font-medium">{item.label}</span>
            <span className="text-slate-400 dark:text-slate-500 tabular">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full ${colorClass} animate-growBar origin-left`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default BarList;
