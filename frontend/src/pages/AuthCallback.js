import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

/**
 * Google OAuth callback page.
 * Receives one-time 'code' from backend and exchanges it for a JWT.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const hasExchanged = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    
    if (!code) {
      navigate('/login?error=no_code', { replace: true });
      return;
    }

    if (hasExchanged.current) return;
    hasExchanged.current = true;

    async function exchangeCode() {
      try {
        const { data } = await api.post('/auth/exchange', { code });
        login(data.token, data.user);
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Exchange failed:', err);
        navigate('/login?error=auth_failed', { replace: true });
      }
    }

    exchangeCode();
  }, [searchParams, login, navigate]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="corner-mark tl" />
        <div className="corner-mark tr" />
        <div className="corner-mark bl" />
        <div className="corner-mark br" />
        <div className="login-eyebrow" style={{ justifyContent: 'center', marginBottom: 20 }}>
          <span className="dot live" />
          <span>// ШИЛЖИЖ БАЙНА</span>
        </div>
        <h1>НЭВТРЭЛТ<span className="blink">...</span></h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
          GOOGLE-ЭЭР БАТАЛГААЖУУЛЖ БАЙНА
        </p>
      </div>
    </div>
  );
}
