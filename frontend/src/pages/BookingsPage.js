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
          paymentsMode: data?.paymentsMode === 'qpay' ? 'qpay' : 'local',
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
    if (p === 'ok') toast.success(`◆ ТӨЛБӨР БАТАЛГААЖЛАА${suffix}`);
    else if (p === 'pending') toast(`◆ Төлбөр шалгагдаж байна${suffix}`, { icon: '⏳' });
    else if (p === 'error') toast.error(`⚠ Төлбөрийн шалгалт амжилтгүй${suffix}`);
    setSearchParams({}, { replace: true });
    fetchBookings();
  }, [searchParams, setSearchParams]);

  const payDeposit = async (id) => {
    try {
      const { data } = await api.post(`/payments/qpay/bookings/${id}/invoice`);
      const payLink = pickQpayLink(data?.qpay);
      if (payLink) window.open(payLink, '_blank', 'noopener,noreferrer');
      else if (data?.qpay?.qr_text) {
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
      toast.success('◆ DEV: төлбөр баталгаажлаа (QPay биш)');
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
            {bookings.length > 0 ? `${bookings.length} ЗАХИАЛГА` : 'ЗАХИАЛГА АЛГА'} // ШИНЭЭС ХУУЧИН
          </span>
        </div>

        {payCfg.simulatePaymentAllowed && (
          <div className="map-overlay" style={{ position: 'relative', marginBottom: 16, minHeight: 0, padding: '14px 18px', borderColor: 'var(--amber)' }}>
            <div className="map-overlay__title" style={{ fontSize: 11 }}>
              DEV — төлбөрийг дүрсэлж баталгаажуулах
            </div>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              <span className="mono">ALLOW_SIMULATE_PAYMENT=true</span> + production биш үед л идэвхтэй. QPay-гүйгээр «Төлөгдсөн» болгоно.
            </div>
          </div>
        )}

        {!payCfg.qpayEnabled && (
          <div className="map-overlay map-overlay--warn" style={{ position: 'relative', marginBottom: 16, minHeight: 0, padding: '14px 18px' }}>
            <div className="map-overlay__title" style={{ fontSize: 11 }}>
              Төлбөр (QPay) идэвхгүй
            </div>
            <div className="map-overlay__msg" style={{ fontSize: 10 }}>
              Backend <span className="mono">.env</span>-д <span className="mono">QPAY_INVOICE_CODE</span> +{' '}
              <span className="mono">QPAY_CLIENT_ID</span>/<span className="mono">SECRET</span> эсвэл{' '}
              <span className="mono">QPAY_USERNAME</span>/<span className="mono">PASSWORD</span> бөглөнө. Тэгэхгүй бол захиалга шууд «баталгаажсан»,
              «Төлбөр төлөх» товч гарахгүй.
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

        {bookings.length === 0 ? (
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
          bookings.map((b) => (
            <div key={b.id} className="booking-card">
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
                  ◆ {new Date(b.starts_at).toLocaleString('mn-MN')} → {new Date(b.ends_at).toLocaleString('mn-MN')}
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
                    {payCfg.qpayEnabled && (
                      <button className="btn btn-primary" onClick={() => payDeposit(b.id)} style={{ padding: '8px 14px', marginBottom: 8, width: '100%' }}>
                        ТӨЛБӨР ТӨЛӨХ (QPay)
                      </button>
                    )}
                    {payCfg.simulatePaymentAllowed && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => simulateDeposit(b.id)}
                        style={{ padding: '8px 14px', marginBottom: 8, width: '100%', borderColor: 'var(--amber)', color: 'var(--amber)' }}
                      >
                        DEV: төлбөрийг баталгаажуулах
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
          ))
        )}
      </div>
    </div>
  );
}
