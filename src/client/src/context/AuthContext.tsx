import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import type { User, CandidateProfile } from '../types.js';

const STORAGE_KEY_TOKEN = 'myjobapply_token';
const STORAGE_KEY_USER = 'myjobapply_user';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  activeCandidateId: string | null;
  setActiveCandidateId: (id: string | null) => void;
  candidateProfile: CandidateProfile | null;
  setCandidateProfile: React.Dispatch<React.SetStateAction<CandidateProfile | null>>;
  isAuthModalOpen: boolean;
  authModalTab: 'signin' | 'signup';
  openAuthModal: (tab?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
  setAuthModalTab: (tab: 'signin' | 'signup') => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshCandidateProfile: (candidateId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signin');

  const openAuthModal = (tab: 'signin' | 'signup' = 'signin') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const setSession = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    setActiveCandidateId(null);
    setCandidateProfile(null);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  // Fetch candidate profile by email
  const syncStoredCandidate = useCallback(async (userEmail: string) => {
    try {
      let profile: CandidateProfile | null = null;
      try {
        const res = await api<CandidateProfile>(`/api/candidates/by-email/${encodeURIComponent(userEmail)}`);
        profile = res.data;
      } catch {}

      if (!profile) {
        const listRes = await api<CandidateProfile[]>(`/api/candidates?email=${encodeURIComponent(userEmail)}`);
        if (listRes.data && listRes.data.length > 0) {
          profile = listRes.data[0];
        }
      }

      if (profile) {
        setActiveCandidateId(profile.id);
        setCandidateProfile(profile);
      }
    } catch (err) {
      console.error('Error synchronizing stored candidate profile:', err);
    }
  }, []);

  const refreshCandidateProfile = async (candidateId?: string) => {
    const id = candidateId || activeCandidateId;
    if (!id) return;
    try {
      const res = await api<CandidateProfile>(`/api/candidates/${id}`);
      if (res.data) {
        setCandidateProfile(res.data);
      }
    } catch (err) {
      console.error('Failed to refresh candidate profile:', err);
    }
  };

  // Handle Google OAuth Redirects (?code=... or #access_token=...)
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      // 1. PKCE query param
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        try {
          const res = await api<{ user: any; session: any }>('/api/auth/callback', {
            method: 'POST',
            body: JSON.stringify({ code }),
          });
          if (res.data?.user) {
            const u = res.data.user;
            const t = res.data.session?.access_token || 'oauth-token';
            const userObj: User = {
              id: u.id,
              email: u.email,
              fullName: u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0],
            };
            setSession(t, userObj);
            window.history.replaceState({}, document.title, window.location.pathname);
            await syncStoredCandidate(userObj.email);
            return;
          }
        } catch (err) {
          console.error('OAuth code exchange failed:', err);
        }
      }

      // 2. Implicit hash fragment
      if (window.location.hash && window.location.hash.includes('access_token=')) {
        try {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          if (accessToken) {
            const res = await api<{ user: any }>('/api/auth/me', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (res.data?.user) {
              const u = res.data.user;
              const userObj: User = {
                id: u.id,
                email: u.email,
                fullName: u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0],
              };
              setSession(accessToken, userObj);
              window.history.replaceState({}, document.title, window.location.pathname);
              await syncStoredCandidate(userObj.email);
              return;
            }
          }
        } catch (err) {
          console.error('OAuth hash token extraction failed:', err);
        }
      }

      // 3. Existing LocalStorage session
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      const savedUserStr = localStorage.getItem(STORAGE_KEY_USER);
      if (savedToken && savedUserStr) {
        try {
          const parsedUser = JSON.parse(savedUserStr);
          setUser(parsedUser);
          setToken(savedToken);
          await syncStoredCandidate(parsedUser.email);
        } catch {
          clearSession();
        }
      }
    };

    handleOAuthRedirect();
  }, [syncStoredCandidate]);

  const login = async (email: string, pass: string) => {
    const res = await api<{ user: any; session: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });

    const u = res.data.user;
    const t = res.data.session?.access_token || 'session-token';
    const userObj: User = {
      id: u.id,
      email: u.email,
      fullName: u.user_metadata?.full_name || u.email.split('@')[0],
    };

    setSession(t, userObj);
    closeAuthModal();
    await syncStoredCandidate(userObj.email);
  };

  const signup = async (fullName: string, email: string, pass: string) => {
    await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password: pass }),
    });

    await login(email, pass);
  };

  const signInWithGoogle = async () => {
    const res = await api<{ url: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ redirectTo: window.location.origin }),
    });

    if (res.data?.url) {
      window.location.href = res.data.url;
    } else {
      throw new Error('Google authentication URL not available');
    }
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearSession();
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        activeCandidateId,
        setActiveCandidateId,
        candidateProfile,
        setCandidateProfile,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        setAuthModalTab,
        login,
        signup,
        signInWithGoogle,
        logout,
        refreshCandidateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
