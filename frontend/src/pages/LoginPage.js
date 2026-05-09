import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { getApiBaseUrl } from '../api/apiBase';
import { AlertOctagon } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      if (err === 'auth_failed') setError('Google-ээр нэвтрэхэд алдаа гарлаа');
      if (err === 'no_code') setError('Google-ээс мэдээлэл ирсэнгүй');
      
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      login(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.userMessage || err.message || 'НЭВТРЭХ АМЖИЛТГҮЙ БОЛЛОО');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${getApiBaseUrl()}/auth/google`;
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="corner-mark tl" />
        <div className="corner-mark tr" />
        <div className="corner-mark bl" />
        <div className="corner-mark br" />

        <div className="login-header">
          <div className="login-eyebrow">
            <span className="dot alert" />
            <span>// НЭВТРЭХ :: EMAIL_AUTH</span>
          </div>
          <h1>СИСТЕМД<br /><span style={{ color: 'var(--red)' }}>НЭВТРЭХ</span></h1>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            <AlertOctagon size={11} /> АЛДАА :: {String(error).toUpperCase()}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">И-МЭЙЛ</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="YOU@DOMAIN.COM"
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">НУУЦ ҮГ</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'УНШИЖ БАЙНА…' : 'НЭВТРЭХ'}
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          <button 
            type="button" 
            className="btn" 
            style={{ 
              width: '100%', 
              backgroundColor: '#fff', 
              color: '#000', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '10px',
              border: '1px solid #ddd'
            }} 
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18" />
            GOOGLE-ЭЭР НЭВТРЭХ
          </button>
        </div>

        <p style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
          Бүртгэлгүй юу?{' '}
          <Link to="/register" style={{ color: 'var(--red)' }}>Шинэ бүртгэл</Link>
        </p>
      </div>
    </div>
  );
}
