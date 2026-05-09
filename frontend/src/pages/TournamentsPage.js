import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Trophy, ChevronRight } from 'lucide-react';

const STATUS = {
  registration: 'БҮРТГЭЛ НЭЭЛТТЭЙ',
  closed: 'ХААГДСАН',
  live: 'ЯВЖ БАЙНА',
  finished: 'ДУУССАН',
  cancelled: 'ЦУЦЛАГДСАН',
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
        <div className="section-head">
          <div>
            <div className="section-eyebrow">// МОДУЛЬ_ТЭМЦЭЭН</div>
            <h2 className="section-title">ТЭМЦЭЭН</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {user && (
              <Link to="/tournaments/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                + ШИНЭ ТЭМЦЭЭН
              </Link>
            )}
            <span className="section-meta">
              {rows.length > 0 ? `${rows.length} ИДЭВХТЭЙ` : 'ОДОО ХООСОН'} // Сүлжээний арга хэмжээ
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
            <Link key={t.id} to={`/tournaments/${t.id}`} className="booking-card" style={{ textDecoration: 'none', display: 'block', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Trophy size={14} style={{ color: 'var(--amber)' }} />
                    <span className="display" style={{ fontSize: 18, color: 'var(--text)' }}>
                      {t.title?.toUpperCase()}
                    </span>
                    <span className={`booking-status ${t.status === 'registration' ? 'pending_payment' : 'confirmed'}`}>
                      <span className={t.status === 'registration' ? 'dot alert' : 'dot live'} />
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
                <div style={{ textAlign: 'right' }}>
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
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
