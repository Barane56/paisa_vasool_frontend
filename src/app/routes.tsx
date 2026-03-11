import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import { useIsAuthenticated, useIsBootstrapping, useUserRole } from '@/hooks';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import { LoadingScreen } from '@/components/common';

const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));

// Lazy-loaded pages
const LoginPage               = lazy(() => import('@/features/auth/components/LoginPage'));
const SignupPage               = lazy(() => import('@/features/auth/components/SignupPage'));
const DashboardPage           = lazy(() => import('@/features/disputes/components/DashboardPage'));
const DocumentsPage           = lazy(() => import('@/features/documents/components/DocumentsPage'));
const AddFinanceAssociatePage = lazy(() => import('@/features/admin/components/AddFinanceAssociatePage'));
const AdminIncidentsPage      = lazy(() => import('@/features/admin/components/AdminIncidentsPage'));

// ─── Route Guards ─────────────────────────────────────────────────────────────

/** Block render until fetchCurrentUser resolves — prevents flash-redirects on refresh */
const BootstrapGate = ({ children }: { children: React.ReactNode }) => {
  const isBootstrapping = useIsBootstrapping();
  if (isBootstrapping) return <LoadingScreen />;
  return <>{children}</>;
};

/** Redirect authenticated users to their role-appropriate home */
const GuestRoute = () => {
  const isAuthenticated = useIsAuthenticated();
  const role = useUserRole();
  if (isAuthenticated) {
    return <Navigate to={role === 'admin' ? ROUTES.ADMIN_ADD_FA : ROUTES.DASHBOARD} replace />;
  }
  return <Outlet />;
};

/** Finance-Associate-only — redirects admins away, unauthenticated to login */
const FARoute = () => {
  const isAuthenticated = useIsAuthenticated();
  const role = useUserRole();
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (role === 'admin') return <Navigate to={ROUTES.ADMIN_ADD_FA} replace />;
  return <Outlet />;
};

/** Admin-only — redirects non-admins away, unauthenticated to login */
const AdminRoute = () => {
  const isAuthenticated = useIsAuthenticated();
  const role = useUserRole();
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (role !== 'admin') return <Navigate to={ROUTES.DASHBOARD} replace />;
  return <Outlet />;
};

// ─── App Routes ───────────────────────────────────────────────────────────────
const AppRoutes = () => (
  <BootstrapGate>
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Guest-only routes */}
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN}  element={<LoginPage />} />
            <Route path={ROUTES.SIGNUP} element={<SignupPage />} />
          </Route>
        </Route>

        {/* Finance Associate routes */}
        <Route element={<FARoute />}>
          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.DOCUMENTS} element={<DocumentsPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path={ROUTES.ADMIN_ADD_FA}    element={<AddFinanceAssociatePage />} />
            <Route path={ROUTES.ADMIN_INCIDENTS} element={<AdminIncidentsPage />} />
            <Route path={ROUTES.ADMIN_DASHBOARD} element={<Navigate to={ROUTES.ADMIN_ADD_FA} replace />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  </BootstrapGate>
);

export default AppRoutes;
