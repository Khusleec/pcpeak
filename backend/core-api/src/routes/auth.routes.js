const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db/pool');
const config = require('../config');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

const router = express.Router();
const client = new OAuth2Client(config.google.clientId, config.google.clientSecret, config.google.redirectUri);

// ─── Google OAuth ───────────────────────────────────────────

/**
 * Step 1: Redirect to Google
 */
router.get('/google', (req, res) => {
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

/**
 * Step 2: Google Callback
 */
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${config.frontendUrl}/login?error=no_code`);

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let userResult = await pool.query('SELECT id FROM users WHERE google_id = ? OR email = ?', [googleId, email]);
    let userId;

    if (userResult.rows.length === 0) {
      userId = uuidv4();
      await pool.query(
        `INSERT INTO users (id, google_id, email, display_name, avatar_url, role_id)
         VALUES (?, ?, ?, ?, ?, 3)`,
        [userId, googleId, email, name, picture]
      );
    } else {
      userId = userResult.rows[0].id;
      // Update google_id if it was a local user before
      await pool.query(
        `UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?`,
        [googleId, picture, userId]
      );
    }

    // Generate one-time exchange code
    const exchangeCode = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await pool.query(
      `INSERT INTO oauth_exchange_codes (code, user_id, expires_at) VALUES (?, ?, ?)`,
      [exchangeCode, userId, expiresAt]
    );

    res.redirect(`${config.frontendUrl}/auth/callback?code=${exchangeCode}`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
});

/**
 * Step 3: Exchange code for JWT
 */
router.post('/exchange', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  try {
    const result = await pool.query(
      `SELECT e.user_id, u.email, u.display_name, u.avatar_url, r.name AS role
       FROM oauth_exchange_codes e
       JOIN users u ON e.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE e.code = ? AND e.used = 0 AND e.expires_at > NOW()`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired exchange code' });
    }

    const user = result.rows[0];
    const userId = user.user_id;

    // Mark code as used
    await pool.query('UPDATE oauth_exchange_codes SET used = 1 WHERE code = ?', [code]);

    const token = generateToken({ id: userId, email: user.email });

    res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// ─── Local Register ─────────────────────────────────────────
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, display_name } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Энэ имэйл бүртгэлтэй байна' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await pool.query(
      `INSERT INTO users (id, email, password_hash, display_name, role_id)
       VALUES (?, ?, ?, ?, 3)`,
      [userId, email, password_hash, display_name]
    );

    const fetched = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );

    const user = fetched.rows[0];
    const token = generateToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Register error:', err.code, err.sqlMessage || err.message);
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(503).json({
        error: 'Серверийн өгөгдлийн сангийн тохиргоо дутуу байна (roles/seed). Админд хандана уу.',
      });
    }
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Өгөгдлийн сангийн schema суулгаагүй байна. Deploy дээр db init ажиллуулна уу.',
      });
    }
    res.status(500).json({ error: 'Бүртгэл амжилтгүй боллоо' });
  }
});

// ─── Local Login ────────────────────────────────────────────
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.password_hash, u.avatar_url, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.email = ? AND u.is_active = 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу байна' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'Энэ имэйлд систем дээр нууц үг тохируулаагүй байна. Дахин бүртгэл эсвэл админ руу хандаарай.',
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу байна' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Нэвтрэх амжилтгүй боллоо' });
  }
});

// ─── Get Current User ───────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Хэрэглэгчийн мэдээлэл татаж чадсангүй' });
  }
});

module.exports = router;
