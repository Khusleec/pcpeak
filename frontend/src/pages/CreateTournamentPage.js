import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Trophy, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { toDatetimeLocalValue } from '../utils/datetimeLocal';

function fromLocalInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

export default function CreateTournamentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const seededTimes = useRef(false);
  const [cafes, setCafes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    description: '',
    game_title: '',
    cafe_id: '',
    starts_at: '',
    ends_at: '',
    registration_deadline: '',
    max_participants: 32,
    prize_pool_mnt: 0,
    visibility: 'public',
    setup_mode: 'manual',
    bracket_type: 'elimination',
  });

  useEffect(() => {
    if (!user) return;
    api
      .get('/cafes')
      .then(({ data }) => setCafes(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user) {
      toast.error('НЭВТЭРНЭ ҮҮ');
      navigate('/login', { replace: true, state: { from: '/tournaments/new' } });
    }
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const starts_at = fromLocalInput(form.starts_at);
      const ends_at = fromLocalInput(form.ends_at);
      const registration_deadline = form.registration_deadline
        ? fromLocalInput(form.registration_deadline)
        : null;
      const payload = {
        title: form.title.trim(),
        image_url: form.image_url.trim() || null,
        description: form.description.trim() || null,
        game_title: form.game_title.trim(),
        cafe_id: form.cafe_id ? parseInt(form.cafe_id, 10) : null,
        starts_at,
        ends_at,
        registration_deadline,
        max_participants: parseInt(form.max_participants, 10) || 32,
        prize_pool_mnt: Number(form.prize_pool_mnt) || 0,
        visibility: form.visibility,
        setup_mode: form.setup_mode,
        bracket_type: form.bracket_type,
      };
      const { data } = await api.post('/tournaments', payload);
      toast.success('◆ ТЭМЦЭЭН ҮҮСГЭГДЛЭЭ');
      navigate(`/tournaments/${data.id}`);
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'АЛДАА').toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (seededTimes.current) return;
    seededTimes.current = true;
    const s = new Date(Date.now() + 7 * 86400000);
    s.setMinutes(0, 0, 0);
    const e = new Date(s.getTime() + 4 * 3600000);
    setForm((f) => ({
      ...f,
      starts_at: toDatetimeLocalValue(s),
      ends_at: toDatetimeLocalValue(e),
    }));
  }, []);

  if (!user) return null;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 900 }}>
        <Link to="/tournaments" className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, textDecoration: 'none' }}>
          <ArrowLeft size={12} /> БУЦАХ
        </Link>

        <div className="section-head">
          <div>
            <div className="section-eyebrow">// ШИНЭ ТЭМЦЭЭН</div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Trophy size={22} style={{ color: 'var(--amber)' }} />
              ЗОХИОН БАЙГУУЛАХ
            </h2>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section 1: Basic Info */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label-red" style={{ marginBottom: 4 }}>[01] ҮНДСЭН МЭДЭЭЛЭЛ</div>
            
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Гарчиг</label>
              <input
                className="mono"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={255}
                placeholder="Тэмцээний нэр"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="form-two-col">
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Тоглоом</label>
                <input
                  className="mono"
                  required
                  value={form.game_title}
                  onChange={(e) => setForm({ ...form, game_title: e.target.value })}
                  maxLength={200}
                  placeholder="Valorant, CS2, …"
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Баннер зураг (URL)</label>
                <input
                  className="mono"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://... (хоосон орхивол дефолт)"
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Тайлбар</label>
              <textarea
                className="mono"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Тэмцээний дүрэм, мэдээлэл..."
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Section 2: Logistics */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label-red" style={{ marginBottom: 4 }}>[02] ХУВААРЬ & БАЙРШИЛ</div>

            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Салбар</label>
              <select
                className="mono"
                value={form.cafe_id}
                onChange={(e) => setForm({ ...form, cafe_id: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                <option value="">— Сонгохгүй (Online) —</option>
                {cafes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-two-col">
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Эхлэх цаг</label>
                <input
                  type="datetime-local"
                  className="mono"
                  required
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Дуусах цаг</label>
                <input
                  type="datetime-local"
                  className="mono"
                  required
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            <div className="form-two-col">
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Бүртгэл дуусах хугацаа (заавал биш)</label>
                <input
                  type="datetime-local"
                  className="mono"
                  value={form.registration_deadline}
                  onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div className="desktop-only" />
            </div>
          </div>

          {/* Section 3: Settings */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label-red" style={{ marginBottom: 4 }}>[03] ТОХИРГОО & СИСТЕМ</div>

            <div className="form-two-col">
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Дээд оролцогч</label>
                <input
                  type="number"
                  min={2}
                  max={512}
                  className="mono"
                  value={form.max_participants}
                  onChange={(e) => setForm({ ...form, max_participants: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Шагналын сан (₮)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  className="mono"
                  value={form.prize_pool_mnt}
                  onChange={(e) => setForm({ ...form, prize_pool_mnt: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            <div className="form-two-col">
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Харагдах байдал</label>
                <select
                  className="mono"
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="public">Нээлттэй — бүгдэд харагдана</option>
                  <option value="private">Хувийн — зөвхөн урилгаар</option>
                </select>
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Систем</label>
                <select
                  className="mono"
                  value={form.bracket_type}
                  onChange={(e) => setForm({ ...form, bracket_type: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="elimination">Шууд хасагдах (Single)</option>
                  <option value="double_elimination">Хоёр хасагдах (Double)</option>
                </select>
              </div>
            </div>

            <div className="form-two-col">
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Тохиргоо</label>
                <select
                  className="mono"
                  value={form.setup_mode}
                  onChange={(e) => setForm({ ...form, setup_mode: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="manual">Гараар — хуваарь, баг өөрөө гаргах</option>
                  <option value="automatic">Автомат — бүртгэлээр шууд үүсгэх</option>
                </select>
              </div>
              <div className="desktop-only" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" style={{ minWidth: 200 }} disabled={busy}>
              {busy ? 'ҮҮСГЭЖ БАЙНА...' : 'ТЭМЦЭЭН ҮҮСГЭХ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
