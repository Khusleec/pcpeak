import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { User, Mail, Shield, Database, LogOut, Map, LayoutDashboard, Layers, Key } from 'lucide-react';
import { isAdminRole, isModeratorRole } from '../utils/roles';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0, spend: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Change Password State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [changing, setChanging] = useState(false);

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      toast.error('ШИНЭ НУУЦ ҮГ ЗӨРҮҮТЭЙ БАЙНА');
      return;
    }
    setChanging(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.next
      });
      toast.success('НУУЦ ҮГ АМЖИЛТТАЙ СОЛИГДЛОО');
      setShowChangePassword(false);
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'АЛДАА ГАРЛАА');
    } finally {
      setChanging(false);
    }
  };

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
            <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={() => setShowChangePassword(!showChangePassword)}>
              <Key size={11} /> НУУЦ ҮГ СОЛИХ
            </button>
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

        {showChangePassword && (
          <div className="booking-card" style={{ marginBottom: 24, flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="section-eyebrow" style={{ marginBottom: 12 }}>// НУУЦ ҮГ ШИНЭЧЛЭХ</div>
            <form onSubmit={handleChangePassword} className="responsive-flex" style={{ gap: 16, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label style={{ fontSize: 9 }}>ОДООГИЙН НУУЦ ҮГ</label>
                <input 
                  type="password" 
                  value={passwords.current} 
                  onChange={e => setPasswords({...passwords, current: e.target.value})}
                  placeholder="········"
                  required 
                  disabled={changing}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label style={{ fontSize: 9 }}>ШИНЭ НУУЦ ҮГ</label>
                <input 
                  type="password" 
                  value={passwords.next} 
                  onChange={e => setPasswords({...passwords, next: e.target.value})}
                  placeholder="········"
                  required 
                  minLength={8}
                  disabled={changing}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label style={{ fontSize: 9 }}>НУУЦ ҮГ ДАВТАХ</label>
                <input 
                  type="password" 
                  value={passwords.confirm} 
                  onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                  placeholder="········"
                  required 
                  disabled={changing}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={changing} style={{ padding: '12px 20px' }}>
                {changing ? '...' : 'ХАДГАЛАХ'}
              </button>
            </form>
          </div>
        )}

        {(isAdminRole(user.role) || isModeratorRole(user.role)) && (
          <div className="booking-card" style={{ marginBottom: 24, alignItems: 'stretch', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div className="section-eyebrow" style={{ marginBottom: 6 }}>
                  {isAdminRole(user.role) ? '// ROOT · GOD MODE — Бүтэн систем' : '// MODERATOR — ДАВУУ ТАЛ'}
                </div>
                <h3 className="section-title" style={{ fontSize: 20, marginBottom: 8 }}>
                  {isAdminRole(user.role) ? 'ТӨВИЙН СУПЕРЭРХ (БҮХ ЗҮЙЛ)' : 'ЗАХИАЛГЫН УДИРДЛАГА'}
                </h3>
                <ul className="admin-benefits-list">
                  {isAdminRole(user.role) && (
                    <li style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'none', marginBottom: 8 }}>
                      Таны <strong style={{ color: 'var(--text)' }}>admin</strong> эрх сервер дээр <strong style={{ color: 'var(--red)' }}>бүх нөөц, тэмцээн, захиалга, төлбөр</strong>-т бүрэн хандаж, зохион байгуулагчийн хязгаарыг авах боломжтой.
                    </li>
                  )}
                  <li>
                    <LayoutDashboard size={14} aria-hidden />
                    <span>
                      <strong>Консоль</strong> — бүх хэрэглэгчийн захиалгыг нэг хүснэгтээр харах (
                      <Link to="/admin" style={{ color: 'var(--red)' }}>
                        /админ
                      </Link>
                      ).
                    </span>
                  </li>
                  {isAdminRole(user.role) && (
                    <li>
                      <Layers size={14} aria-hidden />
                      <span>
                        <strong>Шинэ салбар</strong> — серверийн <code style={{ fontSize: 10, letterSpacing: 0 }}>POST /api/cafes</code> захиад шинэ кафег бүртгэх эрх зөвхөн админд.
                      </span>
                    </li>
                  )}
                  <li>
                    <Shield size={14} aria-hidden />
                    <span>
                      <strong>Эрхийн түвшин</strong> — суурь API дээр сервер таны <strong style={{ color: 'var(--text)' }}>staff</strong> role-оор нэмэлт зөвшөөрөл өгнө (жишээ нь бүх захиалгыг унших).
                    </span>
                  </li>
                  {isModeratorRole(user.role) && !isAdminRole(user.role) ? (
                    <li style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'none' }}>
                      Салбар шинээр нэмэх — зөвхөн <strong style={{ color: 'var(--text)' }}>admin</strong>; шаардлагатай бол админ руу дамжуулаарай.
                    </li>
                  ) : null}
                </ul>
              </div>
              <Link to="/admin" className="btn btn-primary" style={{ alignSelf: 'center', padding: '10px 16px', whiteSpace: 'nowrap' }}>
                <LayoutDashboard size={11} /> АДМИН ХУУДАС
              </Link>
            </div>
          </div>
        )}

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
