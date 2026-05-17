import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { getApiBaseUrl } from '../api/apiBase';
import { pickQpayLink } from '../utils/qpay';
import { useAuth } from '../context/AuthContext';
import PCGrid from '../components/PCGrid';
import BookingSummary from '../components/BookingSummary';
import { ArrowLeft, ArrowRight, Clock, Monitor, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { toDatetimeLocalValue } from '../utils/datetimeLocal';

const wizardVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0
  })
};

export default function BookingWizard() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);

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
      .then(({ data }) =>
        setPaymentsMode(data?.paymentsMode === 'qpay' || data?.paymentsMode === 'demo' ? data.paymentsMode : 'local')
      )
      .catch(() => setPaymentsMode('local'));
  }, []);

  useEffect(() => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 3600000);
    setStartsAt(toDatetimeLocalValue(now));
    setEndsAt(toDatetimeLocalValue(oneHourLater));
  }, []);

  const fetchPCs = useCallback(() => {
    if (!startsAt || !endsAt) return;
    api
      .get(`/pcs/cafe/${id}`, {
        params: {
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
        },
      })
      .then(({ data }) => {
        setTiers((prev) => {
          const next = data;
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
      })
      .catch(console.error);
  }, [id, startsAt, endsAt]);

  const fetchPCsRef = useRef(fetchPCs);
  fetchPCsRef.current = fetchPCs;

  useEffect(() => {
    if (!id) return;
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const url = `${base}/pcs/cafe/${id}/events`;
    let es;
    try {
      es = new EventSource(url);
    } catch (e) {
      console.warn('EventSource unavailable', e);
      return undefined;
    }
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'inventory') fetchPCsRef.current();
      } catch {
        /* hello / malformed */
      }
    };
    return () => {
      es.close();
    };
  }, [id]);

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
      navigate('/bookings');
    } catch (err) {
      const msg = err.response?.data?.error || 'ЗАХИАЛГА БҮТСЭНГҮЙ';
      toast.error('⚠ ' + msg.toUpperCase());
    } finally {
      setBooking(false);
    }
  };

  const paginate = (newDirection) => {
    setDirection(newDirection);
    setStep((prev) => prev + newDirection);
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spin-square" style={{ width: 32, height: 32, borderColor: 'var(--red)' }} />
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
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="container wizard-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Wizard Header */}
        <div className="wizard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <button className="btn btn-ghost" onClick={() => step === 1 ? navigate(-1) : paginate(-1)}>
            <ArrowLeft size={14} /> БУЦАХ
          </button>
          <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.1em' }}>
            АЛХАМ {step} / 3
          </div>
        </div>

        {/* Wizard Progress Bar */}
        <div className="wizard-progress" style={{ display: 'flex', gap: 8, marginBottom: 48 }}>
          <div style={{ flex: 1, height: 4, background: step >= 1 ? 'var(--red)' : 'var(--surface-2)', transition: 'background 0.3s' }} />
          <div style={{ flex: 1, height: 4, background: step >= 2 ? 'var(--red)' : 'var(--surface-2)', transition: 'background 0.3s' }} />
          <div style={{ flex: 1, height: 4, background: step >= 3 ? 'var(--red)' : 'var(--surface-2)', transition: 'background 0.3s' }} />
        </div>

        <div style={{ position: 'relative', flex: 1 }}>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            
            {/* STEP 1: TIME */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={wizardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              >
                <div className="panel">
                  <div className="panel-header" style={{ borderBottom: 'none', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="empty-mark" style={{ margin: 0, width: 40, height: 40 }}><Clock size={20} /></div>
                      <div>
                        <h2 style={{ fontSize: 24, margin: 0 }}>ЦАГ СОНГОХ</h2>
                        <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'none' }}>
                          {cafe.name} • {Intl.DateTimeFormat().resolvedOptions().timeZone}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="diag-line" style={{ margin: '24px 0' }} />

                  <div className="time-inputs-row" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>// ЭХЛЭХ ЦАГ</label>
                      <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ padding: '16px', fontSize: '14px' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>// ДУУСАХ ЦАГ</label>
                      <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={{ padding: '16px', fontSize: '14px' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={() => paginate(1)} disabled={!startsAt || !endsAt}>
                      ҮРГЭЛЖЛҮҮЛЭХ <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: PC */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={wizardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              >
                <div className="panel">
                  <div className="panel-header" style={{ borderBottom: 'none', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="empty-mark" style={{ margin: 0, width: 40, height: 40 }}><Monitor size={20} /></div>
                      <div>
                        <h2 style={{ fontSize: 24, margin: 0 }}>КОМПЬЮТЕР СОНГОХ</h2>
                        <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'none' }}>
                          {selectedPCs.length} СУУДАЛ СОНГОГДСОН
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="diag-line" style={{ margin: '24px 0' }} />

                  <PCGrid tiers={tiers} selectedPCs={selectedPCs} onTogglePC={togglePC} />

                  <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={() => paginate(1)} disabled={selectedPCs.length === 0}>
                      БАТАЛГААЖУУЛАХ <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: CHECKOUT */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={wizardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              >
                <div className="panel">
                  <div className="panel-header" style={{ borderBottom: 'none', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="empty-mark" style={{ margin: 0, width: 40, height: 40 }}><CreditCard size={20} /></div>
                      <div>
                        <h2 style={{ fontSize: 24, margin: 0 }}>ТӨЛБӨР ТӨЛӨХ</h2>
                        <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'none' }}>
                          АЮУЛГҮЙ ГҮЙЛГЭЭ
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="diag-line" style={{ margin: '24px 0' }} />

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
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
