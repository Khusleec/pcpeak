const express = require('express');
const crypto = require('crypto');
const passport = require('passport');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const config = require('../config');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, oauthExchangeSchema } = require('../validators/auth.validator');

const router = express.Router();

// ─── Google OAuth ───────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const code = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO oauth_exchange_codes (code, user_id, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
        [code, req.user.id]
      );
      res.redirect(`${config.frontendUrl}/auth/callback?code=${encodeURIComponent(code)}`);
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
    }
  }
);

// ─── Exchange OAuth code for JWT (avoid putting tokens in browser URL/history) ──
router.post('/oauth/exchange', validate(oauthExchangeSchema), async (req, res) => {
  const { code } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT user_id FROM oauth_exchange_codes
       WHERE code = ? AND used = 0 AND expires_at > NOW()
       FOR UPDATE`,
      [code]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Нэвтрэх код хүчингүй эсвэл хугацаа дууссан' });
    }

    const userId = found.rows[0].user_id;
    await client.query('UPDATE oauth_exchange_codes SET used = 1 WHERE code = ?', [code]);
    await client.query('COMMIT');

    const userResult = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.is_active = 1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
    }

    const u = userResult.rows[0];
    const token = generateToken(u);
    res.json({
      token,
      user: {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        role: u.role,
      },
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* noop */
    }
    console.error('OAuth exchange error:', err);
    res.status(500).json({ error: 'Нэвтрэхэд алдаа гарлаа' });
  } finally {
    client.release();
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
      'SELECT id, email, display_name FROM users WHERE id = ?',
      [userId]
    );

    const user = fetched.rows[0];
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
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
      return res.status(401).json({ error: 'Энэ хаяг Google-ээр нэвтэрдэг' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу байна' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, role: user.role },
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
