import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { useAppDispatch } from '@/hooks';
import { fetchCurrentUser } from '@/features/auth';

interface AuthContextValue {
  isBootstrapping: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isBootstrapping: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const dispatch = useAppDispatch();
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    // Try to hydrate user from existing session on app load.
    // isBootstrapping in Redux stays true until this resolves or rejects.
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  return (
    <AuthContext.Provider value={{ isBootstrapping: true }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
