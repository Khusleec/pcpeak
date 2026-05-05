import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { User, Mail, Shield, Database, LogOut, Map } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0, spend: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    api
      .get('/bookings/my')
      .then(({ data }) => {
        const totals = data.reduce(
          (acc, b) => {
            acc.total += 1;
            if (b.status === 'confirmed') acc.confirmed += 1;
            else if (b.status === 'pending_payment') acc.pending += 1;
            else if (b.status === 'cancelled') acc.cancelled += 1;
            else if (b.status === 'completed') acc.completed += 1;
            if (b.status !== 'cancelled') acc.spend += parseFloat(b.total_price || 0);
            return acc;
          },
          { total: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0, spend: 0 }
        );
        setStats(totals);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="page">
        <div className="container">
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      </div>
    );
  }

  const initials =
    (user.display_name || user.email || '?')
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="page">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">// МОДУЛЬ_001 — ХЭРЭГЛЭГЧ</div>
            <h2 className="section-title">ПРОФАЙЛ</h2>
          </div>
          <span className="section-meta">
            <span className="dot live" /> ИДЭВХТЭЙ_СЕССИЙ
          </span>
        </div>

        {/* Identity card */}
        <div
          className="booking-card"
          style={{ alignItems: 'center', gap: 24, marginBottom: 24 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 0 }}>
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 0,
                  border: '1px solid var(--border)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                className="display"
                style={{
                  width: 72,
                  height: 72,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card-2, #0f0f10)',
                  fontSize: 24,
                  color: 'var(--red)',
                }}
              >
                {initials}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="display" style={{ fontSize: 22, marginBottom: 6, color: 'var(--text)' }}>
                {(user.display_name || 'ХЭРЭГЛЭГЧ').toUpperCase()}
              </div>
              <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={11} /> {user.email}
              </div>
              <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Shield size={11} /> ROLE :: {(user.role || 'user').toUpperCase()}
              </div>
              <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <User size={11} /> ID :: {String(user.id).slice(0, 8)}…
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/bookings" className="btn btn-primary" style={{ padding: '8px 14px' }}>
              <Database size={11} /> МИНИЙ ЗАХИАЛГА
            </Link>
            <Link to="/map" className="btn btn-ghost" style={{ padding: '8px 14px' }}>
              <Map size={11} /> САЛБАРУУД
            </Link>
            <button
              className="btn btn-danger"
              onClick={() => {
                logout();
                navigate('/');
              }}
              style={{ padding: '8px 14px' }}
            >
              <LogOut size={11} /> ГАРАХ
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="section-head" style={{ marginBottom: 12 }}>
          <div>
            <div className="section-eyebrow">// 002 — СТАТИСТИК</div>
            <h2 className="section-title" style={{ fontSize: 22 }}>ҮЙЛ АЖИЛЛАГАА</h2>
          </div>
          <span className="section-meta">{statsLoading ? 'АЧААЛЖ БАЙНА…' : 'БҮРТГЭГДСЭН ӨГӨГДӨЛ'}</span>
        </div>

        <div className="feature-grid">
          <div className="feature-tile">
            <div className="feature-tile-num">// 01</div>
            <h3>НИЙТ<br />ЗАХИАЛГА</h3>
            <p style={{ fontSize: 28, color: 'var(--red)' }}>{stats.total}</p>
          </div>
          <div className="feature-tile">
            <div className="feature-tile-num">// 02</div>
            <h3>БАТАЛГААЖСАН</h3>
            <p style={{ fontSize: 28, color: 'var(--text)' }}>{stats.confirmed + stats.completed}</p>
          </div>
          <div className="feature-tile">
            <div className="feature-tile-num">// 03</div>
            <h3>ХҮЛЭЭГДЭЖ<br />БАЙНА</h3>
            <p style={{ fontSize: 28, color: 'var(--amber, #f5a524)' }}>{stats.pending}</p>
          </div>
          <div className="feature-tile">
            <div className="feature-tile-num">// 04</div>
            <h3>НИЙТ ЗАРЛАГА</h3>
            <p style={{ fontSize: 22, color: 'var(--red)' }}>
              ₮{stats.spend.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
