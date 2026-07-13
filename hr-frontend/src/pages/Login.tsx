import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, ShieldCheck, Sun, Moon } from 'lucide-react';
import { apiErrorMessage } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(apiErrorMessage(err, 'Incorrect email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-ink-900">
      {/* Left: brand / context panel — deliberately stays on the dark
          gradient in both themes, it's a brand moment, not app chrome */}
      <div className="relative hidden lg:flex flex-col justify-between p-14 overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-primary-700">
        <div className="absolute inset-0 grid-texture" />
        <div className="absolute -top-16 -left-10 w-72 h-72 rounded-full bg-primary-400/20 blur-3xl animate-floatSlow" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-approve-400/10 blur-3xl animate-floatSlower" />
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="font-display font-bold text-white text-sm">HR</span>
          </div>
          <span className="font-display font-semibold text-white text-2xl tracking-tight">Verdict</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold text-white leading-tight mb-4">
            Every recommendation, explained before it's{' '}
            <span className="italic text-clay-400">approved.</span>
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Salary changes, WFH eligibility, and Saturday assignments are predicted from real
            performance data — with the exact factors behind each call, and a human sign-off
            before anything actually changes.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-white/50 text-xs">
          <ShieldCheck className="w-4 h-4" />
          Role-scoped access · every salary decision is logged and reviewable
        </div>
      </div>

      {/* Right: form — follows the app's light/dark theme */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="absolute top-5 right-5 sm:top-6 sm:right-6 w-9 h-9 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="font-display font-bold text-white text-sm">HR</span>
            </div>
            <span className="font-display font-semibold text-slate-900 dark:text-white">HR Decision System</span>
          </div>

          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 dark:text-white/40 mb-8">Enter your account details to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 text-sm focus:border-primary-400 focus:bg-white dark:focus:bg-white/[0.08] transition-colors outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 text-sm focus:border-primary-400 focus:bg-white dark:focus:bg-white/[0.08] transition-colors outline-none"
                required
              />
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-reject-50 dark:bg-reject-500/10 border border-reject-200 dark:border-reject-500/20 text-reject-600 dark:text-reject-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 dark:text-white/30 mt-8">
            Access is provisioned by an admin — no public sign-up.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;