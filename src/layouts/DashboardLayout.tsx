import { useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, ChevronLeft, Link2 } from 'lucide-react';
import { ROUTES } from '@/config/constants';
import { useAppDispatch, useUser } from '@/hooks';
import { logoutUser } from '@/features/auth';
import clsx from 'clsx';
import { NotificationBell } from '@/features/disputes/components/NotificationBell';
import { useNewMessageNotifications } from '@/features/disputes/hooks/useNewMessageNotifications';
import { createContext, useContext } from 'react';

export const OpenDisputeContext = createContext<((id: number) => void) | null>(null);
export const useOpenDispute = () => useContext(OpenDisputeContext);

// Light gray sidebar — clean, neutral, professional
const SB_BG      = '#F4F4F6';   // surface-100
const SB_BORDER  = '#E8E8ED';   // surface-200
const SB_TEXT    = '#6b6b80';   // surface-500
const SB_HOVER   = '#e8e8ed';   // surface-200
const SB_ACTIVE_BG   = '#dbeafe';   // brand-100
const SB_ACTIVE_TEXT = '#1d4ed8';   // brand-700
const SB_ACTIVE_BAR  = '#2563eb';   // brand-600
const SB_MUTED   = '#9898aa';   // surface-400
const SB_AVATAR  = '#2563eb';   // brand-600

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD,    icon: LayoutDashboard, label: 'Cases'        },
  { to: ROUTES.AR_DOCUMENTS, icon: Link2,            label: 'AR Documents' },
];

const Sidebar = ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useUser();
  const handleLogout = async () => { await dispatch(logoutUser()); navigate(ROUTES.LOGIN); };

  return (
    <aside
      className={clsx('flex flex-col shrink-0 relative transition-all duration-300 border-r', collapsed ? 'w-16' : 'w-60')}
      style={{ background: SB_BG, borderColor: SB_BORDER }}
    >
      {/* Purple top accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />

      {/* Logo */}
      <div className={clsx('flex items-center gap-3 transition-all duration-300 border-b', collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4')} style={{ borderColor: SB_BORDER }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: SB_AVATAR }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        {!collapsed && (<div className="flex-1 min-w-0">
          <span className="font-display font-bold text-sm tracking-tight text-surface-800 whitespace-nowrap block">PaisaVasool</span>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-brand-500">AR Suite</span>
        </div>)}
        {!collapsed && (
          <button onClick={onToggle} className="p-1.5 rounded-lg transition-colors hover:bg-surface-200 text-surface-400 hover:text-surface-600">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
        {collapsed && (
          <button onClick={onToggle}
            className="absolute -right-3 top-5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-all bg-white border text-surface-400 hover:bg-brand-600 hover:border-brand-600 hover:text-white"
            style={{ borderColor: SB_BORDER }}>
            <ChevronLeft className="w-3 h-3 rotate-180" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {!collapsed && <p className="text-[10px] font-bold uppercase tracking-widest px-3 pb-2" style={{ color: SB_MUTED }}>Menu</p>}
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 rounded-xl transition-all duration-150 group relative',
              collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5',
            )}
            style={({ isActive }) => isActive
              ? { background: SB_ACTIVE_BG, color: SB_ACTIVE_TEXT }
              : { color: SB_TEXT }
            }
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!el.style.background || el.style.background === 'none') { el.style.background = SB_HOVER; el.style.color = '#3a3a4a'; } }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (el.style.background === SB_HOVER) { el.style.background = ''; el.style.color = SB_TEXT; } }}>
            {({ isActive }) => (<>
              {isActive && !collapsed && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: SB_ACTIVE_BAR }} />}
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span className={clsx('text-sm whitespace-nowrap', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>}
              {collapsed && <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-surface-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-lg z-50 transition-opacity">{label}</span>}
            </>)}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-2 border-t" style={{ borderColor: SB_BORDER }}>
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl bg-white border" style={{ borderColor: SB_BORDER }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: SB_AVATAR }}>
              <span className="text-white text-xs font-bold">{user.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-surface-800 font-semibold truncate">{user.name}</p>
              <p className="text-[10px] truncate text-brand-500">{user.email}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className={clsx('w-full flex items-center gap-3 rounded-xl transition-all duration-150 hover:bg-red-50 hover:text-red-500', collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5')}
          style={{ color: SB_MUTED }}>
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useUser();
  const { notifications, isPolling, markRead, markAllRead } = useNewMessageNotifications();
  const [openDisputeId, setOpenDisputeId] = useState<number | null>(null);
  const handleOpenDispute = useCallback((id: number) => {
    setOpenDisputeId(id);
    setTimeout(() => setOpenDisputeId(null), 500);
  }, []);

  return (
    <OpenDisputeContext.Provider value={handleOpenDispute}>
      <div className="flex h-screen overflow-hidden bg-surface-50">
        <div className="hidden md:flex"><Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} /></div>
        {mobileOpen && (<div className="md:hidden fixed inset-0 z-50 flex"><div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><div className="relative z-10 flex"><Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} /></div></div>)}
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-surface-200 flex items-center px-6 py-3 gap-4 shrink-0">
            <button className="md:hidden p-2 rounded-lg hover:bg-surface-100 text-surface-500" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
            <div className="flex-1" />
            <NotificationBell notifications={notifications} onOpen={handleOpenDispute} onMarkRead={markRead} onMarkAllRead={markAllRead} isPolling={isPolling} />
            <div className="flex items-center gap-2.5 pl-3 border-l border-surface-200">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ background: SB_AVATAR }}>
                <span className="text-white text-xs font-bold font-display">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              {user && (<div className="hidden sm:block">
                <p className="text-sm font-semibold text-surface-800 leading-none">{user.name}</p>
                <p className="text-xs mt-0.5 font-medium text-brand-600">Finance Associate</p>
              </div>)}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto"><Outlet context={{ openDisputeId }} /></div>
        </main>
      </div>
    </OpenDisputeContext.Provider>
  );
};
export default DashboardLayout;
