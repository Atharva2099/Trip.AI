import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, getToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle OAuth callback on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const error = url.searchParams.get('error');

    if (token) {
      localStorage.setItem('tripai_token', token);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }

    if (error) {
      console.error('Auth error:', error);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }

    // Validate existing token
    const existing = getToken();
    if (existing) {
      authApi.me()
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('tripai_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for logout events
  useEffect(() => {
    const handleLogout = () => setUser(null);
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const API_BASE = 'https://tripai-api.athuspydy.workers.dev';

  const loginWithGitHub = useCallback(() => {
    window.location.href = `${API_BASE}/auth/github?origin=${encodeURIComponent(window.location.origin)}`;
  }, []);

  const loginWithGoogle = useCallback(() => {
    window.location.href = `${API_BASE}/auth/google?origin=${encodeURIComponent(window.location.origin)}`;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('tripai_token');
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    loginWithGitHub,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
