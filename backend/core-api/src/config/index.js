require('dotenv').config();

function parseCommaList(s) {
  if (!s || !String(s).trim()) return [];
  return String(s)
    .split(',')
    .map((x) => x.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Railway/MySQL: some setups expose MYSQL_URL on the plugin; app services usually set DATABASE_URL.
const databaseUrl = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim();
const jwtSecret = process.env.JWT_SECRET;

if (isProd) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or MYSQL_URL must be set when NODE_ENV is production.'
    );
  }
  if (!jwtSecret || String(jwtSecret).trim().length < 32) {
    throw new Error('JWT_SECRET must be set with at least 32 characters when NODE_ENV is production.');
  }
}

const trustProxyEnv = process.env.TRUST_PROXY;
const trustProxy = trustProxyEnv === 'true' || trustProxyEnv === '1';

/** No merchant keys: pending_payment + local invoice link; confirm via simulate (allowed when this is true, including production). */
const paymentsDemoMode =
  process.env.PAYMENTS_DEMO_MODE === 'true' || process.env.PAYMENTS_DEMO_MODE === '1';

/** POST /api/payments/simulate/bookings/:id — also allowed when PAYMENTS_DEMO_MODE is on (any NODE_ENV). */
const allowSimulateEnv =
  process.env.ALLOW_SIMULATE_PAYMENT === 'true' || process.env.ALLOW_SIMULATE_PAYMENT === '1';
const simulatePaymentAllowed = paymentsDemoMode || (allowSimulateEnv && !isProd);

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv,
  trustProxy,
  paymentsDemoMode,
  simulatePaymentAllowed,
  databaseUrl,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  jwt: {
    secret: jwtSecret && String(jwtSecret).trim().length > 0 ? jwtSecret.trim() : 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/+$/, ''),
  /** Extra browser origins for CORS (comma-separated), e.g. Vercel preview URLs */
  corsExtraOrigins: parseCommaList(process.env.CORS_ORIGINS),
  // Prefer AI_*; OPENAI_* / legacy names still work via fallbacks below.
  ai: {
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl:
      process.env.AI_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      'https://api.groq.com/openai/v1',
    model:
      process.env.AI_MODEL ||
      process.env.OPENAI_MODEL ||
      'llama-3.3-70b-versatile',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  },
  qpay: (() => {
    const clientId = (process.env.QPAY_CLIENT_ID || '').trim();
    const clientSecret = (process.env.QPAY_CLIENT_SECRET || '').trim();
    /** QPay portal often labels these “username / password” — same Basic auth as client id/secret. */
    const username = (process.env.QPAY_USERNAME || '').trim();
    const password = (process.env.QPAY_PASSWORD || '').trim();
    const invoiceCode = (process.env.QPAY_INVOICE_CODE || '').trim();
    const authUser = clientId || username;
    const authSecret = clientSecret || password;
    const enabled = Boolean(invoiceCode && authUser && authSecret);
    return {
      enabled,
      baseUrl: (process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn').trim(),
      clientId,
      clientSecret,
      authUser,
      authSecret,
      invoiceCode,
      branchCode: (process.env.QPAY_BRANCH_CODE || 'ONLINE').trim(),
      receiverCode: (process.env.QPAY_RECEIVER_CODE || 'terminal').trim(),
      /** Public HTTPS base of this API (no trailing slash). Used for QPay callback_url. */
      publicBaseUrl: (process.env.QPAY_PUBLIC_BASE_URL || '').trim(),
      /** Optional HMAC secret for callback ?sig= ; defaults to JWT_SECRET. */
      callbackSecret: (process.env.QPAY_CALLBACK_SECRET || '').trim(),
      /** After QPay marks invoice paid, call POST /v2/ebarimt/create (E-barimt 3.0). */
      ebarimtEnabled: process.env.QPAY_EBARIMT_ENABLED === 'true' || process.env.QPAY_EBARIMT_ENABLED === '1',
      /** QPay enum, e.g. CITIZEN | BUSINESS (see merchant docs / Postman). */
      ebarimtReceiverType: (process.env.QPAY_EBARIMT_RECEIVER_TYPE || 'CITIZEN').trim(),
    };
  })(),
};
