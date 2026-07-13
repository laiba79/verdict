import { NavLink } from 'react-router-dom';
import { LayoutGrid, Users, Sparkles, ClipboardCheck, ShieldCheck, ScrollText, UserSearch, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, roles: ['admin', 'hr', 'manager'] },
  { to: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'hr', 'manager'] },
  { to: '/predictions', label: 'Predictions', icon: Sparkles, roles: ['admin', 'hr', 'manager'] },
  { to: '/model-insights', label: 'Model Insights', icon: BarChart3, roles: ['admin', 'hr', 'manager'] },
  { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, roles: ['admin', 'hr', 'manager'] },
  { to: '/recruitment', label: 'Recruitment', icon: UserSearch, roles: ['admin', 'hr'] },
  { to: '/audit-log', label: 'Audit Log', icon: ScrollText, roles: ['admin', 'hr'] },
  { to: '/users', label: 'Accounts', icon: ShieldCheck, roles: ['admin'] },
];

const Sidebar = () => {
  const { user } = useAuth();
  const items = NAV_ITEMS.filter(i => !user || i.roles.includes(user.role));

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-white/[0.06] bg-white dark:bg-ink-800 p-5 flex flex-col">
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
          <span className="font-display font-bold text-white text-base">HR</span>
        </div>
        <div className="leading-tight">
          <div className="font-display font-bold text-slate-900 dark:text-white text-2xl tracking-tight">Verdict</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 tracking-wide">Decision Intelligence</div>
        </div>
      </div>

      <nav className="space-y-1 flex-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-glow dark:bg-primary-500/10 dark:text-primary-400'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:translate-x-0.5 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
        Predictions include SHAP feature attribution so every recommendation can be explained before it's approved.
      </div>
    </aside>
  );
};

export default Sidebar;