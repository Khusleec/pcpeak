const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, firebaseIdTokenSchema } = require('../validators/auth.validator');
const { verifyFirebaseIdToken, isFirebaseAdminConfigured, peekFirebaseServiceAccountProjectId } =
  require('../services/firebaseAdmin');

const router = express.Router();

/** JWT баталгаагүй decode — зөвхөн debug (401 үед `aud` харах). */
function decodeIdTokenAudienceUnsafe(idToken) {
  try {
    const seg = String(idToken || '').split('.')[1];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
    const aud = payload && payload.aud;
    return aud != null ? String(aud).trim() : null;
  } catch {
    return null;
  }
}

/** Энэ төсөл POST body `idToken`-оор токен авдаг (ихэнхдээ Authorization биш). Bearer байвал үлээж өгнө — Postman/quick test-д хэрэгтэй. */
function attachFirebaseIdTokenFromBearer(req, _res, next) {
  const body = req.body;
  if (body && (!body.idToken || typeof body.idToken !== 'string')) {
    const authz = req.headers.authorization;
    if (authz && typeof authz === 'string') {
      const m = /^Bearer\s+(\S+)/i.exec(authz.trim());
      if (m) body.idToken = m[1];
    }
  }
  next();
}

// ─── Firebase Auth (Google via client SDK → ID token → JWT) ──
router.post('/firebase', attachFirebaseIdTokenFromBearer, validate(firebaseIdTokenSchema), async (req, res) => {
  if (!isFirebaseAdminConfigured()) {
    return res.status(503).json({
      error: 'Firebase серверийн тохиргоо дутуу. FIREBASE_SERVICE_ACCOUNT_PATH эсвэл GOOGLE_APPLICATION_CREDENTIALS тохируулна уу.',
    });
  }

  let decoded;
  try {
    const raw = req.body.idToken;
    console.log('[auth/firebase] inbound:', {
      idTokenLength: typeof raw === 'string' ? raw.length : 0,
      jwtSections: typeof raw === 'string' ? raw.split('.').length : 0,
      authorizationHeader: req.headers.authorization ? 'set' : 'missing',
      hint: 'Frontend илгээгдэл: JSON body { idToken } (ЭСВЭЛ Authorization: Bearer …)',
    });
    decoded = await verifyFirebaseIdToken(req.body.idToken);
  } catch (err) {
    const code = err?.code || '';
    const detail = String(err?.message || '');
    console.error('[auth/firebase] verifyIdToken failed:', code || '(no code)', detail);
    console.error(err);
    let userMsg = 'Firebase токен хүчингүй эсвэл хугацаа дууссан';
    if (code === 'auth/id-token-expired') {
      userMsg = 'Токены хугацаа дууссан — дахин Google-аар оролдоно уу.';
    } else if (
      code === 'auth/invalid-id-token' ||
      code === 'auth/argument-error' ||
      /audience|issuer|project|incorrect|match/i.test(detail)
    ) {
      userMsg =
        'Вэбийн Firebase (REACT_APP_FIREBASE_PROJECT_ID) ба серверийн service account JSON нэг ижил Firebase төсөлд байх ёстой. Vercel болон Railway утгуудыг шалгана уу.';
    }

    const idTokenAudience = decodeIdTokenAudienceUnsafe(req.body?.idToken);
    const serviceAccountProjectId = peekFirebaseServiceAccountProjectId();
    const firebaseProjectsAligned =
      Boolean(idTokenAudience && serviceAccountProjectId) && idTokenAudience === serviceAccountProjectId;

    const debug = {
      idTokenAudience: idTokenAudience || undefined,
      serviceAccountProjectId: serviceAccountProjectId || undefined,
      firebaseProjectsAligned: idTokenAudience && serviceAccountProjectId ? firebaseProjectsAligned : undefined,
    };

    console.error('[auth/firebase] verify debug:', { ...debug, firebaseCode: code || null });

    return res.status(401).json({
      error: userMsg,
      firebaseCode: code || undefined,
      ...debug,
    });
  }

  if (!decoded.email) {
    return res.status(400).json({ error: 'Имэйл Firebase токенд байхгүй байна' });
  }
  if (decoded.email_verified === false) {
    return res.status(400).json({ error: 'Баталгаажсан имэйл шаардлагатай' });
  }

  const email = String(decoded.email).toLowerCase().trim();
  const uid = decoded.uid;
  const displayName = (decoded.name && String(decoded.name).trim()) || email.split('@')[0];
  const picture = decoded.picture ? String(decoded.picture).trim() : null;

  try {
    let found = await pool.query('SELECT * FROM users WHERE firebase_uid = ?', [uid]);
    if (found.rows.length === 0) {
      found = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    }

    if (found.rows.length > 0) {
      const u = found.rows[0];
      if (u.firebase_uid && String(u.firebase_uid) !== String(uid)) {
        return res.status(409).json({ error: 'Энэ имэйл өөр Firebase бүртгэлтэй байна' });
      }
      await pool.query(
        `UPDATE users SET firebase_uid = ?, display_name = ?, avatar_url = COALESCE(?, avatar_url)
         WHERE id = ?`,
        [uid, displayName, picture, u.id]
      );
      const fresh = await pool.query(
        `SELECT u.id, u.email, u.display_name, u.avatar_url, r.name AS role
         FROM users u JOIN roles r ON u.role_id = r.id
         WHERE u.id = ? AND u.is_active = 1`,
        [u.id]
      );
      if (fresh.rows.length === 0) {
        return res.status(403).json({ error: 'Данс идэвхгүй' });
      }
      const f = fresh.rows[0];
      const token = generateToken(f);
      return res.json({
        token,
        user: {
          id: f.id,
          email: f.email,
          display_name: f.display_name,
          avatar_url: f.avatar_url,
          role: f.role,
        },
      });
    }

    const newId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, email, display_name, avatar_url, firebase_uid, role_id)
       VALUES (?, ?, ?, ?, ?, 3)`,
      [newId, email, displayName, picture, uid]
    );
    const fresh = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [newId]
    );
    const f = fresh.rows[0];
    const token = generateToken(f);
    return res.status(201).json({
      token,
      user: {
        id: f.id,
        email: f.email,
        display_name: f.display_name,
        avatar_url: f.avatar_url,
        role: f.role,
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Өгөгдөл давхардлаа' });
    }
    if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes('firebase_uid'))) {
      return res.status(503).json({
        error: 'Өгөгдлийн санд firebase_uid багана байхгүй. DB migration ажиллуулна уу (007_users_firebase_uid.sql).',
      });
    }
    console.error('Firebase auth upsert:', err);
    res.status(500).json({ error: 'Нэвтрэхэд алдаа гарлаа' });
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
    console.error('Register error:', err.code, err.sqlMessage || err.message);
    // Typical prod misconfig: schema/roles not seeded → FK fails (1452) or missing table (1146).
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
      return res.status(401).json({ error: 'Энэ хаяг Google эсвэл Firebase-ээр нэвтэрдэг' });
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
