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
  // True when the profile couldn't be loaded because the server didn't answer
  // (not the same as "this account has no profile").
  offline: boolean;
  retry: () => void;
  setProfile: (profile: Profile) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let current = true;

    async function load(next: Session | null) {
      let nextProfile: Profile | null = null;
      let failed = false;
      if (next) {
        try {
          nextProfile = await auth.getProfile(next.user.id);
        } catch {
          failed = true;
        }
      }
      if (!current) return;
      setSession(next);
      // A dropped connection keeps the profile already on screen for the same person.
      setProfile((prev) => (failed && prev && next && prev.id === next.user.id ? prev : nextProfile));
      setOffline(failed);
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
  }, [navigate, attempt]);

  function retry() {
    setLoading(true);
    setAttempt((n) => n + 1);
  }

  async function signOut() {
    await auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, offline, retry, setProfile, signOut }}>
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
  const { session, profile, loading, offline, retry, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <p className="loading-screen">Loading…</p>;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!profile) {
    return (
      <div className="loading-screen" role="alert">
        <div className="stack">
          <p>
            {offline
              ? "Can't reach the server. Check your internet connection and try again."
              : "Your account has no profile yet. Ask your school's admin to check your account."}
          </p>
          <div className="form-actions">
            {offline && (
              <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
            )}
            <button type="button" className="btn" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}
