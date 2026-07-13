import { useState } from 'react';
import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { checkBias } from '../../services/resources';
import { apiErrorMessage } from '../../services/api';
import type { BiasCheckResult } from '../../types';

const RISK_STYLE: Record<string, { badge: string; icon: typeof ShieldCheck }> = {
  low: { badge: 'bg-approve-50 text-approve-600 dark:bg-approve-500/10 dark:text-approve-400', icon: ShieldCheck },
  moderate: { badge: 'bg-pending-50 text-pending-600 dark:bg-pending-500/10 dark:text-pending-400', icon: ShieldQuestion },
  high: { badge: 'bg-reject-50 text-reject-600 dark:bg-reject-500/10 dark:text-reject-400', icon: ShieldAlert },
};

const BiasCheckerPanel = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<BiasCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await checkBias(text));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const risk = result ? RISK_STYLE[result.overall_risk.toLowerCase()] ?? RISK_STYLE.moderate : null;
  const RiskIcon = risk?.icon ?? ShieldQuestion;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="panel p-6 space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-800 dark:text-white mb-1">Inclusive-language checker</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Paste a job description before posting it — the AI flags gendered, ableist, age-coded, or
            unnecessarily exclusionary language and suggests neutral rewrites.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste job description text here…"
          minLength={20}
          maxLength={20000}
          className="w-full min-h-[260px] resize-y px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-primary-400/40 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 focus:border-primary-500 outline-none transition-colors"
        />
        <button
          onClick={handleCheck}
          disabled={loading || text.trim().length < 20}
          className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {loading ? 'Checking…' : 'Check for bias'}
        </button>
        {error && <p className="text-sm text-reject-500">{error}</p>}
      </div>

      <div className="panel p-6">
        {!result && (
          <div className="h-full flex flex-col items-center justify-center text-center py-16 text-slate-400 dark:text-slate-500">
            <ShieldQuestion className="w-8 h-8 mb-3" />
            <p className="text-sm">Results will appear here.</p>
          </div>
        )}
        {result && (
          <div className="space-y-5 animate-fadeUp">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${risk?.badge}`}>
                <RiskIcon className="w-3.5 h-3.5" /> {result.overall_risk} risk
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{result.summary}</p>

            {result.flags.length === 0 ? (
              <p className="text-sm text-approve-600 dark:text-approve-400">No issues flagged — looks clean.</p>
            ) : (
              <div className="space-y-3">
                {result.flags.map((flag, i) => (
                  <div key={i} className="panel-settle panel p-4">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-reject-50 text-reject-600 dark:bg-reject-500/10 dark:text-reject-400">
                        "{flag.phrase}"
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{flag.category}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">{flag.why}</p>
                    <p className="text-xs text-approve-600 dark:text-approve-400">
                      Try instead: <span className="font-medium">"{flag.suggestion}"</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BiasCheckerPanel;
