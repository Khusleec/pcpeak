require('dotenv').config();

function parseCommaList(s) {
  if (!s || !String(s).trim()) return [];
  return String(s)
    .split(',')
    .map((x) => x.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** Used to auto-allow *.vercel.app CORS when you already list a production Vercel URL in FRONTEND_URL */
function originHostnameEndsWithVercelApp(url) {
  if (!url) return false;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const host = new URL(normalized).hostname.toLowerCase();
    return host === 'vercel.app' || host.endsWith('.vercel.app');
  } catch {
    return /\.vercel\.app$/i.test(String(url));
  }
}

const frontendOriginsList = parseCommaList(process.env.FRONTEND_URL || 'http://localhost:3000');
const corsExtraOriginsList = parseCommaList(process.env.CORS_ORIGINS);

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
  jwt: {
    secret: jwtSecret && String(jwtSecret).trim().length > 0 ? jwtSecret.trim() : 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  /** First FRONTEND_URL entry (payment return / email-style links) */
  frontendUrl: frontendOriginsList[0] || 'http://localhost:3000',
  /** All FRONTEND_URL values (comma-separated) are allowed CORS origins */
  frontendOrigins: frontendOriginsList,
  /** Extra browser origins for CORS (comma-separated), e.g. Vercel preview URLs */
  corsExtraOrigins: corsExtraOriginsList,
  /**
   * Allow https://*.vercel.app (previews like *-git-*-*.vercel.app plus production *.vercel.app).
   * true if CORS_ALLOW_VERCEL=true, or inferred when FRONTEND_URL/CORS_ORIGINS already includes any *.vercel.app host.
   * Set CORS_ALLOW_VERCEL=false to disable even when FRONTEND_URL is on vercel.app.
   */
  corsAllowVercel: (() => {
    if (process.env.CORS_ALLOW_VERCEL === 'false' || process.env.CORS_ALLOW_VERCEL === '0') {
      return false;
    }
    if (process.env.CORS_ALLOW_VERCEL === 'true' || process.env.CORS_ALLOW_VERCEL === '1') {
      return true;
    }
    return [...frontendOriginsList, ...corsExtraOriginsList].some(originHostnameEndsWithVercelApp);
  })(),
  // Prefer AI_*; OPENAI_* still work as fallbacks.
  ai: (() => {
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
    let baseUrl = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'llama3-70b-8192';

    // Strip /chat/completions suffix if present (SDK adds it)
    baseUrl = baseUrl.replace(/\/chat\/completions\/?$/, '');
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    return { apiKey, baseUrl, model };
  })(),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  },
  qpay: {
    enabled: true,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },
};
