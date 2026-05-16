import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { AlertOctagon, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (password !== confirmPassword) {
      setError('Нууц үг зөрүүтэй байна');
      return;
    }

    if (!token) {
      setError('Токен олдсонгүй');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { 
        token, 
        password 
      });
      setMessage(data.message);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'ШИНЭЧЛЭХ АМЖИЛТГҮЙ БОЛЛОО');
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
            <span>// НЭВТРЭХ :: ШИНЭЧЛЭХ</span>
          </div>
          <h1>ШИНЭ<br /><span style={{ color: 'var(--red)' }}>НУУЦ ҮГ</span></h1>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            <AlertOctagon size={11} /> АЛДАА :: {String(error).toUpperCase()}
          </div>
        )}

        {message && (
          <div className="success-box">
            <CheckCircle size={11} /> {message}. Удахгүй нэвтрэх хуудас руу шилжинэ.
          </div>
        )}

        {!message && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="new-password">ШИНЭ НУУЦ ҮГ</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="········"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">НУУЦ ҮГ ДАВТАХ</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="········"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !token}>
              {loading ? 'Шинэчилж байна…' : 'Нууц үг шинэчлэх'}
            </button>
          </form>
        )}

        {!token && !message && (
          <div className="error-box" style={{ marginTop: 16 }}>
             АЛДАА :: ЛИНК ХҮЧИНГҮЙ БАЙНА
          </div>
        )}

        <p className="login-footer">
           <Link to="/login">Нэвтрэх хуудас руу очих</Link>
        </p>
      </div>
    </div>
  );
}
