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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="login-password">НУУЦ ҮГ</label>
              <Link to="/forgot-password" style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                НУУЦ ҮГ МАРТСАН?
              </Link>
            </div>
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
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Илгээгдэж байна…' : 'Нэвтрэх'}
          </button>
        </form>

        <div className="login-divider">эсвэл</div>

        <button
          type="button"
          className="btn btn-google"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width={18} height={18} />
          Google-ээр нэвтрэх
        </button>

        <p className="login-footer">
          Бүртгэлгүй юу? <Link to="/register">Шинэ бүртгэл</Link>
        </p>
      </div>
    </div>
  );
}
