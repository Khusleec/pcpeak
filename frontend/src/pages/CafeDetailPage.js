import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { pickQpayLink } from '../utils/qpay';
import { useAuth } from '../context/AuthContext';
import PCGrid from '../components/PCGrid';
import BookingSummary from '../components/BookingSummary';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CafeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cafe, setCafe] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [selectedPCs, setSelectedPCs] = useState([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [paymentsMode, setPaymentsMode] = useState('local');

  useEffect(() => {
    api
      .get('/config/public')
      .then(({ data }) => setPaymentsMode(data?.paymentsMode === 'qpay' ? 'qpay' : 'local'))
      .catch(() => setPaymentsMode('local'));
  }, []);

  useEffect(() => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 3600000);
    setStartsAt(now.toISOString().slice(0, 16));
    setEndsAt(oneHourLater.toISOString().slice(0, 16));
  }, []);

  const fetchPCs = useCallback(() => {
    if (!startsAt || !endsAt) return;
    api.get(`/pcs/cafe/${id}`, {
      params: {
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      }
    })
      .then(({ data }) => setTiers(data))
      .catch(console.error);
  }, [id, startsAt, endsAt]);

  useEffect(() => {
    api.get(`/cafes/${id}`)
      .then(({ data }) => setCafe(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchPCs(); }, [fetchPCs]);

  const togglePC = (pcId) => {
    setSelectedPCs((prev) => prev.includes(pcId) ? prev.filter((x) => x !== pcId) : [...prev, pcId]);
  };

  const handleBook = async () => {
    if (!user) { navigate('/login'); return; }
    if (!selectedPCs.length) { toast.error('ДОР ХАЯЖ 1 КОМПЬЮТЕР СОНГОНО УУ'); return; }
    if (!startsAt || !endsAt) { toast.error('ЦАГАА СОНГОНО УУ'); return; }

    setBooking(true);
    try {
      const { data } = await api.post('/bookings', {
        cafe_id: parseInt(id),
        pc_ids: selectedPCs,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      });
      const deposit = Number(data?.booking?.deposit_amount || 0);
      const qpay = data?.qpay;
      const payLink = pickQpayLink(qpay);
      if (payLink) {
        window.open(payLink, '_blank', 'noopener,noreferrer');
        toast.success(`◆ ТӨЛБӨРИЙН ХОЛБООС НЭЭГДЛЭЭ — 30%: ₮${Math.round(deposit).toLocaleString()}`);
      } else if (data?.qpay_invoice_error) {
        toast.error('⚠ ЗАХИАЛГА ҮҮССЭН. ТӨЛБӨРИЙН НЭХЭМЖЛЭЛ ҮҮСГЭХЭД АЛДАА — "Миний захиалга"-аас дахин оролдоно уу');
      } else {
        toast.success(`◆ ЗАХИАЛГА АМЖИЛТТАЙ — 30% БАРЬЦАА: ₮${Math.round(deposit).toLocaleString()}`);
      }
      setSelectedPCs([]);
      fetchPCs();
    } catch (err) {
      const msg = err.response?.data?.error || 'ЗАХИАЛГА БҮТСЭНГҮЙ';
      toast.error('⚠ ' + msg.toUpperCase());
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 80, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 400 }} />
        </div>
      </div>
    );
  }

  if (!cafe) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty">
            <h3>САЛБАР ОЛДСОНГҮЙ</h3>
            <p className="label">ИЙМ ID-ТАЙ САЛБАР БАЙХГҮЙ</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          <ArrowLeft size={11} /> БУЦАХ
        </button>

        {/* Cafe Header */}
        <div className="cafe-header">
          <div className="corner-mark tl" />
          <div className="corner-mark br" />
          <div className="cafe-header-mark" />
          <div>
            <div className="label label-red" style={{ marginBottom: 6 }}>// САЛБАР №{String(cafe.id).padStart(4, '0')}</div>
            <h2 style={{ fontSize: 28, marginBottom: 8 }}>{cafe.name}</h2>
            <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'none' }}>
              ◆ {cafe.address}{cafe.phone ? '  ::  ☎ ' + cafe.phone : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="label" style={{ marginBottom: 4 }}><span className="dot live" /> НЭЭЛТТЭЙ</div>
            <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'none' }}>
              {parseFloat(cafe.latitude || 0).toFixed(4)}°N<br />
              {parseFloat(cafe.longitude || 0).toFixed(4)}°E
            </div>
          </div>
        </div>

        <div className="diag-line" style={{ margin: '24px 0' }} />

        {/* Time Selection */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <span className="label label-red">// 001 — ЦАГ СОНГОХ</span>
            <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'none' }}>
              UTC+08
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>// ЭХЛЭХ ЦАГ</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>// ДУУСАХ ЦАГ</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
        </div>

        {/* PC Grid + Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="label label-red">// 002 — КОМПЬЮТЕР СОНГОХ</span>
              <span className="label" style={{ color: selectedPCs.length > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                <span className={selectedPCs.length > 0 ? 'dot alert' : 'dot dead'} />
                {selectedPCs.length} СОНГОСОН
              </span>
            </div>
            <PCGrid tiers={tiers} selectedPCs={selectedPCs} onTogglePC={togglePC} />
          </div>

          <BookingSummary
            selectedPCs={selectedPCs}
            tiers={tiers}
            startsAt={startsAt ? new Date(startsAt).toISOString() : null}
            endsAt={endsAt ? new Date(endsAt).toISOString() : null}
            onBook={handleBook}
            loading={booking}
            paymentsMode={paymentsMode}
          />
        </div>
      </div>
    </div>
  );
}
