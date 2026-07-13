import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut } from 'lucide-react';

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Live snapshot of your workforce and model activity' },
  '/employees': { title: 'Employees', subtitle: 'Manage the people the models make predictions about' },
  '/predictions': { title: 'Predictions', subtitle: 'Run the model against new or saved employee data' },
  '/approvals': { title: 'Approvals', subtitle: 'Review and sign off on salary-affecting predictions' },
  '/audit-log': { title: 'Audit Log', subtitle: 'Every prediction and decision ever logged, across every employee' },
  '/users': { title: 'Accounts', subtitle: 'Manage who has access to the system' },
};

const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', hr: 'HR', manager: 'Manager' };

const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const page = TITLES[pathname] ?? { title: '', subtitle: '' };

  const initials = (user?.full_name || user?.email || '?')
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');

  return (
    <header className="h-[72px] shrink-0 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-ink-800/80 backdrop-blur px-8 flex items-center justify-between">
      <div>
        <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-white leading-tight">{page.title}</h1>
        {page.subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{page.subtitle}</p>}
      </div>

      <div className="flex items-center gap-5">
        <button
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:scale-110 dark:text-slate-400 dark:hover:bg-white/10 transition-all duration-200"
        >
          {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center font-display text-xs font-semibold shrink-0 transition-transform duration-200 hover:scale-105">
            {initials}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">
              {user?.full_name || user?.email}
            </div>
            <div className="text-[11px] text-primary-600 dark:text-primary-400 font-medium">
              {user ? ROLE_LABEL[user.role] : ''}
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="p-2 rounded-lg text-slate-400 hover:text-reject-500 hover:bg-reject-50 hover:scale-110 dark:hover:bg-reject-500/10 transition-all duration-200"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;