import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { signOutFirebase, completeGoogleRedirectSignIn } from '../firebase';

const AuthContext = createContext(null);

/** Gmail/Firebase redirect буцаж ирэхэд URL нь /login биш ч болно — энд нэг удаа солилцоо хийнэ (firebase.js single-flight-тай үйлчилнэ). */
function FirebaseRedirectSessionCompleter() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await completeGoogleRedirectSignIn(api);
        if (cancelled || !data) return;
        login(data.token, data.user);
        navigate('/', { replace: true });
      } catch {
        // Алдааг LoginPage / RegisterPage (мөн давхардсан await) харуулна
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login, navigate]);

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch (err) {
      const status = err.response?.status;
      // Only kill the session when the server explicitly rejects the token
      // (401 = invalid auth, 403 = expired token, 404 = user no longer exists).
      // Network errors / 5xx = transient — keep the token so the next render works.
      if (status === 401 || status === 403 || status === 404) {
        localStorage.removeItem('token');
        setUser(null);
      } else {
        console.warn('[Auth] /auth/me failed (transient):', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    signOutFirebase().catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchUser }}>
      <FirebaseRedirectSessionCompleter />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
