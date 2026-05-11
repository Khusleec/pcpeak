const crypto = require('crypto');
const config = require('../config');
const pool = require('../db/pool');
const qpayApi = require('./qpay.api');

const DEPOSIT_RATE = 0.3;

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function callbackSignature(bookingId) {
  const secret = config.qpay.callbackSecret || config.jwt.secret;
  return crypto.createHmac('sha256', String(secret)).update(String(bookingId)).digest('hex');
}

function buildCallbackUrl(bookingId) {
  const base = (config.qpay.publicBaseUrl || '').replace(/\/$/, '');
  if (!base) return null;
  const sig = callbackSignature(bookingId);
  return `${base}/api/payments/qpay/callback?booking_id=${encodeURIComponent(bookingId)}&sig=${encodeURIComponent(sig)}`;
}

function buildInvoicePayload({ bookingId, amount, description, callbackUrl }) {
  const q = config.qpay;
  return {
    invoice_code: q.invoiceCode,
    sender_invoice_no: String(bookingId).slice(0, 40),
    invoice_receiver_code: q.receiverCode,
    sender_branch_code: q.branchCode,
    invoice_description: description,
    amount: Math.round(Number(amount)),
    callback_url: callbackUrl,
  };
}

async function issueDepositInvoice(bookingId, userId) {
  const q = config.qpay;
  if (!q.enabled) return null;

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
    const urls = saved && Array.isArray(saved.urls) ? saved.urls : [];
    const qr_text = saved && saved.qr_text ? String(saved.qr_text) : '';
    if (urls.length > 0 || qr_text) {
      const rawFromSaved = saved && saved.raw && typeof saved.raw === 'object' ? saved.raw : null;
      return {
        invoice_id: b.qpay_invoice_id,
        qr_text,
        urls,
        raw: rawFromSaved || saved || {},
      };
    }
    const err = new Error('INVOICE_PENDING_NO_CHECKOUT');
    err.code = 'INVOICE_PENDING_NO_CHECKOUT';
    throw err;
  }

  const deposit = roundMoney(parseFloat(b.total_price) * DEPOSIT_RATE);
  const callbackUrl = buildCallbackUrl(bookingId);
  if (!callbackUrl) {
    const err = new Error('QPAY_PUBLIC_BASE_URL is required to create invoices');
    err.code = 'QPAY_CALLBACK_CONFIG';
    throw err;
  }

  const description = `PcPeak — 30% барьцаа (${b.cafe_name || 'cafe'})`.slice(0, 500);
  const payload = buildInvoicePayload({
    bookingId,
    amount: deposit,
    description,
    callbackUrl,
  });

  const created = await qpayApi.createInvoice(payload);
  const checkout = qpayApi.normalizeCheckout(created);
  if (!checkout.invoice_id) {
    const err = new Error('QPAY_MISSING_INVOICE_ID');
    err.data = created;
    throw err;
  }

  await pool.query(
    'UPDATE bookings SET qpay_invoice_id = ?, qpay_checkout_json = ? WHERE id = ?',
    [
      checkout.invoice_id,
      JSON.stringify({
        urls: checkout.urls,
        qr_text: checkout.qr_text,
        raw: checkout.raw,
      }),
      bookingId,
    ]
  );

  return checkout;
}

function paymentsFromCheck(check) {
  if (Array.isArray(check)) return check;
  if (Array.isArray(check.rows)) return check.rows;
  if (Array.isArray(check.payments)) return check.payments;
  if (Array.isArray(check.payment_list)) return check.payment_list;
  if (check.payment && typeof check.payment === 'object') return [check.payment];
  return [];
}

async function markPaidIfCheckSucceeds(invoiceId) {
  const check = await qpayApi.checkPayment({
    object_type: 'INVOICE',
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  });

  const list = paymentsFromCheck(check);
  const first = list[0] || {};
  const paymentId =
    first.payment_id ||
    first.paymentId ||
    first.id ||
    check.payment_id ||
    check.paymentId ||
    null;
  const paid =
    list.length > 0 ||
    String(check.payment_status || '').toUpperCase() === 'PAID' ||
    check.paid === true;

  if (!paid) return { paid: false, check };

  const upd = await pool.query(
    `UPDATE bookings SET status = 'confirmed', payment_status = 'paid',
         qpay_payment_id = COALESCE(?, qpay_payment_id)
     WHERE qpay_invoice_id = ? AND payment_status = 'unpaid'`,
    [paymentId, invoiceId]
  );

  if (upd.rowCount > 0 && config.qpay.ebarimtEnabled && paymentId) {
    try {
      const eb = await qpayApi.createEbarimt({
        payment_id: String(paymentId),
        ebarimt_receiver_type: config.qpay.ebarimtReceiverType || 'CITIZEN',
      });
      const r = await pool.query(
        `SELECT id FROM bookings WHERE qpay_invoice_id = ? AND payment_status = 'paid' LIMIT 1`,
        [invoiceId]
      );
      const bid = r.rows[0]?.id;
      if (bid) {
        await pool.query('UPDATE bookings SET qpay_ebarimt_json = ? WHERE id = ?', [JSON.stringify(eb), bid]);
      }
    } catch (ebErr) {
      console.error('QPay ebarimt/create:', ebErr.message, ebErr.data || '');
    }
  }

  return { paid: upd.rowCount > 0, check };
}

module.exports = {
  issueDepositInvoice,
  markPaidIfCheckSucceeds,
  callbackSignature,
  buildCallbackUrl,
  DEPOSIT_RATE,
  roundMoney,
};
