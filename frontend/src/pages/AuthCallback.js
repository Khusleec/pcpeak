import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const code = params.get('code');

    if (code) {
      api
        .post('/auth/oauth/exchange', { code })
        .then(({ data }) => {
          localStorage.setItem('token', data.token);
          login(data.token, data.user);
          navigate('/');
        })
        .catch(() => navigate('/login?error=oauth_failed'));
      return;
    }

    navigate('/login');
  }, [params, login, navigate]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="corner-mark tl" />
        <div className="corner-mark tr" />
        <div className="corner-mark bl" />
        <div className="corner-mark br" />
        <div className="login-eyebrow" style={{ justifyContent: 'center', marginBottom: 20 }}>
          <span className="dot live" />
          <span>// ХОЛБОЛТ_ХИЙГДЭЖ_БАЙНА</span>
        </div>
        <h1>НЭВТРҮҮЛЖ БАЙНА<span className="blink">_</span></h1>
        <div className="login-meta" style={{ marginTop: 16 }}>
          &gt; ТОКЕН_ШАЛГАЖ_БАЙНА<br />
          &gt; МЭДЭЭЛЭЛ_СОЛИЛЦОЖ_БАЙНА<br />
          &gt; СЕСС_ҮҮСГЭЖ_БАЙНА
        </div>
      </div>
    </div>
  );
}
