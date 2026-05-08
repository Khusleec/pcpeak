const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { isFirebaseAdminConfigured, peekFirebaseServiceAccountProjectId } = require('./services/firebaseAdmin');

const authRoutes = require('./routes/auth.routes');
const cafeRoutes = require('./routes/cafe.routes');
const pcRoutes = require('./routes/pc.routes');
const bookingRoutes = require('./routes/booking.routes');
const paymentRoutes = require('./routes/payment.routes');
const agentRoutes = require('./routes/agent.routes');
const tournamentRoutes = require('./routes/tournament.routes');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// ─── Security Middleware ────────────────────────────────────
// SPA on another origin (e.g. Vercel → Railway) needs CORP cross-origin on API responses.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    /** JSON API; COOP on responses is irrelevant here and avoids stacking strict headers alongside Firebase/Google flows. */
    crossOriginOpenerPolicy: false,
  })
);
// Primary: FRONTEND_URL (comma-separated); optional: CORS_ORIGINS; optional: CORS_ALLOW_VERCEL
const allowedOrigins = new Set(
  [
    ...config.frontendOrigins,
    ...config.corsExtraOrigins,

    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',

    'https://pcpeak.vercel.app',
    'https://pcpeak-git-main-khusleecs-projects.vercel.app',
    'https://pcpeak-reto4wmay-khusleecs-projects.vercel.app',
  ].filter(Boolean)
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl, server-to-server
      if (allowedOrigins.has(origin)) return cb(null, true);
      if (
        config.corsAllowVercel &&
        /^https:\/\/[^/]+\.vercel\.app$/i.test(origin)
      ) {
        return cb(null, true);
      }
      // Permit any localhost/127.0.0.1 port (covers browser previews & local tools).
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return cb(null, true);
      }
      console.warn(`[cors] blocked origin: ${origin}`);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '256kb' }));

// Root URL (e.g. Railway public domain with no path) — all real routes live under /api
app.get('/', (_req, res) => {
  res.json({ service: 'core-api', health: '/api/health' });
});

if (config.nodeEnv === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: config.rateLimit.skipSuccessfulRequests,
  skip: (req) =>
    req.path === '/health' ||
    req.originalUrl.endsWith('/health') ||
    req.originalUrl.includes('/payments/qpay/callback') ||
    req.originalUrl.includes('/config/public'),
  validate: config.trustProxy ? { trustProxy: true } : undefined,
});

app.use('/api/', limiter);

// ─── Public client hints (no secrets) ───────────────────────
app.get('/api/config/public', (_req, res) => {
  const q = config.qpay;
  const demo = Boolean(config.paymentsDemoMode);
  res.json({
    qpayEnabled: q.enabled,
    paymentsDemoMode: demo,
    /** Invoice + callback need a reachable HTTPS API base (ngrok / prod). */
    qpayCallbackReady: Boolean((q.publicBaseUrl || '').length > 0),
    paymentsMode: q.enabled ? 'qpay' : demo ? 'demo' : 'local',
    qpayEbarimtEnabled: Boolean(q.enabled && q.ebarimtEnabled),
    simulatePaymentAllowed: Boolean(config.simulatePaymentAllowed),
    /** True when core-api can verify Firebase ID tokens (service account configured). */
    firebaseAuthBackendReady: isFirebaseAdminConfigured(),
    /** Firebase `project_id` from service-account JSON — compare to REACT_APP_FIREBASE_PROJECT_ID. */
    firebaseAdminProjectId: peekFirebaseServiceAccountProjectId(),
  });
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/cafes', cafeRoutes);
app.use('/api/pcs', pcRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/agent', agentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, _next) => {
  if (err && String(err.message || '').startsWith('CORS')) {
    return res.status(403).json({ error: 'Forbidden', detail: 'CORS policy' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  const pool = require('./db/pool');
  app.listen(config.port, async () => {
    console.log(`Mongol PC API on port ${config.port} (${config.nodeEnv})`);
    try {
      await pool.query('SELECT 1');
      console.log('MySQL: ok');
    } catch (e) {
      console.error('MySQL: connection check failed:', e.message);
    }
  });
}

module.exports = app;
