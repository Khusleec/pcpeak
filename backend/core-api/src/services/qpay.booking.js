const crypto = require('crypto');
const config = require('../config');
const pool = require('../db/pool');

const DEPOSIT_RATE = 0.3;

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function callbackSignature(bookingId) {
  const secret = config.jwt.secret;
  return crypto.createHmac('sha256', String(secret)).update(String(bookingId)).digest('hex');
}

function buildCallbackUrl(bookingId) {
  const base = (config.frontendUrl || '').replace(/\/$/, '');
  if (!base) return null;
  const sig = callbackSignature(bookingId);
  return `${base}/api/payments/qpay/callback?booking_id=${encodeURIComponent(bookingId)}&sig=${encodeURIComponent(sig)}`;
}

async function issueDepositInvoice(bookingId, userId) {
  const rows = await pool.query(
    `SELECT b.id, b.user_id, b.total_price, b.status, b.payment_status, b.qpay_invoice_id, b.qpay_checkout_json, c.name AS cafe_name
     FROM bookings b JOIN cafes c ON c.id = b.cafe_id
     WHERE b.id = ? AND b.user_id = ?`,
    [bookingId, userId]
  );
  if (rows.rows.length === 0) {
    const err = new Error('BOOKING_NOT_FOUND');
    err.code = 'BOOKING_NOT_FOUND';
    throw err;
  }
  const b = rows.rows[0];
  if (b.status !== 'pending_payment' || b.payment_status !== 'unpaid') {
    const err = new Error('BOOKING_NOT_PAYABLE');
    err.code = 'BOOKING_NOT_PAYABLE';
    throw err;
  }

  if (b.qpay_invoice_id) {
    let saved = b.qpay_checkout_json;
    if (typeof saved === 'string') {
      try {
        saved = JSON.parse(saved);
      } catch {
        saved = null;
      }
    }
    const qr_text = saved && saved.qr_text ? String(saved.qr_text) : '';
    if (qr_text) {
      return {
        invoice_id: b.qpay_invoice_id,
        qr_text,
        urls: [],
        raw: saved || {},
      };
    }
  }

  const deposit = roundMoney(parseFloat(b.total_price) * DEPOSIT_RATE);
  
  // Local QR Generation
  const invoiceId = `LOCAL_INV_${bookingId}`;
  const qrText = `00020101021229300012merchant.app01101234567890520458125303496540${String(deposit).length}${deposit}5802MN5904MGL509Mongolia63041234`;

  await pool.query(
    'UPDATE bookings SET qpay_invoice_id = ?, qpay_checkout_json = ? WHERE id = ?',
    [
      invoiceId,
      JSON.stringify({
        urls: [],
        qr_text: qrText,
        raw: { generated_locally: true },
      }),
      bookingId,
    ]
  );

  return {
    invoice_id: invoiceId,
    qr_text: qrText,
    urls: [],
    raw: { generated_locally: true }
  };
}

async function markPaidIfCheckSucceeds(invoiceId) {
  // Local mock doesn't hit an external API, assume it's not paid automatically 
  // unless they use the DEV simulate endpoint.
  return { paid: false, check: null };
}

module.exports = {
  issueDepositInvoice,
  markPaidIfCheckSucceeds,
  callbackSignature,
  buildCallbackUrl,
  DEPOSIT_RATE,
  roundMoney,
};
