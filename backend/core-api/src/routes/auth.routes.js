const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

const router = express.Router();

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
