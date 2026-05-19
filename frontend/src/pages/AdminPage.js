import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { isStaffRole } from '../utils/roles';
import { formatMnDateTime } from '../utils/formatMnDateTime';
import { Shield, Database, ArrowLeft, RefreshCw, Layout, Save } from 'lucide-react';
import toast from 'react-hot-toast';

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

  // Layout Editor State
  const [cafes, setCafes] = useState([]);
  const [selectedCafe, setSelectedCafe] = useState('');
  const [cafePcs, setCafePcs] = useState([]);
  const [layoutMode, setLayoutMode] = useState(false);
  const [grid, setGrid] = useState({}); // { index: pcId }

  const allowed = useMemo(() => isStaffRole(user?.role), [user?.role]);

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
    api.get('/cafes').then(({ data }) => setCafes(data)).catch(console.error);
  }, [loading, user, navigate]);

  const refresh = () => {
    if (!allowed) return;
    setFetching(true);
    setErr(null);
    api
      .get('/bookings/all')
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.userMessage || e.response?.data?.error || e.message || 'Алдаа'))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (selectedCafe) {
      api.get(`/pcs/cafe/${selectedCafe}`).then(({ data }) => {
        const all = data.flatMap(g => g.pcs);
        setCafePcs(all);
        const initialGrid = {};
        all.forEach(p => {
          if (p.position_index !== null) initialGrid[p.position_index] = p.id;
        });
        setGrid(initialGrid);
      }).catch(console.error);
    }
  }, [selectedCafe]);

  const saveLayout = async () => {
    const positions = cafePcs.map(pc => {
      const idx = Object.keys(grid).find(key => grid[key] === pc.id);
      return { id: pc.id, position_index: idx !== undefined ? parseInt(idx, 10) : null };
    });
    try {
      await api.patch('/pcs/layout', { positions });
      toast.success('LAYOUT ХАДГАЛАГДЛАА');
    } catch (err) {
      toast.error('АЛДАА ГАРЛАА');
    }
  };

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
            Энэ хуудсанд бүх хэрэглэгчийн захиалгын суурь жагсаалт харагдана. Зөвхөн <strong style={{ color: 'var(--text)' }}>admin</strong> болон{' '}
            <strong style={{ color: 'var(--text)' }}>moderator</strong> эрхээр ажиллана.
          </div>
          <div className="responsive-flex" style={{ flexShrink: 0 }}>
            <button className={`btn ${layoutMode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLayoutMode(!layoutMode)}>
              <Layout size={11} /> {layoutMode ? 'ЖАГСААЛТ ХАРАХ' : 'LAYOUT ЗАСАХ'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={fetching} onClick={refresh}>
              <RefreshCw size={11} /> ШИНЭЧЛЭХ
            </button>
          </div>
        </div>

        {layoutMode ? (
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
              <select 
                className="mono" 
                value={selectedCafe} 
                onChange={(e) => setSelectedCafe(e.target.value)}
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 12px' }}
              >
                <option value="">— Салбар сонгох —</option>
                {cafes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedCafe && (
                <button className="btn btn-primary" onClick={saveLayout}>
                  <Save size={11} /> БАЙРШИЛ ХАДГАЛАХ
                </button>
              )}
            </div>

            {selectedCafe && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, maxWidth: 600 }}>
                {Array.from({ length: 25 }).map((_, i) => {
                  const pcId = grid[i];
                  const pc = cafePcs.find(p => p.id === pcId);
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        height: 60, 
                        border: '1px dashed var(--border)', 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: pc ? 'var(--bg-card)' : 'transparent',
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const nextPcIdx = pc ? cafePcs.findIndex(p => p.id === pc.id) + 1 : 0;
                        const nextPc = cafePcs[nextPcIdx % (cafePcs.length + 1)];
                        const newGrid = { ...grid };
                        if (nextPc) {
                          // Remove if already elsewhere
                          Object.keys(newGrid).forEach(k => { if(newGrid[k] === nextPc.id) delete newGrid[k]; });
                          newGrid[i] = nextPc.id;
                        } else {
                          delete newGrid[i];
                        }
                        setGrid(newGrid);
                      }}
                    >
                      <span className="mono" style={{ color: 'var(--text-dim)' }}>CELL {i+1}</span>
                      {pc && <span className="mono" style={{ color: 'var(--amber)' }}>#{pc.label}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="label" style={{ marginTop: 20, fontSize: 10 }}>* Нүдэн дээр дарж тухайн байршилд PC онооно. (N x 5 grid)</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
