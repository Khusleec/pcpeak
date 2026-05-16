const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const pool = require('../db/pool');
const { authenticateToken, userIsAdmin } = require('../middleware/auth');
const qpayBooking = require('../services/qpay.booking');
const { notifyCafeInventoryChanged } = require('../services/cafeInventoryBus');

function signaturesMatch(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const router = express.Router();

function redirectFrontend(res, query = {}) {
  const base = (config.frontendUrl || '').replace(/\/$/, '');
  const q = new URLSearchParams(query);
  res.redirect(302, `${base}/bookings?${q.toString()}`);
}

async function handleQpayCallback(req, res) {
  const bookingId = String(req.query.booking_id || req.body?.booking_id || '').trim();
  const sig = String(req.query.sig || req.body?.sig || '').trim();
  if (!bookingId || !sig) {
    return res.status(400).json({ error: 'booking_id and sig required' });
  }
  const expected = qpayBooking.callbackSignature(bookingId);
  if (!signaturesMatch(sig, expected)) {
    return res.status(403).json({ error: 'invalid signature' });
  }

  const rows = await pool.query(
    'SELECT id, qpay_invoice_id, payment_status FROM bookings WHERE id = ?',
    [bookingId]
  );
  if (rows.rows.length === 0) {
    return res.status(404).json({ error: 'booking not found' });
  }
  const b = rows.rows[0];
  if (!b.qpay_invoice_id) {
    return res.status(400).json({ error: 'no invoice for booking' });
  }

  if (!config.qpay.enabled && !config.paymentsDemoMode) {
    return res.status(503).json({ error: 'QPay disabled' });
  }

  try {
    const { paid } = await qpayBooking.markPaidIfCheckSucceeds(b.qpay_invoice_id);
    if (paid) {
      const c = await pool.query('SELECT cafe_id FROM bookings WHERE id = ?', [bookingId]);
      if (c.rows[0]?.cafe_id != null) notifyCafeInventoryChanged(c.rows[0].cafe_id, 'payment_confirmed');
    }
    if (req.method === 'GET') {
      return redirectFrontend(res, { payment: paid ? 'ok' : 'pending', booking_id: bookingId });
    }
    return res.json({ ok: true, paid });
  } catch (err) {
    console.error('QPay callback:', err.message, err.data || '');
    if (req.method === 'GET') {
      return redirectFrontend(res, { payment: 'error', booking_id: bookingId });
    }
    return res.status(502).json({ error: 'QPay check failed' });
  }
}

router.get('/qpay/callback', handleQpayCallback);
router.post(
  '/qpay/callback',
  express.json({ limit: '128kb' }),
  express.urlencoded({ extended: true, limit: '128kb' }),
  handleQpayCallback
);

router.post('/qpay/bookings/:bookingId/invoice', authenticateToken, async (req, res) => {
  if (!config.qpay.enabled && !config.paymentsDemoMode) {
    return res.status(503).json({ error: 'QPay тохируулаагүй байна' });
  }
  try {
    const bookingId = req.params.bookingId;
    const rows = await pool.query(`SELECT user_id FROM bookings WHERE id = ?`, [bookingId]);
    const ownerId = rows.rows[0]?.user_id;
    if (!ownerId) {
      return res.status(404).json({ error: 'Захиалга олдсонгүй' });
    }
    const admin = await userIsAdmin(req.user.id);
    if (!admin && ownerId !== req.user.id) {
      return res.status(404).json({ error: 'Захиалга олдсонгүй' });
    }
    const checkout = await qpayBooking.issueDepositInvoice(bookingId, ownerId);
    return res.json({ qpay: checkout });
  } catch (err) {
    if (err.code === 'BOOKING_NOT_FOUND') {
      return res.status(404).json({ error: 'Захиалга олдсонгүй' });
    }
    if (err.code === 'BOOKING_NOT_PAYABLE') {
      return res.status(400).json({ error: 'Энэ захиалгад нэхэмжлэл үүсгэх боломжгүй' });
    }
    if (err.code === 'QPAY_CALLBACK_CONFIG') {
      return res.status(500).json({ error: 'QPAY_PUBLIC_BASE_URL тохируулна уу' });
    }
    console.error('QPay invoice:', err.message, err.data || err.status || '');
    return res.status(502).json({ error: 'QPay холболт амжилтгүй' });
  }
});

/** Local/dev: mark booking deposit paid without calling QPay (never in production). */
router.post('/simulate/bookings/:bookingId', authenticateToken, async (req, res) => {
  if (!config.simulatePaymentAllowed) {
    return res.status(404).json({ error: 'Not found' });
  }
  const bookingId = req.params.bookingId;
  const rows = await pool.query(
    `SELECT id, user_id, cafe_id, status, payment_status FROM bookings WHERE id = ?`,
    [bookingId]
  );
  const b = rows.rows[0];
  const admin = await userIsAdmin(req.user.id);
  if (!b || (!admin && b.user_id !== req.user.id)) {
    return res.status(404).json({ error: 'Захиалга олдсонгүй' });
  }
  if (b.status !== 'pending_payment' || b.payment_status !== 'unpaid') {
    return res.status(400).json({ error: 'Зөвхөн төлбөр хүлээгдэж буй, төлөөгүй захиалга' });
  }
  await pool.query(
    `UPDATE bookings SET status = 'confirmed', payment_status = 'paid' WHERE id = ? AND user_id = ?`,
    [bookingId, b.user_id]
  );
  if (b.cafe_id != null) notifyCafeInventoryChanged(b.cafe_id, 'payment_simulated');
  return res.json({ ok: true, simulated: true });
});

router.post('/qpay/bookings/:bookingId/sync', authenticateToken, async (req, res) => {
  if (!config.qpay.enabled && !config.paymentsDemoMode) {
    return res.status(503).json({ error: 'QPay тохируулаагүй байна' });
  }
  const rows = await pool.query(
    'SELECT id, user_id, cafe_id, qpay_invoice_id, payment_status, status FROM bookings WHERE id = ?',
    [req.params.bookingId]
  );
  const admin = await userIsAdmin(req.user.id);
  if (rows.rows.length === 0 || (!admin && rows.rows[0].user_id !== req.user.id)) {
    return res.status(404).json({ error: 'Захиалга олдсонгүй' });
  }
  const b = rows.rows[0];
  if (!b.qpay_invoice_id || b.payment_status !== 'unpaid') {
    return res.json({ paid: b.payment_status === 'paid', status: b.status });
  }
  try {
    const { paid } = await qpayBooking.markPaidIfCheckSucceeds(b.qpay_invoice_id);
    if (paid && b.cafe_id != null) notifyCafeInventoryChanged(b.cafe_id, 'payment_sync');
    const again = await pool.query('SELECT status, payment_status FROM bookings WHERE id = ?', [b.id]);
    const row = again.rows[0] || b;
    return res.json({ paid, status: row.status, payment_status: row.payment_status });
  } catch (err) {
    console.error('QPay sync:', err.message);
    return res.status(502).json({ error: 'QPay шалгахад алдаа' });
  }
});

module.exports = router;
