import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Trophy, ArrowLeft, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatMnDateTime } from '../utils/formatMnDateTime';
import { isAdminRole } from '../utils/roles';

const STATUS = {
  registration: 'БҮРТГЭЛ НЭЭЛТТЭЙ',
  closed: 'ХААГДСАН',
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

const VISIBILITY = {
  public: 'НЭЭЛТТЭЙ',
  private: 'ХУВИЙН',
};

const SETUP_MODE = {
  manual: 'ГАРААР',
  automatic: 'АВТОМАТ',
};

const BRACKET_TYPE = {
  elimination: 'ЭЛИМИНАЦИ',
  double_elimination: 'ДАВХАР ЭЛИМИНАЦИ',
};

export default function TournamentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingame, setIngame] = useState('');
  const [busy, setBusy] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'participants', 'matches'
  
  // Match Edit State
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchScore, setMatchScore] = useState({ s1: 0, s2: 0, winnerId: null });

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/tournaments/${id}`)
      .then(({ data }) => setT(data))
      .catch(() => setT(null))
      .finally(() => setLoading(false));
  }, [id]);

  const deleteTournament = async () => {
    if (!window.confirm('Энэ тэмцээнийг бүрмөсөн устгахдаа итгэлтэй байна уу?')) return;
    setBusy(true);
    try {
      await api.delete(`/tournaments/${id}`);
      toast.success('◆ ТЭМЦЭЭН УСТГАГДЛАА');
      navigate('/tournaments');
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'УСТГАЖ ЧАДСАНГҮЙ').toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  const loadParticipants = useCallback(() => {
    if (!id) return;
    setParticipantsLoading(true);
    api
      .get(`/tournaments/${id}/participants`)
      .then(({ data }) => setParticipants(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setParticipantsLoading(false));
  }, [id]);

  const loadMatches = useCallback(() => {
    if (!id) return;
    setMatchesLoading(true);
    api
      .get(`/tournaments/${id}/matches`)
      .then(({ data }) => setMatches(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setMatchesLoading(false));
  }, [id]);

  const generateMatches = async () => {
    if (!window.confirm('Оролцогчдоос эхний шатны тоглолтуудыг үүсгэх үү?')) return;
    setBusy(true);
    try {
      const pList = [...participants];
      // Shuffle
      for (let i = pList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pList[i], pList[j]] = [pList[j], pList[i]];
      }
      
      const payload = [];
      for (let i = 0; i < pList.length; i += 2) {
        payload.push({
          player1_id: pList[i].user_id,
          player2_id: pList[i+1] ? pList[i+1].user_id : null,
          round: 1,
          match_order: (i / 2) + 1
        });
      }
      
      await api.post(`/tournaments/${id}/matches`, payload);
      toast.success('◆ ТОГЛОЛТУУД ҮҮСГЭГЭДЛЭЭ БА БҮРТГЭЛ ХААГДЛАА');
      load();
      loadMatches();
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'АЛДАА').toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    loadParticipants();
    loadMatches();
  }, [load, loadParticipants, loadMatches]);

  useEffect(() => {
    if (t?.my_in_game_name) setIngame(t.my_in_game_name);
    else if (t && !t.user_registered) setIngame('');
  }, [t]);

  const register = async () => {
    if (!user) {
      toast.error('НЭВТЭРНЭ ҮҮ');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/tournaments/${id}/register`, { in_game_name: ingame.trim() || null });
      toast.success('◆ БҮРТГЭЛ АМЖИЛТТАЙ');
      load();
      loadParticipants();
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
      loadParticipants();
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'АЛДАА').toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  const startEditMatch = (m) => {
    setEditingMatch(m);
    setMatchScore({
      s1: m.score1 || 0,
      s2: m.score2 || 0,
      winnerId: m.winner_id,
    });
  };

  const saveMatchResult = async () => {
    if (!editingMatch) return;
    setBusy(true);
    try {
      await api.patch(`/tournaments/${id}/matches/${editingMatch.id}`, {
        score1: parseInt(matchScore.s1, 10),
        score2: parseInt(matchScore.s2, 10),
        winner_id: matchScore.winnerId || null,
        status: matchScore.winnerId ? 'finished' : 'live',
      });
      toast.success('◆ ҮР ДҮН ХАДГАЛАГДЛАА');
      setEditingMatch(null);
      loadMatches();
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

  const matchesByRound = matches.reduce((acc, m) => {
    const r = m.round || 1;
    if (!acc[r]) acc[r] = [];
    acc[r].push(m);
    return acc;
  }, {});

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className={`booking-status ${STATUS_CLASS[t.status] || 'confirmed'}`}>
              <span className={STATUS_DOT[t.status] || 'dot live'} />
              {STATUS[t.status] || t.status}
            </span>
            {user && (t.created_by === user.id || isAdminRole(user.role)) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/tournaments/${t.id}/edit`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  ЗАСВАРЛАХ
                </Link>
                <button className="btn btn-danger" onClick={deleteTournament} disabled={busy}>
                  <Trash2 size={14} /> УСТГАХ
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="detail-tab-bar">
          <button
            className="mono"
            onClick={() => setActiveTab('info')}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'info' ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === 'info' ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            МЭДЭЭЛЭЛ
          </button>
          <button
            className="mono"
            onClick={() => setActiveTab('participants')}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'participants' ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === 'participants' ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            ОРОЛЦОГЧИД ({t.registered_count})
          </button>
          <button
            className="mono"
            onClick={() => setActiveTab('matches')}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'matches' ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === 'matches' ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            ТОГЛОЛТЫН ХУВААРЬ
          </button>
        </div>

        {activeTab === 'info' && (
          <>
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
                    {formatMnDateTime(t.starts_at)}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>// ДУУСАХ</div>
                  <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                    {formatMnDateTime(t.ends_at)}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>// БҮРТГЭЛИЙН ЭЦСИЙН ХУГАЦАА</div>
                  <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                    {deadline ? formatMnDateTime(deadline) : '—'}
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
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>// ХАРАГДАХ</div>
                  <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                    {VISIBILITY[t.visibility] || t.visibility || '—'}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>// ТОХИРГОО</div>
                  <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                    {SETUP_MODE[t.setup_mode] || t.setup_mode || '—'}
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>// СИСТЕМ</div>
                  <div className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>
                    {BRACKET_TYPE[t.bracket_type] || t.bracket_type || '—'}
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
              <div className="map-overlay map-overlay--warn" style={{ position: 'relative', minHeight: 0, padding: '14px 18px', marginBottom: 24 }}>
                <div className="map-overlay__msg" style={{ fontSize: 10 }}>
                  Бүртгүүлэхийн тулд <Link to="/login">нэвтэрнэ үү</Link>.
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'participants' && (
          <>
            {participantsLoading ? (
              <div className="skeleton" style={{ height: 100 }} />
            ) : participants.length === 0 ? (
              <div className="empty" style={{ padding: '40px 0' }}>
                <p className="label">Одоогоор оролцогч байхгүй байна.</p>
              </div>
            ) : (
              <div className="booking-card" style={{ padding: 0 }}>
                <div className="table-scroll">
                  <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th className="label" style={{ padding: '12px 16px' }}>#</th>
                      <th className="label" style={{ padding: '12px 16px' }}>ТОГЛОГЧ</th>
                      <th className="label" style={{ padding: '12px 16px' }}>ТОГЛООМ ДЭЭРХ НЭР</th>
                      <th className="label" style={{ padding: '12px 16px' }}>БҮРТГЭЛИЙН ОГНОО</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: i === participants.length - 1 ? 'none' : '1px solid var(--border)' }}>
                        <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                            ) : (
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)' }} />
                            )}
                            <span className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{p.display_name}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ padding: '12px 16px', fontSize: 13, color: 'var(--amber)' }}>
                          {p.in_game_name || '—'}
                        </td>
                        <td className="mono" style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(p.created_at).toLocaleDateString('mn-MN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'matches' && (
          <>
            {matchesLoading ? (
              <div className="skeleton" style={{ height: 200 }} />
            ) : matches.length === 0 ? (
              <div className="empty" style={{ padding: '60px 0' }}>
                <Trophy size={32} style={{ color: 'var(--border)', marginBottom: 16 }} />
                <p className="label">ТОГЛОЛТЫН ХУВААРЬ ГАРААГҮЙ БАЙНА</p>
                {user && t.created_by === user.id && (
                  <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <p className="label" style={{ marginBottom: 16 }}>Оролцогчдын жагсаалт дээр үндэслэн эхний шатны хуваарийг үүсгэнэ.</p>
                    <button className="btn btn-primary" onClick={generateMatches} disabled={busy || participants.length < 2}>
                      ХУВААРЬ ГАРГАХ (ROUND 1)
                    </button>
                    {participants.length < 2 && (
                      <p className="mono" style={{ fontSize: 10, color: 'var(--red)', marginTop: 8 }}>
                        ! Дор хаяж 2 оролцогч шаардлагатай
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {Object.keys(matchesByRound).sort((a, b) => a - b).map((round) => (
                  <div key={round}>
                    <div className="section-head" style={{ marginBottom: 16 }}>
                      <h4 className="section-title" style={{ fontSize: 14 }}>ROUND {round}</h4>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                      {matchesByRound[round].map((m) => (
                        <div key={m.id} className="booking-card" style={{ padding: 16, borderLeft: m.status === 'live' ? '2px solid var(--amber)' : '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>MATCH #{m.match_order}</span>
                            <span className="mono" style={{ fontSize: 10, color: m.status === 'live' ? 'var(--amber)' : 'var(--text-muted)' }}>
                              {m.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--border)', overflow: 'hidden' }}>
                                  {m.p1_avatar && <img src={m.p1_avatar} alt="" style={{ width: '100%', height: '100%' }} />}
                                </div>
                                <span className="mono" style={{ fontSize: 13, color: m.winner_id === m.player1_id ? 'var(--amber)' : 'var(--text)' }}>
                                  {m.p1_name || 'TBD'}
                                </span>
                              </div>
                              <span className="display" style={{ fontSize: 16 }}>{m.score1}</span>
                            </div>
                            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--border)', overflow: 'hidden' }}>
                                  {m.p2_avatar && <img src={m.p2_avatar} alt="" style={{ width: '100%', height: '100%' }} />}
                                </div>
                                <span className="mono" style={{ fontSize: 13, color: m.winner_id === m.player2_id ? 'var(--amber)' : 'var(--text)' }}>
                                  {m.p2_name || 'TBD'}
                                </span>
                              </div>
                              <span className="display" style={{ fontSize: 16 }}>{m.score2}</span>
                            </div>
                          </div>
                          {user && (t.created_by === user.id || isAdminRole(user.role)) && m.status !== 'finished' && (
                            <button
                              className="btn btn-primary"
                              style={{ width: '100%', marginTop: 12, fontSize: 10, padding: '6px' }}
                              onClick={() => startEditMatch(m)}
                            >
                              ҮР ДҮН ОРУУЛАХ
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Match Result Modal */}
      {editingMatch && (
        <div className="modal-backdrop" style={{ 
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div className="booking-card" style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
            <button 
              onClick={() => setEditingMatch(null)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <div className="section-head" style={{ marginBottom: 20 }}>
              <div>
                <div className="section-eyebrow">// MATCH #{editingMatch.match_order}</div>
                <h4 className="section-title" style={{ fontSize: 16 }}>ҮР ДҮН ОРУУЛАХ</h4>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 14 }}>{editingMatch.p1_name || 'TBD'}</span>
                <input 
                  type="number" className="mono" value={matchScore.s1} 
                  onChange={(e) => setMatchScore({ ...matchScore, s1: e.target.value })}
                  style={{ width: 60, padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', textAlign: 'center' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 14 }}>{editingMatch.p2_name || 'TBD'}</span>
                <input 
                  type="number" className="mono" value={matchScore.s2} 
                  onChange={(e) => setMatchScore({ ...matchScore, s2: e.target.value })}
                  style={{ width: 60, padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', textAlign: 'center' }}
                />
              </div>

              <div>
                <label className="label" style={{ display: 'block', marginBottom: 8 }}>ЯЛАГЧ СОНГОХ</label>
                <select 
                  className="mono" value={matchScore.winnerId || ''} 
                  onChange={(e) => setMatchScore({ ...matchScore, winnerId: e.target.value || null })}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="">— Хүлээгдэж буй —</option>
                  {editingMatch.player1_id && <option value={editingMatch.player1_id}>{editingMatch.p1_name}</option>}
                  {editingMatch.player2_id && <option value={editingMatch.player2_id}>{editingMatch.p2_name}</option>}
                </select>
              </div>

              <button className="btn btn-primary" onClick={saveMatchResult} disabled={busy}>
                ХАДГАЛАХ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
