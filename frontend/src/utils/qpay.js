/** First usable payment URL from QPay checkout payload (normalized + raw). */
export function pickQpayLink(qpay) {
  if (!qpay || typeof qpay !== 'object') return null;
  const tryList = (arr) => {
    if (!Array.isArray(arr)) return null;
    const row = arr.find((u) => u && (u.link || u.url));
    const link = row && (row.link || row.url);
    return typeof link === 'string' && link.trim() ? link.trim() : null;
  };
  const fromNorm = tryList(qpay.urls);
  if (fromNorm) return fromNorm;
  const raw = qpay.raw && typeof qpay.raw === 'object' ? qpay.raw : null;
  if (!raw) return null;
  const short =
    raw.qPay_short_url ||
    raw.qPayShortUrl ||
    raw.qpay_short_url ||
    raw.short_url ||
    raw.payment_url;
  if (typeof short === 'string' && short.trim()) return short.trim();
  return tryList(raw.urls) || (typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : null);
}
