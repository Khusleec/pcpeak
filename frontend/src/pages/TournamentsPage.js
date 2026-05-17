import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Trophy, ChevronRight } from 'lucide-react';

const STATUS = {
  registration: 'БҮРТГЭЛ НЭЭЛТТЭЙ',
  closed: 'БҮРТГЭЛ ХААГДСАН',
  live: 'ЯВЖ БАЙНА',
  finished: 'ДУУССАН',
  cancelled: 'ЦУЦЛАГДСАН',
};

const STATUS_CLASS = {
  registration: 'pending_payment',
  closed: 'cancelled',
  live: 'confirmed',
  finished: 'completed',
  cancelled: 'cancelled',
};

const STATUS_DOT = {
  registration: 'dot alert',
  closed: 'dot dead',
  live: 'dot warn',
  finished: 'dot live',
  cancelled: 'dot alert',
};

export default function TournamentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/tournaments')
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 96, marginBottom: 4 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="section-head flex-between">
          <div>
            <div className="section-eyebrow">// МОДУЛЬ_ТЭМЦЭЭН</div>
            <h2 className="section-title">ТЭМЦЭЭН</h2>
          </div>
          <div className="responsive-flex">
            {user && (
              <Link to="/tournaments/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                + ШИНЭ ТЭМЦЭЭН
              </Link>
            )}
            <span className="section-meta">
              {rows.length > 0 ? `${rows.length} ИДЭВХТЭЙ` : 'ОДОО ХООСОН'}
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">
              <Trophy size={20} />
            </div>
            <h3 style={{ marginBottom: 8 }}>ТЭМЦЭЭН БАЙХГҮЙ</h3>
            <p className="label" style={{ marginBottom: 24 }}>
              Өгөгдөл нэмсэн бол хуудсаа дахин ачаална уу
            </p>
          </div>
        ) : (
          rows.map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="booking-card tournament-card" style={{ textDecoration: 'none', display: 'flex', color: 'inherit' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <Trophy size={14} style={{ color: 'var(--amber)' }} />
                  <span className="display" style={{ fontSize: 18, color: 'var(--text)' }}>
                    {t.title?.toUpperCase()}
                  </span>
                  <span className={`booking-status ${STATUS_CLASS[t.status] || 'confirmed'}`}>
                    <span className={STATUS_DOT[t.status] || 'dot live'} />
                    {STATUS[t.status] || t.status?.toUpperCase()}
                  </span>
                  {t.visibility === 'private' && (
                    <span className="booking-status confirmed" style={{ marginLeft: 6 }}>
                      <span className="dot" /> ХУВИЙН
                    </span>
                  )}
                </div>
                <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 8, textTransform: 'none' }}>
                  {t.game_title} {t.cafe_name ? `:: ${t.cafe_name}` : ''}
                </div>
                {t.description && (
                  <p className="label" style={{ color: 'var(--text-dim)', lineHeight: 1.5, maxWidth: 640 }}>
                    {t.description}
                  </p>
                )}
              </div>
              <div className="tournament-card-stats" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div className="label" style={{ marginBottom: 4 }}>// БҮРТГЭЛ</div>
                <div className="mono" style={{ color: 'var(--text)', fontSize: 14, marginBottom: 8 }}>
                  {t.registered_count ?? 0} / {t.max_participants}
                </div>
                <div className="label" style={{ marginBottom: 4 }}>// ШАГНАЛ</div>
                <div className="display" style={{ fontSize: 20, color: 'var(--red)' }}>
                  ₮{Math.round(Number(t.prize_pool_mnt || 0)).toLocaleString()}
                </div>
                <span className="btn btn-primary" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
                  ДЭЛГЭРЭНГҮЙ <ChevronRight size={12} />
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
