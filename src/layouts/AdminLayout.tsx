import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { UserPlus, AlertTriangle, LogOut, Menu, ChevronLeft, Bell, MailOpen } from 'lucide-react';
import { ROUTES } from '@/config/constants';
import { useAppDispatch, useUser } from '@/hooks';
import { logoutUser } from '@/features/auth';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: ROUTES.ADMIN_ADD_FA,     icon: UserPlus,      label: 'Add Associate' },
  { to: ROUTES.ADMIN_INCIDENTS,  icon: AlertTriangle, label: 'Incidents'     },
  { to: ROUTES.ADMIN_MAILBOXES,  icon: MailOpen,      label: 'Mailboxes'     },
];

const Sidebar = ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useUser();
  const handleLogout = async () => { await dispatch(logoutUser()); navigate(ROUTES.LOGIN); };

  return (
    <aside className={clsx('flex flex-col transition-all duration-300 shrink-0 relative bg-[#0f172a] border-r border-[#1e293b]', collapsed ? 'w-16' : 'w-60')}>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
      <div className={clsx('flex items-center gap-3 border-b border-[#1e293b]', collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4')}>
        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        {!collapsed && (<div className="flex-1 min-w-0"><span className="font-display font-bold text-sm tracking-tight text-white whitespace-nowrap block">PaisaVasool</span><span className="text-[10px] text-amber-400 font-medium tracking-widest uppercase">Admin Panel</span></div>)}
        {!collapsed && (<button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-[#1e293b] transition-colors text-slate-500 hover:text-slate-300"><ChevronLeft className="w-3.5 h-3.5" /></button>)}
        {collapsed && (<button onClick={onToggle} className="absolute -right-3 top-5 w-6 h-6 bg-[#0f172a] border border-[#1e293b] rounded-full flex items-center justify-center hover:bg-amber-600 transition-colors text-slate-400 hover:text-white shadow-md"><ChevronLeft className="w-3 h-3 rotate-180" /></button>)}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {!collapsed && (<p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 pb-2">Admin Tools</p>)}
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl transition-all duration-150 group relative', collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5', isActive ? 'bg-amber-600/20 text-amber-300' : 'text-slate-400 hover:bg-[#1e293b] hover:text-slate-100')}>
            {({ isActive }) => (<>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-500 rounded-r-full" />}
              <Icon size={17} className={clsx('shrink-0', isActive ? 'text-amber-400' : '')} />
              {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
              {collapsed && <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1e293b] text-slate-100 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-lg z-50 transition-opacity">{label}</span>}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-[#1e293b]">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl bg-[#1e293b]/60">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shrink-0"><span className="text-white text-xs font-bold">{user.name?.charAt(0).toUpperCase()}</span></div>
            <div className="flex-1 min-w-0"><p className="text-xs text-slate-200 font-semibold truncate">{user.name}</p><p className="text-[10px] text-amber-400/80 truncate">Administrator</p></div>
          </div>
        )}
        <button onClick={handleLogout} className={clsx('w-full flex items-center gap-3 rounded-xl text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-all duration-150', collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5')}>
          <LogOut size={16} className="shrink-0" />{!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useUser();
  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <div className="hidden md:flex"><Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} /></div>
      {mobileOpen && (<div className="md:hidden fixed inset-0 z-50 flex"><div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><div className="relative z-10 flex"><Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} /></div></div>)}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-surface-200 flex items-center px-6 py-3 gap-4 shrink-0">
          <button className="md:hidden p-2 rounded-lg hover:bg-surface-100" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="flex-1" />
          <button className="relative p-2 rounded-xl hover:bg-surface-100 transition-colors"><Bell size={17} className="text-surface-500" /><span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" /></button>
          <div className="flex items-center gap-2.5 pl-3 border-l border-surface-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center"><span className="text-white text-xs font-bold font-display">{user?.name?.charAt(0).toUpperCase()}</span></div>
            {user && (<div className="hidden sm:block"><p className="text-sm font-semibold text-surface-900 leading-none">{user.name}</p><p className="text-xs text-amber-600 mt-0.5 font-medium">Administrator</p></div>)}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto"><Outlet /></div>
      </main>
    </div>
  );
};
export default AdminLayout;
