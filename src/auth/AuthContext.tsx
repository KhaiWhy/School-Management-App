import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as store from '../data/store';
import type { Role, Session } from '../data/types';

interface AuthValue {
  user: Session | null;
  loading: boolean;
  signIn: (details: { name: string; role: Role }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    store.getSession().then((session) => {
      setUser(session);
      setLoading(false);
    });
  }, []);

  async function signIn(details: { name: string; role: Role }) {
    setUser(await store.signIn(details));
  }

  async function signOut() {
    await store.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

// For pages inside <RequireAuth>, where someone is always signed in.
export function useUser(): Session {
  const { user } = useAuth();
  if (!user) throw new Error('useUser must be used inside <RequireAuth>');
  return user;
}

// Wrap a page to require a signed-in user, and optionally one of some roles.
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
