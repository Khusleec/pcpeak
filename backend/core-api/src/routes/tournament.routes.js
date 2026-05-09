const express = require('express');
const pool = require('../db/pool');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  registerSchema,
  createTournamentSchema,
  updateTournamentSchema,
} = require('../validators/tournament.validator');
const { matchUpdateSchema, createMatchesSchema } = require('../validators/match.validator');

const router = express.Router();

const DEADLINE_SQL = 'COALESCE(t.registration_deadline, t.starts_at)';

function toSqlDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function canViewPrivateTournament(row, userId) {
  if (row.visibility !== 'private') return true;
  if (!userId) return false;
  if (row.created_by && row.created_by === userId) return true;
  const r = await pool.query(
    'SELECT 1 AS ok FROM tournament_registrations WHERE tournament_id = ? AND user_id = ? LIMIT 1',
    [row.id, userId]
  );
  return r.rows.length > 0;
}

// ─── List tournaments (visibility-aware) ───────────────────
router.get('/', optionalAuthenticateToken, async (req, res) => {
  try {
    const uid = req.user?.id || null;
    let sql = `SELECT t.*,
              c.name AS cafe_name,
              (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) AS registered_count
       FROM tournaments t
       LEFT JOIN cafes c ON c.id = t.cafe_id
       WHERE t.status != 'cancelled'`;
    const params = [];
    if (uid) {
      sql += ` AND (
        t.visibility = 'public'
        OR t.created_by = ?
        OR EXISTS (SELECT 1 FROM tournament_registrations tr2 WHERE tr2.tournament_id = t.id AND tr2.user_id = ?)
      )`;
      params.push(uid, uid);
    } else {
      sql += ` AND t.visibility = 'public'`;
    }
    sql += ` ORDER BY t.starts_at ASC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List tournaments:', err);
    res.status(500).json({ error: 'Тэмцээний жагсаалт татаж чадсангүй' });
  }
});

// ─── Create tournament (organizer) ─────────────────────────
router.post('/', authenticateToken, validate(createTournamentSchema), async (req, res) => {
  const b = req.body;
  const startsAt = toSqlDateTime(b.starts_at);
  const endsAt = toSqlDateTime(b.ends_at);
  if (!startsAt || !endsAt) {
    return res.status(400).json({ error: 'Огноо буруу байна' });
  }
  let regDeadline = null;
  if (b.registration_deadline != null && String(b.registration_deadline).trim() !== '') {
    regDeadline = toSqlDateTime(b.registration_deadline);
    if (!regDeadline) {
      return res.status(400).json({ error: 'Бүртгэлийн хугацаа буруу байна' });
    }
  }
  if (b.cafe_id != null) {
    const c = await pool.query('SELECT id FROM cafes WHERE id = ?', [b.cafe_id]);
    if (c.rows.length === 0) {
      return res.status(400).json({ error: 'Салбар олдсонгүй' });
    }
  }
  try {
    const ins = await pool.query(
      `INSERT INTO tournaments (
        title, description, game_title, cafe_id, starts_at, ends_at, registration_deadline,
        max_participants, prize_pool_mnt, status, created_by, visibility, setup_mode, bracket_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'registration', ?, ?, ?, ?)`,
      [
        b.title,
        b.description != null ? String(b.description).trim() || null : null,
        b.game_title,
        b.cafe_id ?? null,
        startsAt,
        endsAt,
        regDeadline,
        b.max_participants ?? 32,
        b.prize_pool_mnt ?? 0,
        req.user.id,
        b.visibility ?? 'public',
        b.setup_mode ?? 'manual',
        b.bracket_type ?? 'elimination',
      ]
    );
    const id = ins.insertId;
    const row = await pool.query(
      `SELECT t.*, c.name AS cafe_name,
        (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) AS registered_count
       FROM tournaments t LEFT JOIN cafes c ON c.id = t.cafe_id WHERE t.id = ?`,
      [id]
    );
    res.status(201).json({ ...row.rows[0], user_registered: false, my_in_game_name: null });
  } catch (err) {
    console.error('Create tournament:', err);
    res.status(500).json({ error: 'Тэмцээн үүсгэхэд алдаа гарлаа' });
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
    const uid = req.user?.id || null;
    const canView = await canViewPrivateTournament(row, uid);
    if (!canView) {
      return res.status(404).json({ error: 'Тэмцээн олдсонгүй' });
    }
    let user_registered = false;
    let my_in_game_name = null;
    if (uid) {
      const r = await pool.query(
        `SELECT in_game_name FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?`,
        [id, uid]
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

// ─── Update tournament (creator only) ──────────────────────
router.patch('/:id', authenticateToken, validate(updateTournamentSchema), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'Тэмцээний ID буруу байна' });
  }
  const existing = await pool.query('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Тэмцээн олдсонгүй' });
  }
  const t = existing.rows[0];
  if (t.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Зөвхөн зохион байгуулагч шинэчилнэ' });
  }
  const patch = req.body;
  const cols = [];
  const vals = [];
  const map = {
    title: () => patch.title,
    description: () => {
      if (patch.description === null) return null;
      if (patch.description === undefined) return undefined;
      return String(patch.description).trim() || null;
    },
    game_title: () => patch.game_title,
    cafe_id: () => patch.cafe_id,
    starts_at: () => (patch.starts_at != null ? toSqlDateTime(patch.starts_at) : undefined),
    ends_at: () => (patch.ends_at != null ? toSqlDateTime(patch.ends_at) : undefined),
    registration_deadline: () => {
      if (patch.registration_deadline === null) return null;
      if (patch.registration_deadline === undefined) return undefined;
      return toSqlDateTime(patch.registration_deadline);
    },
    max_participants: () => patch.max_participants,
    prize_pool_mnt: () => patch.prize_pool_mnt,
    visibility: () => patch.visibility,
    setup_mode: () => patch.setup_mode,
    bracket_type: () => patch.bracket_type,
    status: () => patch.status,
  };
  for (const [key, getVal] of Object.entries(map)) {
    if (!(key in patch)) continue;
    const v = getVal();
    if (v === undefined) continue;
    cols.push(`${key} = ?`);
    vals.push(v);
  }
  if (cols.length === 0) {
    return res.status(400).json({ error: 'Шинэчлэх талбар байхгүй' });
  }
  if (patch.cafe_id != null) {
    const c = await pool.query('SELECT id FROM cafes WHERE id = ?', [patch.cafe_id]);
    if (c.rows.length === 0) {
      return res.status(400).json({ error: 'Салбар олдсонгүй' });
    }
  }
  vals.push(id);
  try {
    await pool.query(`UPDATE tournaments SET ${cols.join(', ')} WHERE id = ?`, vals);
    const row = await pool.query(
      `SELECT t.*, c.name AS cafe_name,
        (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) AS registered_count
       FROM tournaments t LEFT JOIN cafes c ON c.id = t.cafe_id WHERE t.id = ?`,
      [id]
    );
    const r = row.rows[0];
    let user_registered = false;
    let my_in_game_name = null;
    const r2 = await pool.query(
      `SELECT in_game_name FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (r2.rows.length > 0) {
      user_registered = true;
      my_in_game_name = r2.rows[0].in_game_name;
    }
    res.json({ ...r, user_registered, my_in_game_name });
  } catch (err) {
    console.error('Patch tournament:', err);
    res.status(500).json({ error: 'Шинэчлэхэд алдаа гарлаа' });
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

// ─── List participants ─────────────────────────────────────
router.get('/:id/participants', optionalAuthenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'Тэмцээний ID буруу байна' });
  }
  try {
    const rows = await pool.query(
      `SELECT tr.id, tr.user_id, tr.in_game_name, tr.created_at,
              u.display_name, u.avatar_url
       FROM tournament_registrations tr
       JOIN users u ON tr.user_id = u.id
       WHERE tr.tournament_id = ?
       ORDER BY tr.created_at ASC`,
      [id]
    );
    res.json(rows.rows);
  } catch (err) {
    console.error('List participants:', err);
    res.status(500).json({ error: 'Оролцогчдын жагсаалт татаж чадсангүй' });
  }
});

