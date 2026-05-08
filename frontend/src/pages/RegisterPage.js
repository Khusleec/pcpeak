import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { AlertOctagon } from 'lucide-react';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        display_name: displayName.trim(),
        email: email.trim(),
        password,
      });
      login(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.userMessage || err.message || 'БҮРТГЭЛ АМЖИЛТГҮЙ БОЛЛОО');
    } finally {
      setLoading(false);
    }
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
            <span>// БҮРТГЭЛ :: EMAIL_AUTH</span>
          </div>
          <h1>ШАТАНД<br /><span style={{ color: 'var(--red)' }}>ОРОХ</span></h1>
          <div className="login-meta">
            &gt; ОВОГ НЭР ҮЗҮҮЛЭХ НЭР<br />
            &gt; И-МЭЙЛ · НУУЦ ҮГ (8+ ТЭМДЭГТ)
          </div>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            <AlertOctagon size={11} /> АЛДАА :: {String(error).toUpperCase()}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="register-name">ХАРАГДАХ НЭР</label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="DISPLAY NAME"
              minLength={2}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="register-email">И-МЭЙЛ</label>
            <input
              id="register-email"
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
            <label htmlFor="register-password">НУУЦ ҮГ</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              minLength={8}
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'УНШИЖ БАЙНА…' : 'БҮРТГҮЛЭХ'}
          </button>
        </form>

        <p style={{ marginTop: 20, color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
          Бүртгэлтэй юу? <Link to="/login" style={{ color: 'var(--red)' }}>// НЭВТРЭХ</Link>
        </p>
      </div>
    </div>
  );
}
