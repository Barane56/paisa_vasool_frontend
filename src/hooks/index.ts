import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '@/app/store';
import type { RootState } from '@/app/rootReducer';

export const useAppDispatch     = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const useAuth            = () => useAppSelector((s) => s.auth);
export const useUser            = () => useAppSelector((s) => s.auth.user);
export const useIsAuthenticated = () => useAppSelector((s) => s.auth.isAuthenticated);
export const useIsBootstrapping = () => useAppSelector((s) => s.auth.isBootstrapping);
export const useUserRole        = () => useAppSelector((s) => s.auth.user?.role ?? null);
export const useIsAdmin         = () => useAppSelector((s) => s.auth.user?.role === 'admin');