// ─── List matches ──────────────────────────────────────────
router.get('/:id/matches', optionalAuthenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const rows = await pool.query(
      `SELECT m.*,
              u1.display_name AS p1_name, u1.avatar_url AS p1_avatar,
              u2.display_name AS p2_name, u2.avatar_url AS p2_avatar,
              uw.display_name AS winner_name
       FROM tournament_matches m
       LEFT JOIN users u1 ON m.player1_id = u1.id
       LEFT JOIN users u2 ON m.player2_id = u2.id
       LEFT JOIN users uw ON m.winner_id = uw.id
       WHERE m.tournament_id = ?
       ORDER BY m.round ASC, m.match_order ASC`,
      [id]
    );
    res.json(rows.rows);
  } catch (err) {
    console.error('List matches:', err);
    res.status(500).json({ error: 'Тоглолтын хуваарь татаж чадсангүй' });
  }
});

// ─── Create matches (organizer only) ───────────────────────
router.post('/:id/matches', authenticateToken, validate(createMatchesSchema), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const tRows = await pool.query('SELECT created_by FROM tournaments WHERE id = ?', [id]);
  if (tRows.rows.length === 0) return res.status(404).json({ error: 'Тэмцээн олдсонгүй' });
  if (tRows.rows[0].created_by !== req.user.id) return res.status(403).json({ error: 'Зөвхөн зохион байгуулагч' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of req.body) {
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, player1_id, player2_id, round, match_order)
         VALUES (?, ?, ?, ?, ?)`,
        [id, m.player1_id, m.player2_id, m.round, m.match_order]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create matches:', err);
    res.status(500).json({ error: 'Тоглолт үүсгэхэд алдаа гарлаа' });
  } finally {
    client.release();
  }
});

// ─── Update match result (organizer only) ──────────────────
router.patch('/:id/matches/:matchId', authenticateToken, validate(matchUpdateSchema), async (req, res) => {
  const { id, matchId } = req.params;
  const tRows = await pool.query('SELECT created_by FROM tournaments WHERE id = ?', [id]);
  if (tRows.rows.length === 0) return res.status(404).json({ error: 'Тэмцээн олдсонгүй' });
  if (tRows.rows[0].created_by !== req.user.id) return res.status(403).json({ error: 'Зөвхөн зохион байгуулагч' });

  const patch = req.body;
  const cols = [];
  const vals = [];
  if ('score1' in patch) { cols.push('score1 = ?'); vals.push(patch.score1); }
  if ('score2' in patch) { cols.push('score2 = ?'); vals.push(patch.score2); }
  if ('winner_id' in patch) { cols.push('winner_id = ?'); vals.push(patch.winner_id); }
  if ('status' in patch) { cols.push('status = ?'); vals.push(patch.status); }

  if (cols.length === 0) return res.status(400).json({ error: 'Шинэчлэх талбар байхгүй' });

  vals.push(matchId, id);
  try {
    const result = await pool.query(
      `UPDATE tournament_matches SET ${cols.join(', ')} WHERE id = ? AND tournament_id = ?`,
      vals
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Тоглолт олдсонгүй' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Update match:', err);
    res.status(500).json({ error: 'Тоглолт шинэчлэхэд алдаа гарлаа' });
  }
});

module.exports = router;
