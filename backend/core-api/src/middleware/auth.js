const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db/pool');

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
      if (!allowedRoles.includes(userRole)) {
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

module.exports = { authenticateToken, authorize, generateToken };
