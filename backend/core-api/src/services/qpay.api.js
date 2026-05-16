/**
 * QPay Merchant API v2 — token, invoice, payment/check, optional E-barimt 3.0.
 * @see https://merchant.qpay.mn/v2/  (sandbox: https://merchant-sandbox.qpay.mn/v2/)
 */

let cachedAccessToken = null;
let cachedAccessExpiresAt = 0;

function getConfig() {
  const c = require('../config').qpay;
  if (!c.enabled) {
    const err = new Error('QPay is not configured');
    err.code = 'QPAY_DISABLED';
    throw err;
  }
  return c;
}

async function fetchToken() {
  const { baseUrl, authUser, authSecret } = getConfig();
  const basic = Buffer.from(`${authUser}:${authSecret}`, 'utf8').toString('base64');
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`QPay token failed: HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  const token = data.access_token;
  if (!token) {
    const err = new Error('QPay token response missing access_token');
    err.data = data;
    throw err;
  }
  const ttlSec = Number(data.expires_in) || 3600;
  cachedAccessToken = token;
  cachedAccessExpiresAt = Date.now() + Math.max(60, ttlSec - 120) * 1000;
  return token;
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessExpiresAt) {
    return cachedAccessToken;
  }
  return fetchToken();
}

async function createInvoice(body) {
  const token = await getAccessToken();
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`QPay invoice failed: HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function checkPayment(body) {
  const token = await getAccessToken();
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/payment/check`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`QPay payment/check failed: HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function invoiceIdFromCreateResponse(data) {
  const inv = data.invoice && typeof data.invoice === 'object' ? data.invoice : null;
  return (
    data.invoice_id ||
    data.invoiceId ||
    data.id ||
    (inv && (inv.invoice_id || inv.id || inv.invoiceId)) ||
    null
  );
}

function pushPayUrl(urls, name, link) {
  if (typeof link !== 'string' || !link.trim()) return;
  const l = link.trim();
  if (!/^https?:\/\//i.test(l) && !/^[\w.-]+:\/\//.test(l)) return;
  if (!urls.some((u) => u.link === l)) urls.push({ name: name || 'Pay', link: l });
}

function collectUrlsFromArray(urls, arr) {
  if (!Array.isArray(arr)) return;
  for (const u of arr) {
    if (u && (u.link || u.url)) pushPayUrl(urls, u.name || u.description, u.link || u.url);
  }
}

function normalizeCheckout(data) {
  const invoice_id = invoiceIdFromCreateResponse(data);
  const inv = data.invoice && typeof data.invoice === 'object' ? data.invoice : null;
  const qr_text =
    data.qr_text ||
    data.qrText ||
    data.qPay_QRcode ||
    data.qpay_qrcode ||
    (inv && (inv.qr_text || inv.qrText || inv.qPay_QRcode)) ||
    '';
  const qr_image = data.qr_image || data.qPay_QRimage || (inv && (inv.qr_image || inv.qPay_QRimage)) || '';
  const urls = [];
  collectUrlsFromArray(urls, data.urls);
  if (inv) collectUrlsFromArray(urls, inv.urls);

  const short =
    data.qPay_short_url ||
    data.qPayShortUrl ||
    data.qpay_short_url ||
    data.short_url ||
    data.payment_url ||
    data.payUrl ||
    (inv &&
      (inv.qPay_short_url ||
        inv.qPayShortUrl ||
        inv.qpay_short_url ||
        inv.short_url ||
        inv.payment_url));
  pushPayUrl(urls, 'QPay', short);

  if (typeof data.url === 'string' && data.url.trim()) {
    pushPayUrl(urls, 'Pay', data.url.trim());
  }
  if (inv && typeof inv.url === 'string' && inv.url.trim()) {
    pushPayUrl(urls, 'Pay', inv.url.trim());
  }

  return { invoice_id, qr_text, urls, raw: data };
}

module.exports = {
  getAccessToken,
  createInvoice,
  checkPayment,
  invoiceIdFromCreateResponse,
  normalizeCheckout,
};
