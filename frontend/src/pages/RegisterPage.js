import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ArrowRight, AlertOctagon } from 'lucide-react';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'БҮРТГЭЛ АМЖИЛТГҮЙ БОЛЛОО');
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
            <span>// БҮРТГЭЛИЙН_ПРОТОКОЛ</span>
          </div>
          <h1>ШИНЭ<br /><span style={{ color: 'var(--red)' }}>БҮРТГЭЛ</span></h1>
          <div className="login-meta">
            &gt; ШИНЭ_ХЭРЭГЛЭГЧ_ҮҮСГЭЖ_БАЙНА<br />
            &gt; НУУЦЛАЛ :: BCRYPT_R12
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-box">
              <AlertOctagon size={11} /> АЛДАА :: {String(error).toUpperCase()}
            </div>
          )}

          <div className="form-group">
            <label>// ХЭРЭГЛЭГЧИЙН НЭР</label>
            <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="нэрээ оруулна уу" required />
          </div>
          <div className="form-group">
            <label>// И-МЭЙЛ</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="нэр@жишээ.mn" required />
          </div>
          <div className="form-group">
            <label>// НУУЦ ҮГ :: ХАМГИЙН БАГА 8 ТЭМДЭГТ</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required minLength={8} />
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? <>БҮРТГҮҮЛЖ БАЙНА <span className="blink">▮</span></> : <>БҮРТГҮҮЛЭХ <ArrowRight size={11} /></>}
          </button>
        </form>

        <p style={{ marginTop: 20, color: 'var(--text-muted)', textAlign: 'center' }}>
          БҮРТГЭЛТЭЙ ЮУ? <Link to="/login" style={{ color: 'var(--red)' }}>// НЭВТРЭХ</Link>
        </p>
      </div>
    </div>
  );
}
