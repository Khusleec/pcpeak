const express = require('express');
const pool = require('../db/pool');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema } = require('../validators/tournament.validator');

const router = express.Router();

const DEADLINE_SQL = 'COALESCE(t.registration_deadline, t.starts_at)';

// ─── List tournaments (public) ─────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*,
              c.name AS cafe_name,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) AS registered_count
       FROM tournaments t
       LEFT JOIN cafes c ON c.id = t.cafe_id
       WHERE t.status != 'cancelled'
       ORDER BY t.starts_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List tournaments:', err);
    res.status(500).json({ error: 'Тэмцээний жагсаалт татаж чадсангүй' });
  }
});

// ─── Single tournament + optional “am I registered?” ───────
router.get('/:id', optionalAuthenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: 'Тэмцээний ID буруу байна' });
    }
    const rows = await pool.query(
      `SELECT t.*,
              c.name AS cafe_name,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) AS registered_count
       FROM tournaments t
       LEFT JOIN cafes c ON c.id = t.cafe_id
       WHERE t.id = ?`,
      [id]
    );
    if (rows.rows.length === 0) {
      return res.status(404).json({ error: 'Тэмцээн олдсонгүй' });
    }
    const row = rows.rows[0];
    let user_registered = false;
    let my_in_game_name = null;
    if (req.user && req.user.id) {
      const r = await pool.query(
        `SELECT in_game_name FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?`,
        [id, req.user.id]
      );
      if (r.rows.length > 0) {
        user_registered = true;
        my_in_game_name = r.rows[0].in_game_name;
      }
    }
    res.json({ ...row, user_registered, my_in_game_name });
  } catch (err) {
    console.error('Get tournament:', err);
    res.status(500).json({ error: 'Тэмцээний мэдээлэл татаж чадсангүй' });
  }
});

// ─── Register for tournament ───────────────────────────────
router.post('/:id/register', authenticateToken, validate(registerSchema), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'Тэмцээний ID буруу байна' });
  }
  const in_game_name = req.body.in_game_name != null ? String(req.body.in_game_name).trim() || null : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tRows = await client.query(
      `SELECT t.id, t.status, t.max_participants, t.starts_at, ${DEADLINE_SQL} AS eff_deadline
       FROM tournaments t WHERE t.id = ? FOR UPDATE`,
      [id]
    );
    if (tRows.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Тэмцээн олдсонгүй' });
    }
    const t = tRows.rows[0];
    if (t.status !== 'registration') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Бүртгэл хаагдсан эсвэл тэмцээн эхэлсэн' });
    }
    const deadline = new Date(t.eff_deadline);
    if (Number.isNaN(deadline.getTime()) || new Date() >= deadline) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Бүртгэлийн хугацаа дууссан' });
    }
    const cnt = await client.query(
      `SELECT COUNT(*) AS c FROM tournament_registrations WHERE tournament_id = ?`,
      [id]
    );
    const n = parseInt(cnt.rows[0].c, 10) || 0;
    if (n >= t.max_participants) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Тэмцээнд суудал дүүрсэн' });
    }
    await client.query(
      `INSERT INTO tournament_registrations (tournament_id, user_id, in_game_name) VALUES (?, ?, ?)`,
      [id, req.user.id, in_game_name]
    );
    await client.query('COMMIT');
    const again = await pool.query(
      `SELECT COUNT(*) AS c FROM tournament_registrations WHERE tournament_id = ?`,
      [id]
    );
    res.status(201).json({
      ok: true,
      registered_count: parseInt(again.rows[0].c, 10) || 0,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Та аль хэдийн бүртгэгдсэн байна' });
    }
    console.error('Tournament register:', err);
    res.status(500).json({ error: 'Бүртгүүлэхэд алдаа гарлаа' });
  } finally {
    client.release();
  }
});

// ─── Unregister ────────────────────────────────────────────
router.delete('/:id/register', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'Тэмцээний ID буруу байна' });
  }
  try {
    const tRows = await pool.query(
      `SELECT t.id, t.status, ${DEADLINE_SQL} AS eff_deadline FROM tournaments t WHERE t.id = ?`,
      [id]
    );
    if (tRows.rows.length === 0) {
      return res.status(404).json({ error: 'Тэмцээн олдсонгүй' });
    }
    const t = tRows.rows[0];
    if (t.status !== 'registration') {
      return res.status(400).json({ error: 'Бүртгэл хаагдсан — цуцлах боломжгүй' });
    }
    const deadline = new Date(t.eff_deadline);
    if (Number.isNaN(deadline.getTime()) || new Date() >= deadline) {
      return res.status(400).json({ error: 'Бүртгэлийн хугацаа дууссан' });
    }
    const del = await pool.query(
      `DELETE FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'Бүртгэл олдсонгүй' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Tournament unregister:', err);
    res.status(500).json({ error: 'Бүртгэл цуцлахад алдаа гарлаа' });
  }
});

module.exports = router;
