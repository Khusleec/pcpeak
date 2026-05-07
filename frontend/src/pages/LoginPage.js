import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ArrowRight, AlertOctagon } from 'lucide-react';

import { getApiBaseUrl } from '../api/apiBase';

const GOOGLE_AUTH_URL = `${getApiBaseUrl()}/auth/google`;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'НЭВТРЭХ АМЖИЛТГҮЙ БОЛЛОО');
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
            <span>// НЭВТРЭХ_ПРОТОКОЛ::v1.0</span>
          </div>
          <h1>СИСТЕМД<br /><span style={{ color: 'var(--red)' }}>НЭВТРЭХ</span></h1>
          <div className="login-meta">
            &gt; АЮУЛГҮЙ_СУВАГ :: МЭДЭЭЛЭЛ_ХҮЛЭЭГДЭЖ_БАЙНА<br />
            &gt; ШИФРЛЭЛТ :: TLS_1.3 / RSA_4096
          </div>
        </div>

        <a href={GOOGLE_AUTH_URL} className="btn btn-google" style={{ width: '100%' }}>
          <svg width="14" height="14" viewBox="0 0 48 48">
            <path fill="#000" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#000" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#000" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#000" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          GOOGLE-ААР НЭВТРЭХ
        </a>

        <div className="login-divider">// ЭСВЭЛ_И-МЭЙЛЭЭР</div>

        <form onSubmit={handleLocalLogin}>
          {error && (
            <div className="error-box">
              <AlertOctagon size={11} /> АЛДАА :: {error.toUpperCase()}
            </div>
          )}

          <div className="form-group">
            <label>// И-МЭЙЛ</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="нэр@жишээ.mn" required />
          </div>

          <div className="form-group">
            <label>// НУУЦ ҮГ</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? <>ИЛГЭЭЖ БАЙНА <span className="blink">▮</span></> : <>НЭВТРЭХ <ArrowRight size={11} /></>}
          </button>
        </form>

        <p style={{ marginTop: 20, color: 'var(--text-muted)', textAlign: 'center' }}>
          БҮРТГҮҮЛЭЭГҮЙ ЮУ? <Link to="/register" style={{ color: 'var(--red)' }}>// БҮРТГҮҮЛЭХ</Link>
        </p>
      </div>
    </div>
  );
}
