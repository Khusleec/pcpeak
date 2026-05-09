import React, { useState, useEffect, useReducer } from 'react';
import api from '../api/axios';
import { pickQpayLink } from '../utils/qpay';
import {
  XCircle,
  Database,
  Terminal,
  Wallet,
  CreditCard,
  FileText,
  AlertTriangle,
  CalendarRange,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { formatMnDateTime } from '../utils/formatMnDateTime';

const STATUS_LABELS = {
  confirmed: 'БАТАЛГААЖСАН',
  pending_payment: 'ТӨЛБӨР ХҮЛЭЭГДЭЖ БАЙНА',
  cancelled: 'ЦУЦЛАГДСАН',
  completed: 'ДУУССАН',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payCfg, setPayCfg] = useState({
    qpayEnabled: false,
    qpayCallbackReady: false,
    paymentsMode: 'local',
    paymentsDemoMode: false,
    qpayEbarimtEnabled: false,
    simulatePaymentAllowed: false,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [, bumpClock] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const id = setInterval(() => bumpClock(), 30000);
    return () => clearInterval(id);
  }, []);

  const fetchBookings = () => {
    api.get('/bookings/my')
      .then(({ data }) => setBookings(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const now = new Date();
  const activeBookings = bookings.filter((b) => {
    if (b.status === 'cancelled' || b.status === 'completed') return false;
    return new Date(b.ends_at) > now;
  });
  const historyBookings = bookings.filter((b) => {
    if (b.status === 'cancelled' || b.status === 'completed') return true;
    return new Date(b.ends_at) <= now;
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    api
      .get('/config/public')
      .then(({ data }) =>
        setPayCfg({
          qpayEnabled: Boolean(data?.qpayEnabled),
          qpayCallbackReady: Boolean(data?.qpayCallbackReady),
          paymentsMode: data?.paymentsMode === 'qpay' || data?.paymentsMode === 'demo' ? data.paymentsMode : 'local',
          paymentsDemoMode: Boolean(data?.paymentsDemoMode),
          qpayEbarimtEnabled: Boolean(data?.qpayEbarimtEnabled),
          simulatePaymentAllowed: Boolean(data?.simulatePaymentAllowed),
        })
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const p = searchParams.get('payment');
    if (!p) return;
    const bid = searchParams.get('booking_id');
    const suffix = bid ? ` (№${String(bid).slice(0, 8)}…)` : '';

    const done = () => {
      setSearchParams({}, { replace: true });
      fetchBookings();
    };

    if (p === 'ok') {
      toast.success(`◆ ТӨЛБӨР БАТАЛГААЖЛАА${suffix}`);
      done();
      return;
    }
    if (p === 'error') {
      toast.error(`⚠ Төлбөрийн шалгалт амжилтгүй${suffix}`);
      done();
      return;
    }
    if (p === 'pending') {
      if (bid) {
        (async () => {
          try {
            const { data } = await api.post(`/payments/qpay/bookings/${bid}/sync`);
            if (data?.paid) {
              toast.success(`◆ ТӨЛБӨР БАТАЛГААЖЛАА${suffix}`);
            } else {
              toast(`◆ Төлбөр одоогоор баталгаажаагүй байна — «ТӨЛБӨР ТӨЛӨХ» дахин дарна уу, эсвэл төлбөрийг дахин шалгана уу${suffix}`, { icon: '⏳' });
            }
          } catch {
            toast(`◆ Төлбөрийг серверээс шалгаж чадсангүй (QPay идэвхгүй эсвэл сүлжээ)${suffix}`, { icon: '⏳' });
          } finally {
            done();
          }
        })();
      } else {
        toast(`◆ Төлбөр шалгагдаж байна${suffix}`, { icon: '⏳' });
        done();
      }
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get('demo_pay') !== '1') return;
    const bid = searchParams.get('booking_id');
    toast(
      '◆ Жишээ төлбөр: «Жишээ: баталгаажуулах» эсвэл «DEV: төлбөрийг баталгаажуулах» товчийг дарвал баталгаажуулна.',
      { icon: '💳', duration: 7000 }
    );
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('demo_pay');
      if (bid) next.delete('booking_id');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const payDeposit = async (id) => {
    try {
      const { data } = await api.post(`/payments/qpay/bookings/${id}/invoice`);
      // In demo mode the "pay URL" just opens the same /bookings page — skip the
      // fake popup and auto-confirm so one click really pays.
      if (payCfg.paymentsMode === 'demo') {
        await api.post(`/payments/simulate/bookings/${id}`);
        toast.success('◆ ТӨЛБӨР БАТАЛГААЖЛАА (ЖИШЭЭ)');
        fetchBookings();
        return;
      }
      const payLink = pickQpayLink(data?.qpay);
      if (payLink) {
        const win = window.open(payLink, '_blank', 'noopener,noreferrer');
        if (!win) {
          toast('◆ Шинэ цонх нээгдээгүй — төлбөрийн хуудас руу шилжүүлж байна', { icon: '🔗' });
          window.location.href = payLink;
        }
      } else if (data?.qpay?.qr_text) {
        toast('◆ QR код: QPay аппаар уншуулна уу (холбоос олдсонгүй)', { icon: '📱' });
      } else {
        toast.success('◆ НЭХЭМЖЛЭЛ ҮҮСЛЭЭ');
      }
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'АЛДАА').toUpperCase());
    }
  };

  const simulateDeposit = async (id) => {
    try {
      await api.post(`/payments/simulate/bookings/${id}`);
      toast.success('◆ Төлбөр баталгаажлаа');
      fetchBookings();
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'АЛДАА').toUpperCase());
    }
  };

  const cancelBooking = async (id) => {
    if (!window.confirm('Энэ захиаллыг цуцлахдаа итгэлтэй байна уу? №' + id)) return;
    try {
      await api.patch(`/bookings/${id}/cancel`);
      toast.success('◆ ЗАХИАЛГА ЦУЦЛАГДЛАА');
      fetchBookings();
    } catch (err) {
      toast.error('⚠ ' + (err.response?.data?.error || 'ЦУЦЛАХАД АЛДАА ГАРЛАА').toUpperCase());
    }
  };

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
            <div className="section-eyebrow">{`// МОДУЛЬ_002 — ЗАХИАЛГА`}</div>
            <h2 className="section-title">МИНИЙ ЗАХИАЛГА</h2>
          </div>
          <div className="section-meta-row section-meta">
            <span className="stat-pill">{activeBookings.length > 0 ? `${activeBookings.length} идэвхтэй` : 'Идэвхтэй алга'}</span>
            <span className="stat-pill">{historyBookings.length} архивт</span>
          </div>
        </div>

        {(payCfg.simulatePaymentAllowed ||
          payCfg.paymentsMode === 'local' ||
          payCfg.paymentsMode === 'demo' ||
          (payCfg.qpayEnabled && payCfg.qpayEbarimtEnabled) ||
          (payCfg.qpayEnabled && !payCfg.qpayCallbackReady)) && (
          <div className="notice-stack">
            {payCfg.simulatePaymentAllowed && (
              <div className="notice-banner notice-banner--amber">
                <Terminal className="notice-banner__icon" size={18} strokeWidth={1.75} aria-hidden />
                <div className="notice-banner__body">
                  <div className="notice-banner__title">
                    {payCfg.paymentsDemoMode ? 'Жишээ төлбөр — баталгаажуулах' : 'DEV — төлбөрийг дүрсэлж баталгаажуулах'}
                  </div>
                  <div className="notice-banner__text">
                    {payCfg.paymentsDemoMode ? (
                      <>
                        <span className="mono">PAYMENTS_DEMO_MODE=true</span> үед QPay түлхүүргүйгээр «Төлбөр хүлээгдэж байна» төлөв гарч, доорх товчоор баталгаажуулна.
                        Production-д <span className="mono">PAYMENTS_DEMO_MODE=false</span> + <span className="mono">QPAY_*</span>.
                      </>
                    ) : (
                      <>
                        <span className="mono">ALLOW_SIMULATE_PAYMENT=true</span> + production биш үед л идэвхтэй. QPay-гүйгээр «Төлөгдсөн» болгоно.
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {payCfg.paymentsMode === 'local' && (
              <div className="notice-banner notice-banner--warn">
                <Wallet className="notice-banner__icon" size={18} strokeWidth={1.75} aria-hidden />
                <div className="notice-banner__body">
                  <div className="notice-banner__title">Төлбөр (QPay) идэвхгүй</div>
                  <div className="notice-banner__text">
                    Backend <span className="mono">.env</span>-д <span className="mono">QPAY_INVOICE_CODE</span> +{' '}
                    <span className="mono">QPAY_CLIENT_ID</span>/<span className="mono">SECRET</span> эсвэл{' '}
                    <span className="mono">QPAY_USERNAME</span>/<span className="mono">PASSWORD</span> бөглөнө, эсвэл туршихад{' '}
                    <span className="mono">PAYMENTS_DEMO_MODE=true</span>. Үгүй бол «Төлбөр төлөх» товч гарахгүй.
                  </div>
                </div>
              </div>
            )}

            {payCfg.paymentsMode === 'demo' && (
              <div className="notice-banner notice-banner--neutral">
                <CreditCard className="notice-banner__icon" size={18} strokeWidth={1.75} aria-hidden />
                <div className="notice-banner__body">
                  <div className="notice-banner__title">Жишээ төлбөрийн горим</div>
                  <div className="notice-banner__text">
                    QPay API дуудагдахгүй. «Төлбөр төлөх» жишээ холбоос нээнэ; баталгаажуулахад «Жишээ: баталгаажуулах» товчийг ашиглана.
                  </div>
                </div>
              </div>
            )}

            {payCfg.qpayEnabled && payCfg.qpayEbarimtEnabled && (
              <div className="notice-banner notice-banner--neutral">
                <FileText className="notice-banner__icon" size={18} strokeWidth={1.75} aria-hidden />
                <div className="notice-banner__body">
                  <div className="notice-banner__title">E-barimt 3.0 (QPay v2)</div>
                  <div className="notice-banner__text">
                    Төлбөр баталгаажсаны дараа <span className="mono">/v2/ebarimt/create</span> дуудна. Баримт{' '}
                    <span className="mono">qpay_ebarimt_json</span> талбарт хадгалагдана.
                  </div>
                </div>
              </div>
            )}

            {payCfg.qpayEnabled && !payCfg.qpayCallbackReady && (
              <div className="notice-banner notice-banner--red">
                <AlertTriangle className="notice-banner__icon" size={18} strokeWidth={1.75} aria-hidden />
                <div className="notice-banner__body">
                  <div className="notice-banner__title">QPay callback бэлэн биш байж магадгүй</div>
                  <div className="notice-banner__text">
                    <span className="mono">QPAY_PUBLIC_BASE_URL</span> заавал (жишээ нь ngrok HTTPS). Callback тэнд ирж төлбөрийг баталгаажуулна.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeBookings.length === 0 && historyBookings.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">
              <Database size={20} />
            </div>
            <h3 style={{ marginBottom: 8 }}>ЯМАР Ч ЗАХИАЛГА БАЙХГҮЙ</h3>
            <p className="label" style={{ marginBottom: 24 }}>
              Эхний захиалгаа өгөөд эндээс хянаарай
            </p>
            <Link to="/map" className="btn btn-primary">
              ◢ САЛБАРУУДЫГ ҮЗЭХ
            </Link>
          </div>
        ) : (
          <>
            {activeBookings.length > 0 && (
              <>
                <div className="section-head" style={{ marginTop: 0 }}>
                  <div>
                    <div className="section-eyebrow">{`// ИДЭВХИТЭЙ`}</div>
                    <h3 className="section-title" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
                      ОДООГИЙН ЗАХИАЛГА
                    </h3>
                  </div>
                  <span className="label" style={{ color: 'var(--text-dim)' }}>
                    {activeBookings.length} захиалга
                  </span>
                </div>
                {activeBookings.map((b) => (
                  <BookingCard key={b.id} b={b} payCfg={payCfg} payDeposit={payDeposit} simulateDeposit={simulateDeposit} cancelBooking={cancelBooking} />
                ))}
              </>
            )}
            {historyBookings.length > 0 && (
              <>
                <div className="section-head" style={{ marginTop: activeBookings.length > 0 ? 36 : 0 }}>
                  <div>
                    <div className="section-eyebrow">{`// АРХИВ`}</div>
                    <h3 className="section-title" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
                      ТҮҮХ
                    </h3>
                  </div>
                  <span className="label" style={{ color: 'var(--text-dim)' }}>
                    {historyBookings.length} захиалга
                  </span>
                </div>
                {historyBookings.map((b) => (
                  <BookingCard key={b.id} b={b} payCfg={payCfg} payDeposit={payDeposit} simulateDeposit={simulateDeposit} cancelBooking={cancelBooking} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BookingCard({ b, payCfg, payDeposit, simulateDeposit, cancelBooking }) {
  return (
    <div className="booking-card">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="mono" style={{ color: 'var(--red)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'none', fontWeight: 700 }}>
            ЗАХ_{String(b.id).slice(0, 8).toUpperCase()}
          </span>
          <span style={{ color: 'var(--text-dim)' }}>::</span>
          <span className="display" style={{ fontSize: 18, color: 'var(--text)' }}>
            {b.cafe_name?.toUpperCase()}
          </span>
          <span className={`booking-status ${b.status}`}>
            <span
              className={
                b.status === 'confirmed'
                  ? 'dot live'
                  : b.status === 'cancelled'
                    ? 'dot alert'
                    : b.status === 'pending_payment'
                      ? 'dot warn'
                      : 'dot dead'
              }
            />
            {STATUS_LABELS[b.status] || b.status?.toUpperCase()}
          </span>
        </div>
        <div className="booking-card__date-row mono">
          <CalendarRange size={14} aria-hidden />
          <span>{formatMnDateTime(b.starts_at)}</span>
          <ArrowRight size={12} style={{ opacity: 0.6 }} aria-hidden />
          <span>{formatMnDateTime(b.ends_at)}</span>
        </div>
        <div className="booking-card__tags">
          {b.items.map((item, i) => (
            <span key={i} className={`tag ${item.tier === 'VIP' ? 'tag-vip' : 'tag-zaal'}`}>
              {item.tier === 'Zaal' ? 'ЗААЛ' : item.tier}::{item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="booking-card__aside">
        <div className="label" style={{ marginBottom: 6 }}>
          Нийт үнэ
        </div>
        <div className="display" style={{ fontSize: 22, color: 'var(--red)', marginBottom: 14, lineHeight: 1 }}>
          ₮{parseFloat(b.total_price).toLocaleString()}
        </div>
        <div className="label" style={{ marginBottom: 6 }}>
          30% барьцаа
        </div>
        <div className="mono" style={{ color: 'var(--amber)', fontSize: 12, marginBottom: 14, textTransform: 'none' }}>
          ₮{parseFloat(b.deposit_amount || 0).toLocaleString()}
        </div>
        <div className="booking-card-actions">
          {b.status === 'pending_payment' && b.payment_status === 'unpaid' && (
            <>
              {(payCfg.paymentsMode === 'qpay' || payCfg.paymentsMode === 'demo') && (
                <button type="button" className="btn btn-primary btn-block" onClick={() => payDeposit(b.id)}>
                  {payCfg.paymentsMode === 'demo' ? 'Төлбөр төлөх (жишээ)' : 'Төлбөр төлөх (QPay)'}
                </button>
              )}
              {payCfg.simulatePaymentAllowed && (
                <button type="button" className="btn btn-outline-amber btn-block" onClick={() => simulateDeposit(b.id)}>
                  {payCfg.paymentsDemoMode ? 'Жишээ: баталгаажуулах' : 'DEV: баталгаажуулах'}
                </button>
              )}
            </>
          )}
          {(b.status === 'confirmed' || b.status === 'pending_payment') && (
            <button type="button" className="btn btn-danger btn-block" onClick={() => cancelBooking(b.id)}>
              <XCircle size={11} aria-hidden /> Цуцлах
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
