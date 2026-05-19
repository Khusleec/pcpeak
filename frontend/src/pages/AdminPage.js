import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { isStaffRole } from '../utils/roles';
import { formatMnDateTime } from '../utils/formatMnDateTime';
import { Shield, Database, ArrowLeft, RefreshCw } from 'lucide-react';

const STATUS_LABELS = {
  confirmed: 'БАТАЛГААЖСАН',
  pending_payment: 'ТӨЛБӨР ХҮЛЭЭГДЭЖ БАЙНА',
  cancelled: 'ЦУЦЛАГДСАН',
  completed: 'ДУУССАН',
};

function itemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return '—';
  return items
    .map((i) => (i.label ? String(i.label) : i.pc_id))
    .slice(0, 4)
    .join(', ')
    .concat(items.length > 4 ? '…' : '');
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [fetching, setFetching] = useState(true);

  const allowed = useMemo(() => isStaffRole(user?.role), [user?.role]);

  const refresh = useCallback(() => {
    if (!allowed) return;
    setFetching(true);
    setErr(null);
    api
      .get('/bookings/all')
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.userMessage || e.response?.data?.error || e.message || 'Алдаа'))
      .finally(() => setFetching(false));
  }, [allowed]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isStaffRole(user.role)) {
      navigate('/');
      return;
    }

    refresh();
  }, [loading, user, navigate, refresh]);

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      </div>
    );
  }

  if (!user || !allowed) {
    return null;
  }

  return (
    <div className="page">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">// МОДУЛЬ_ADMIN — ОПЕРАЦ</div>
            <h2 className="section-title">АДМИН КОНСОЛЬ</h2>
          </div>
          <span className="section-meta">
            <Shield size={11} style={{ verticalAlign: '-1px' }} /> ROLE :: {String(user.role).toUpperCase()}
          </span>
        </div>

        <div className="booking-card flex-between" style={{ marginBottom: 20, gap: 16 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'none', lineHeight: 1.6 }}>
            Энэ хуудсанд бүх хэрэглэгчийн захиалгын суурь жагсаалт харагдана. Зөвхөн <strong style={{ color: 'var(--text)' }}>admin</strong> (бүтэн системийн эрх — бүх тэмцээн/захиалга/төлбөр) болон{' '}
            <strong style={{ color: 'var(--text)' }}>moderator</strong> эрхээр нэвтэрсэн үед ажиллана.
          </div>
          <div className="responsive-flex" style={{ flexShrink: 0 }}>
            <button type="button" className="btn btn-ghost" disabled={fetching} onClick={refresh}>
              <RefreshCw size={11} /> ШИНЭЧЛЭХ
            </button>
            <Link to="/profile" className="btn btn-primary">
              <ArrowLeft size={11} /> ПРОФАЙЛ
            </Link>
          </div>
        </div>

        {err ? (
          <div className="panel" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 16 }}>
            {err}
          </div>
        ) : null}

        <div className="panel admin-table-wrap">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-bright)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={14} />
            <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em' }}>
              БҮХ ЗАХИАЛГА · {fetching ? '…' : rows.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="admin-bookings-table">
              <thead>
                <tr>
                  <th>ОГНОО</th>
                  <th>СТАТУС</th>
                  <th>ХЭРЭГЛЭГЧ</th>
                  <th>САЛБАР</th>
                  <th>Компьютер</th>
                  <th>НИЙТ</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {fetching && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'none' }}>
                      Ачааллаж байна…
                    </td>
                  </tr>
                ) : !fetching && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'none' }}>
                      Захиалга алга.
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => (
                    <tr key={b.id}>
                      <td className="mono" style={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
                        {formatMnDateTime(b.starts_at)}
                        {' — '}
                        {formatMnDateTime(b.ends_at)}
                      </td>
                      <td>
                        <span className={`admin-status admin-status--${b.status}`}>
                          {STATUS_LABELS[b.status] || String(b.status || '').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textTransform: 'none', maxWidth: 180 }}>
                        <div>{b.user_name || '—'}</div>
                        <div className="mono" style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                          {b.user_email || ''}
                        </div>
                      </td>
                      <td style={{ textTransform: 'none', maxWidth: 140 }}>
                        {b.cafe_name || '—'}
                      </td>
                      <td style={{ textTransform: 'none', fontSize: 9 }} className="mono">
                        {itemsSummary(b.items)}
                      </td>
                      <td className="mono" style={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
                        ₮{parseFloat(b.total_price || 0).toLocaleString()}
                      </td>
                      <td className="mono" style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                        {String(b.id).slice(0, 8)}…
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
