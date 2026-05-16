const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db/pool');

/** Canonical admin role name in `roles` — treated as full superuser (all permissions). */
const ADMIN_ROLE_NAME = 'admin';

function isAdminRoleName(roleName) {
  return typeof roleName === 'string' && roleName.toLowerCase() === ADMIN_ROLE_NAME;
}

async function fetchUserRoleName(userId) {
  const result = await pool.query(
    `SELECT r.name AS role_name FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [userId]
  );
  return result.rows[0]?.role_name ?? null;
}

/** True if this user row is the global admin (god-mode for RBAC and resource checks). */
async function userIsAdmin(userId) {
  const roleName = await fetchUserRoleName(userId);
  return isAdminRoleName(roleName);
}

// Verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Нэвтрэх токен шаардлагатай' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch {
    // 401 — credentials present but invalid/expired (HTTP semantics).
    return res.status(401).json({ error: 'Токен буруу эсвэл хүчингүй болсон' });
  }
}

/** Sets req.user when Bearer token is valid; otherwise continues without req.user. */
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, config.jwt.secret);
  } catch {
    req.user = null;
  }
  next();
}

// RBAC middleware factory
function authorize(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT r.name AS role_name FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
      }

      const userRole = result.rows[0].role_name;
      // Admin bypasses explicit role lists — full project superuser.
      if (!isAdminRoleName(userRole) && !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Эрх хүрэлцэхгүй байна' });
      }

      req.user.role = userRole;
      next();
    } catch (err) {
      console.error('Authorization error:', err);
      return res.status(500).json({ error: 'Эрх шалгахад алдаа гарлаа' });
    }
  };
}

// Generate JWT for a user
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  authorize,
  generateToken,
  ADMIN_ROLE_NAME,
  isAdminRoleName,
  userIsAdmin,
  fetchUserRoleName,
};
