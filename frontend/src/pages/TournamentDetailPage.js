import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Trophy, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS = {
  registration: 'БҮРТГЭЛ НЭЭЛТТЭЙ',
  closed: 'ХААГДСАН',
  live: 'ЯВЖ БАЙНА',
  finished: 'ДУУССАН',
  cancelled: 'ЦУЦЛАГДСАН',
};

export default function TournamentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingame, setIngame] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/tournaments/${id}`)
      .then(({ data }) => setT(data))
      .catch(() => setT(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (t?.my_in_game_name) setIngame(t.my_in_game_name);
    else if (t && !t.user_registered) setIngame('');
  }, [t]);

  const register = async () => {
    if (!user) {
      toast.error('НЭВТРЭНЭ ҮҮ');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/tournaments/${id}/register`, { in_game_name: ingame.trim() || null });
      toast.success('◆ БҮРТГЭЛ АМЖИЛТТАЙ');
      load();
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'АЛДАА').toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  const unregister = async () => {
    if (!user) return;
    if (!window.confirm('Бүртгэлээ цуцлах уу?')) return;
    setBusy(true);
    try {
      await api.delete(`/tournaments/${id}/register`);
      toast.success('◆ БҮРТГЭЛ ЦУЦЛАГДЛАА');
      load();
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'АЛДАА').toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (!t) {
    return (
      <div className="page">
        <div className="container">
          <p className="label">Тэмцээн олдсонгүй.</p>
          <Link to="/tournaments" className="btn btn-primary" style={{ marginTop: 16 }}>
            <ArrowLeft size={11} /> ЖАГСААЛТ
          </Link>
        </div>
      </div>
    );
  }

  const deadline = t.registration_deadline || t.starts_at;

  return (
    <div className="page">
      <div className="container">
        <Link to="/tournaments" className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, textDecoration: 'none' }}>
          <ArrowLeft size={12} /> БУЦАХ
        </Link>

        <div className="section-head">
          <div>
            <div className="section-eyebrow">// ТЭМЦЭЭН #{t.id}</div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Trophy size={22} style={{ color: 'var(--amber)' }} />
              {t.title?.toUpperCase()}
            </h2>
          </div>
          <span className={`booking-status ${t.status === 'registration' ? 'pending_payment' : 'confirmed'}`}>
            <span className={t.status === 'registration' ? 'dot alert' : 'dot live'} />
            {STATUS[t.status] || t.status}
          </span>
        </div>

        <div className="booking-card" style={{ marginBottom: 20 }}>
          <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 12, textTransform: 'none' }}>
            {t.game_title}
            {t.cafe_name ? ` :: ${t.cafe_name}` : ''}
          </div>
          {t.description && (
            <p className="label" style={{ color: 'var(--text)', lineHeight: 1.6, marginBottom: 16 }}>
              {t.description}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>// ЭХЛЭХ</div>
              <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                {new Date(t.starts_at).toLocaleString('mn-MN')}
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>// ДУУСАХ</div>
              <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                {new Date(t.ends_at).toLocaleString('mn-MN')}
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>// БҮРТГЭЛ ХУРААМЖ</div>
              <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                {deadline ? new Date(deadline).toLocaleString('mn-MN') : '—'}
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>// ОРОЛЦОГЧ</div>
              <div className="display" style={{ fontSize: 22, color: 'var(--red)' }}>
                {t.registered_count ?? 0}<span style={{ color: 'var(--text-muted)', fontSize: 14 }}> / {t.max_participants}</span>
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>// ШАГНАЛЫН САН</div>
              <div className="display" style={{ fontSize: 22, color: 'var(--amber)' }}>
                ₮{Math.round(Number(t.prize_pool_mnt || 0)).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {t.status === 'registration' && user && (
          <div className="map-overlay" style={{ position: 'relative', minHeight: 0, padding: '18px 20px', marginBottom: 16 }}>
            <div className="map-overlay__title" style={{ fontSize: 11, marginBottom: 10 }}>
              {t.user_registered ? 'ТА БҮРТГЭГДСЭН' : 'БҮРТГҮҮЛЭХ'}
            </div>
            {!t.user_registered && (
              <div style={{ marginBottom: 12 }}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>
                  Тоглоом доторх нэр (заавал биш)
                </label>
                <input
                  className="mono"
                  value={ingame}
                  onChange={(e) => setIngame(e.target.value)}
                  maxLength={120}
                  placeholder="Riot / Steam нэр"
                  style={{
                    width: '100%',
                    maxWidth: 360,
                    padding: '10px 12px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 12,
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!t.user_registered ? (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={register}>
                  БҮРТГҮҮЛЭХ
                </button>
              ) : (
                <button type="button" className="btn btn-danger" disabled={busy} onClick={unregister}>
                  БҮРТГЭЛ ЦУЦЛАХ
                </button>
              )}
            </div>
          </div>
        )}

        {t.status === 'registration' && !user && (
          <div className="map-overlay map-overlay--warn" style={{ position: 'relative', minHeight: 0, padding: '14px 18px' }}>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              Бүртгүүлэхийн тулд <Link to="/login">нэвтэрнэ үү</Link>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
