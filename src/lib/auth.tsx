import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, getSession, onSessionChange, setSession, type Session } from '../api/client';
import { artists, auth } from '../api/endpoints';
import type { ArtistDTO, CustomerDTO } from '../api/types';

interface AuthState {
  session: Session | null;
  me: CustomerDTO | null;
  // null while unknown; from GET /artists/me (403 ARTIST_PROFILE_REQUIRED means not an Artist).
  isArtist: boolean | null;
  artist: ArtistDTO | null;
  loading: boolean;
  loginCustomer: (email: string, password: string) => Promise<void>;
  loginStaff: (loginName: string, password: string) => Promise<void>;
  logout: () => void;
  refreshArtist: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setLocal] = useState<Session | null>(getSession());
  const [me, setMe] = useState<CustomerDTO | null>(null);
  const [isArtist, setIsArtist] = useState<boolean | null>(null);
  const [artist, setArtist] = useState<ArtistDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onSessionChange(() => setLocal(getSession())), []);

  const refreshArtist = useCallback(async () => {
    try {
      setArtist(await artists.me());
      setIsArtist(true);
    } catch (error) {
      setArtist(null);
      setIsArtist(error instanceof ApiError && error.code === 'ARTIST_PROFILE_REQUIRED' ? false : null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (session?.kind === 'customer') {
        try {
          const profile = await auth.me();
          if (!cancelled) setMe(profile);
          if (!cancelled) await refreshArtist();
        } catch {
          if (!cancelled) setMe(null);
        }
      } else {
        setMe(null);
        setIsArtist(null);
        setArtist(null);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.kind, refreshArtist]);

  // There is no refresh token: log out when the token expires (expiresIn from login, 2 hours by default).
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => setSession(null), Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  const value: AuthState = {
    session, me, isArtist, artist, loading, refreshArtist,
    loginCustomer: async (email, password) => {
      const token = await auth.login(email, password);
      setSession({ kind: 'customer', token: token.accessToken, expiresAt: Date.now() + token.expiresIn * 1000 });
    },
    loginStaff: async (loginName, password) => {
      const token = await auth.staffLogin(loginName, password);
      setSession({ kind: 'staff', token: token.accessToken, expiresAt: Date.now() + token.expiresIn * 1000 });
    },
    logout: () => setSession(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}
