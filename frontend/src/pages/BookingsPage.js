import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { pickQpayLink } from '../utils/qpay';
import { XCircle, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';

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
              toast(`◆ Төлбөр хараахан баталгаажаагүй — «ТӨЛБӨР ТӨЛӨХ» дахин дарж эсвэл синк хийнэ үү${suffix}`, { icon: '⏳' });
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
      '◆ Жишээ төлбөр: «Жишээ: баталгаажуулах» эсвэл «DEV: төлбөрийг баталгаажуулах» товч дарж баталгаажна.',
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
          toast('◆ Попап хориглосон — доорх холбоос дээр дарж төлбөрөө хийнэ үү', { icon: '🔗' });
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
    if (!window.confirm('Захиалгыг цуцлахдаа итгэлтэй байна уу? №' + id)) return;
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
            <div className="section-eyebrow">// МОДУЛЬ_002 — ТҮҮХ</div>
            <h2 className="section-title">МИНИЙ ЗАХИАЛГА</h2>
          </div>
          <span className="section-meta">
            {activeBookings.length > 0 ? `${activeBookings.length} ИДЭВХИТЭЙ` : 'ИДЭВХИТЭЙ АЛГА'} // {historyBookings.length} ТҮҮХЭНД
          </span>
        </div>

        {payCfg.simulatePaymentAllowed && (
          <div className="map-overlay" style={{ position: 'relative', marginBottom: 16, minHeight: 0, padding: '14px 18px', borderColor: 'var(--amber)' }}>
            <div className="map-overlay__title" style={{ fontSize: 11 }}>
              {payCfg.paymentsDemoMode ? 'Жишээ төлбөр — баталгаажуулах' : 'DEV — төлбөрийг дүрсэлж баталгаажуулах'}
            </div>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              {payCfg.paymentsDemoMode ? (
                <>
                  <span className="mono">PAYMENTS_DEMO_MODE=true</span> үед QPay түлхүүргүйгээр «Төлбөр хүлээгдэж байна» + доорх товчоор баталгаажина. Production-д жинхэнэ QPay ашиглах бол{' '}
                  <span className="mono">PAYMENTS_DEMO_MODE=false</span> + <span className="mono">QPAY_*</span>.
                </>
              ) : (
                <>
                  <span className="mono">ALLOW_SIMULATE_PAYMENT=true</span> + production биш үед л идэвхтэй. QPay-гүйгээр «Төлөгдсөн» болгоно.
                </>
              )}
            </div>
          </div>
        )}

        {payCfg.paymentsMode === 'local' && (
          <div className="map-overlay map-overlay--warn" style={{ position: 'relative', marginBottom: 16, minHeight: 0, padding: '14px 18px' }}>
            <div className="map-overlay__title" style={{ fontSize: 11 }}>
              Төлбөр (QPay) идэвхгүй
            </div>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              Backend <span className="mono">.env</span>-д <span className="mono">QPAY_INVOICE_CODE</span> +{' '}
              <span className="mono">QPAY_CLIENT_ID</span>/<span className="mono">SECRET</span> эсвэл{' '}
              <span className="mono">QPAY_USERNAME</span>/<span className="mono">PASSWORD</span> бөглөнө, эсвэл түлхүүргүйгээр турших бол{' '}
              <span className="mono">PAYMENTS_DEMO_MODE=true</span> (Docker-д default идэвхтэй). Тэгэхгүй бол захиалга шууд «баталгаажсан»,
              «Төлбөр төлөх» товч гарахгүй.
            </div>
          </div>
        )}

        {payCfg.paymentsMode === 'demo' && (
          <div className="map-overlay" style={{ position: 'relative', marginBottom: 16, minHeight: 0, padding: '14px 18px', borderColor: 'var(--border)' }}>
            <div className="map-overlay__title" style={{ fontSize: 11 }}>
              Жишээ төлбөрийн горим
            </div>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              QPay API дуудагдахгүй. «Төлбөр төлөх» нь жишээ холбоос нээнэ; баталгаажуулахад доорх «Жишээ: баталгаажуулах» товч ашиглана.
            </div>
          </div>
        )}
        {payCfg.qpayEnabled && payCfg.qpayEbarimtEnabled && (
          <div className="map-overlay" style={{ position: 'relative', marginBottom: 16, minHeight: 0, padding: '14px 18px', borderColor: 'var(--border)' }}>
            <div className="map-overlay__title" style={{ fontSize: 11 }}>
              E-barimt 3.0 (QPay v2)
            </div>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              Төлбөр баталгаажсаны дараа систем автоматаар <span className="mono">/v2/ebarimt/create</span> дуудна. Баримт нь <span className="mono">qpay_ebarimt_json</span> талбарт хадгалагдана.
            </div>
          </div>
        )}
        {payCfg.qpayEnabled && !payCfg.qpayCallbackReady && (
          <div className="map-overlay map-overlay--error" style={{ position: 'relative', marginBottom: 16, minHeight: 0, padding: '14px 18px' }}>
            <div className="map-overlay__title" style={{ fontSize: 11 }}>
              QPay нэхэмжлэл ажиллахгүй байж магадгүй
            </div>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              <span className="mono">QPAY_PUBLIC_BASE_URL</span> заавал (жишээ нь ngrok-оор гарсан HTTPS API суурь). Callback тэнд ирж төлбөр баталгаажна.
            </div>
          </div>
        )}

        {activeBookings.length === 0 && historyBookings.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">
              <Database size={20} />
            </div>
            <h3 style={{ marginBottom: 8 }}>ОДОО ЗАХИАЛГА АЛГА БАЙНА</h3>
            <p className="label" style={{ marginBottom: 24 }}>
              ЭХНИЙ ЗАХИАЛГАА ХИЙЖ ЭНД ХАРУУЛАХ
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
                    <div className="section-eyebrow">// ИДЭВХИТЭЙ</div>
                    <h3 className="section-title" style={{ fontSize: 14 }}>ОДООГИЙН ЗАХИАЛГА</h3>
                  </div>
                </div>
                {activeBookings.map((b) => (
                  <BookingCard key={b.id} b={b} payCfg={payCfg} payDeposit={payDeposit} simulateDeposit={simulateDeposit} cancelBooking={cancelBooking} />
                ))}
              </>
            )}
            {historyBookings.length > 0 && (
              <>
                <div className="section-head" style={{ marginTop: activeBookings.length > 0 ? 32 : 0 }}>
                  <div>
                    <div className="section-eyebrow">// АРХИВ</div>
                    <h3 className="section-title" style={{ fontSize: 14 }}>ТҮҮХ</h3>
                  </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
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
                              ? 'dot alert'
                              : 'dot dead'
                      }
                    />
                    {STATUS_LABELS[b.status] || b.status?.toUpperCase()}
                  </span>
                </div>
                <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'none', marginBottom: 10 }}>
                  ◆ {new Date(b.starts_at).toLocaleString('mn-MN', { hour12: false })} → {new Date(b.ends_at).toLocaleString('mn-MN', { hour12: false })}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {b.items.map((item, i) => (
                    <span key={i} className={`tag ${item.tier === 'VIP' ? 'tag-vip' : 'tag-zaal'}`}>
                      {item.tier === 'Zaal' ? 'ЗААЛ' : item.tier}::{item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="label" style={{ marginBottom: 4 }}>// НИЙТ ҮНЭ</div>
                <div className="display" style={{ fontSize: 24, color: 'var(--red)', marginBottom: 12 }}>
                  ₮{parseFloat(b.total_price).toLocaleString()}
                </div>
                <div className="label" style={{ marginBottom: 4 }}>// 30% БАРЬЦАА</div>
                <div className="mono" style={{ color: 'var(--amber)', fontSize: 12, marginBottom: 12, textTransform: 'none' }}>
                  ₮{parseFloat(b.deposit_amount || 0).toLocaleString()}
                </div>
                {b.status === 'pending_payment' && b.payment_status === 'unpaid' && (
                  <>
                    {(payCfg.paymentsMode === 'qpay' || payCfg.paymentsMode === 'demo') && (
                      <button className="btn btn-primary" onClick={() => payDeposit(b.id)} style={{ padding: '8px 14px', marginBottom: 8, width: '100%' }}>
                        {payCfg.paymentsMode === 'demo' ? 'ТӨЛБӨР ТӨЛӨХ (ЖИШЭЭ)' : 'ТӨЛБӨР ТӨЛӨХ (QPay)'}
                      </button>
                    )}
                    {payCfg.simulatePaymentAllowed && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => simulateDeposit(b.id)}
                        style={{ padding: '8px 14px', marginBottom: 8, width: '100%', borderColor: 'var(--amber)', color: 'var(--amber)' }}
                      >
                        {payCfg.paymentsDemoMode ? 'Жишээ: баталгаажуулах' : 'DEV: төлбөрийг баталгаажуулах'}
                      </button>
                    )}
                  </>
                )}
                {(b.status === 'confirmed' || b.status === 'pending_payment') && (
                  <button className="btn btn-danger" onClick={() => cancelBooking(b.id)} style={{ padding: '8px 14px' }}>
                    <XCircle size={11} /> ЦУЦЛАХ
                  </button>
                )}
              </div>
            </div>
  );
}
