import type { TopFeature } from '../types';

// Renders each feature's SHAP contribution as a bar growing left (pulls the
// prediction down/away) or right (pushes it up/toward) from a center zero
// line. This is the recurring "why did the model say that" visual used on
// both the Predictions and Approvals screens.
const ImpactBars = ({ features }: { features: TopFeature[] }) => {
  const withImpact = features.filter(f => f.impact !== null && f.impact !== undefined);
  if (withImpact.length === 0) return null;

  const maxAbs = Math.max(...withImpact.map(f => Math.abs(f.impact as number)), 0.0001);

  return (
    <div className="space-y-2.5">
      {withImpact.map((f) => {
        const impact = f.impact as number;
        const pct = (Math.abs(impact) / maxAbs) * 50; // half-width max (bar grows from center)
        const positive = impact >= 0;
        return (
          <div key={f.feature} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 text-xs">
            <div className="flex items-center justify-end gap-2 min-w-0">
              <span className="truncate text-slate-500 dark:text-slate-400" title={f.feature}>
                {f.feature.replace(/_/g, ' ')}
              </span>
              <span className="tabular text-slate-400 dark:text-slate-500 shrink-0">
                {typeof f.value === 'number' ? f.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : f.value}
              </span>
            </div>
            <div className="relative h-4">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 dark:bg-white/10" />
              <div
                className={
                  positive
                    ? 'absolute top-0 h-4 rounded-sm animate-growBar origin-left bg-approve-400 left-1/2'
                    : 'absolute top-0 h-4 rounded-sm animate-growBar origin-right bg-reject-400 right-1/2'
                }
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ImpactBars;
