const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
require('./config/passport');

const authRoutes = require('./routes/auth.routes');
const cafeRoutes = require('./routes/cafe.routes');
const pcRoutes = require('./routes/pc.routes');
const bookingRoutes = require('./routes/booking.routes');
const paymentRoutes = require('./routes/payment.routes');
const agentRoutes = require('./routes/agent.routes');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// ─── Security Middleware ────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10kb' }));

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
  res.json({
    qpayEnabled: q.enabled,
    /** Invoice + callback need a reachable HTTPS API base (ngrok / prod). */
    qpayCallbackReady: Boolean((q.publicBaseUrl || '').length > 0),
    paymentsMode: q.enabled ? 'qpay' : 'local',
    qpayEbarimtEnabled: Boolean(q.enabled && q.ebarimtEnabled),
    simulatePaymentAllowed: Boolean(config.simulatePaymentAllowed),
  });
});

// ─── Passport ───────────────────────────────────────────────
const passport = require('passport');
app.use(passport.initialize());

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/cafes', cafeRoutes);
app.use('/api/pcs', pcRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/agent', agentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Mongol PC API on port ${config.port} (${config.nodeEnv})`);
  });
}

module.exports = app;
