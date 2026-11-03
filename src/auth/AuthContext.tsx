import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as auth from '../data/auth';
import type { Profile, Role } from '../data/types';

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  setProfile: (profile: Profile) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let current = true;

    async function load(next: Session | null) {
      const nextProfile = next ? await auth.getProfile(next.user.id).catch(() => null) : null;
      if (!current) return;
      setSession(next);
      setProfile(nextProfile);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => load(data.session));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password');
      if (event === 'TOKEN_REFRESHED') {
        setSession(next);
        return;
      }
      // Run Supabase calls outside this callback (Supabase's advice, avoids a lock-up).
      setTimeout(() => load(next), 0);
    });

    return () => {
      current = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  async function signOut() {
    await auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, setProfile, signOut }}>
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
export function useUser(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useUser must be used inside <RequireAuth>');
  return profile;
}

// Wrap a page to require a signed-in user, and optionally one of some roles.
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="loading-screen">Loading…</p>;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!profile) {
    return (
      <p className="loading-screen">
        Your account has no profile yet. Ask the school admin to check the database set-up.
      </p>
    );
  }
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}
