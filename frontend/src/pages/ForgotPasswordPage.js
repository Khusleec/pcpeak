import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { AlertOctagon, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'ХҮСЭЛТ АМЖИЛТГҮЙ БОЛЛОО');
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
            <span className="dot" />
            <span>// НЭВТРЭХ :: СЭРГЭЭХ</span>
          </div>
          <h1>НУУЦ ҮГ<br /><span style={{ color: 'var(--blue)' }}>СЭРГЭЭХ</span></h1>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            <AlertOctagon size={11} /> АЛДАА :: {String(error).toUpperCase()}
          </div>
        )}

        {message && (
          <div className="success-box">
            <CheckCircle size={11} /> {message}
          </div>
        )}

        {!message && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="forgot-email">И-МЭЙЛ</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="YOU@DOMAIN.COM"
                required
                disabled={loading}
              />
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Таны бүртгэлтэй имэйл хаяг руу нууц үг сэргээх линк илгээх болно.
              </p>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Илгээгдэж байна…' : 'Линк илгээх'}
            </button>
          </form>
        )}

        <p className="login-footer">
          Буцаад <Link to="/login">Нэвтрэх</Link>
        </p>
      </div>
    </div>
  );
}
